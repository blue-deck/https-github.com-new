import { maximumYachtPhotoBytes } from "./yachtWorkspace";

export const maximumYachtRequestBytes = maximumYachtPhotoBytes + 16 * 1024;

export class YachtWorkspaceRequestError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

/** Bound the actual streamed bytes before invoking the multipart parser. */
export async function readYachtWorkspaceForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    throw new YachtWorkspaceRequestError("Submit the yacht details as form data.", 415, "invalid_content_type");
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumYachtRequestBytes)) {
    throw new YachtWorkspaceRequestError("The photo must be 4 MB or smaller.", 413, "photo_too_large");
  }
  if (!request.body) {
    throw new YachtWorkspaceRequestError("Yacht details are required.", 400, "invalid_form");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumYachtRequestBytes) {
        await reader.cancel().catch(() => undefined);
        throw new YachtWorkspaceRequestError("The photo must be 4 MB or smaller.", 413, "photo_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const form = await new Response(body, { headers: { "content-type": contentType } }).formData();
    const allowedFields = new Set(["name", "yachtType", "model", "crewSize", "flag", "photo", "removePhoto"]);
    for (const key of form.keys()) {
      if (!allowedFields.has(key) || form.getAll(key).length !== 1) {
        throw new Error("Invalid or duplicate field");
      }
      if (key !== "photo" && typeof form.get(key) !== "string") {
        throw new Error("Text field required");
      }
    }
    return form;
  } catch {
    throw new YachtWorkspaceRequestError("The yacht form could not be read. Please try again.", 400, "invalid_form");
  }
}
