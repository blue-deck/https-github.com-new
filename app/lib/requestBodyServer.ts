import "server-only";

export type LimitedJsonObjectResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: "content-type" | "invalid" | "too-large" };

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Reads a JSON object without ever buffering more than `maximumBytes`.
 * Content-Length is only an early rejection hint; the streamed byte count is
 * the authoritative limit for chunked and dishonest requests.
 */
export async function readLimitedJsonObject(
  request: Request,
  maximumBytes: number,
): Promise<Record<string, unknown> | null> {
  const result = await readLimitedJsonObjectDetailed(request, maximumBytes);
  return result.ok ? result.value : null;
}

export async function readLimitedJsonObjectDetailed(
  request: Request,
  maximumBytes: number,
): Promise<LimitedJsonObjectResult> {
  const mediaType = (request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, error: "content-type" };
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 0 ||
      contentLength > maximumBytes
    ) {
      return { ok: false, error: "too-large" };
    }
  }

  if (!request.body) return { ok: false, error: "invalid" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel("request body limit exceeded").catch(() => undefined);
        return { ok: false, error: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "invalid" };
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) return { ok: false, error: "invalid" };

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const value: unknown = JSON.parse(utf8Decoder.decode(bytes));
    if (!isPlainRecord(value)) return { ok: false, error: "invalid" };
    return { ok: true, value };
  } catch {
    return { ok: false, error: "invalid" };
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
