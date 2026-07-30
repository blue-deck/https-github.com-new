import "server-only";

import { loadActiveDirectoryCrewMediaSource } from "../../../../lib/findCrewData";
import { safePublicMediaUrl } from "../../../../lib/publicCrewSafety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maximumSourceBytes = 16 * 1024 * 1024;
const sourceTimeoutMilliseconds = 15_000;
const allowedSourceContentTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);
const safeResponseHeaders = {
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

type RouteContext = {
  params: Promise<{ crewId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { crewId } = await context.params;
  const mediaRequest = parseMediaRequest(request);
  if (!mediaRequest) return mediaError(404);

  let source = "";
  try {
    source = await loadActiveDirectoryCrewMediaSource(
      crewId,
      mediaRequest.kind,
      mediaRequest.slot,
    );
  } catch (error) {
    console.error(
      "Find Crew media request failed",
      error instanceof Error ? error.message.slice(0, 240) : "Unknown error",
    );
    return mediaError(503);
  }

  const safeSource = safePublicMediaUrl(source);
  if (!safeSource) return mediaError(404);
  return proxyMedia(
    safeSource,
    mediaRequest.kind,
    safeUpstreamAccept(request.headers.get("accept")),
  );
}

function parseMediaRequest(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  if (
    Array.from(searchParams.keys()).some(
      (key) => key !== "kind" && key !== "slot",
    )
  ) {
    return null;
  }
  const kinds = searchParams.getAll("kind");
  const slots = searchParams.getAll("slot");
  if (
    kinds.length !== 1 ||
    (kinds[0] === "avatar" && slots.length > 0)
  ) {
    return null;
  }

  if (kinds[0] === "avatar") {
    return { kind: "avatar" as const, slot: null };
  }
  if (
    kinds[0] !== "gallery" ||
    slots.length !== 1 ||
    !/^[0-3]$/.test(slots[0])
  ) {
    return null;
  }

  return { kind: "gallery" as const, slot: Number(slots[0]) };
}

async function proxyMedia(
  source: string,
  kind: "avatar" | "gallery",
  accept: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    sourceTimeoutMilliseconds,
  );

  try {
    const transformedSource = transformedStorageSource(source, kind);
    let upstream = await fetchMediaSource(
      transformedSource,
      controller.signal,
      accept,
    );
    if (
      !upstream.ok ||
      (upstream.status >= 300 && upstream.status < 400)
    ) {
      await upstream.body?.cancel().catch(() => undefined);
      upstream = await fetchMediaSource(source, controller.signal, accept);
      if (
        !upstream.ok ||
        (upstream.status >= 300 && upstream.status < 400)
      ) {
        return mediaError(502);
      }
    }

    const contentType = (upstream.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!allowedSourceContentTypes.has(contentType)) return mediaError(415);

    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maximumSourceBytes
    ) {
      return mediaError(413);
    }

    const sourceBytes = await readLimitedBody(upstream, maximumSourceBytes);
    return new Response(sourceBytes, {
      status: 200,
      headers: {
        ...safeResponseHeaders,
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=60",
        "Content-Length": String(sourceBytes.byteLength),
        "Content-Type": contentType,
        Vary: "Accept",
      },
    });
  } catch (error) {
    if (error instanceof MediaSizeError) return mediaError(413);
    if (error instanceof MediaFormatError) return mediaError(415);
    return mediaError(502);
  } finally {
    clearTimeout(timeout);
  }
}

function transformedStorageSource(
  source: string,
  kind: "avatar" | "gallery",
) {
  const transformed = new URL(source);
  transformed.pathname = transformed.pathname.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/",
  );
  transformed.search = "";
  transformed.searchParams.set("width", kind === "avatar" ? "320" : "960");
  transformed.searchParams.set("height", kind === "avatar" ? "320" : "720");
  transformed.searchParams.set("resize", "cover");
  transformed.searchParams.set("quality", "82");
  return transformed.toString();
}

function fetchMediaSource(
  source: string,
  signal: AbortSignal,
  accept: string,
) {
  return fetch(source, {
    cache: "no-store",
    redirect: "manual",
    signal,
    headers: {
      Accept: accept,
    },
  });
}

function safeUpstreamAccept(value: string | null) {
  const accepted = [
    acceptsImageType(value, "image/avif") ? "image/avif" : "",
    acceptsImageType(value, "image/webp") ? "image/webp" : "",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/*;q=0.8",
  ].filter(Boolean);
  return accepted.join(",");
}

function acceptsImageType(value: string | null, contentType: string) {
  return (value || "").split(",").some((entry) => {
    const [mediaRange, ...parameters] = entry
      .split(";")
      .map((part) => part.trim().toLowerCase());
    if (mediaRange !== contentType) return false;

    const qualityParameter = parameters.find((part) => part.startsWith("q="));
    if (!qualityParameter) return true;
    const quality = Number(qualityParameter.slice(2));
    return Number.isFinite(quality) && quality > 0;
  });
}

async function readLimitedBody(response: Response, limit: number) {
  if (!response.body) throw new MediaFormatError();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      throw new MediaSizeError();
    }
    chunks.push(value);
  }

  if (size === 0) throw new MediaFormatError();
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function mediaError(status: number) {
  return new Response("Media not found.", {
    status,
    headers: {
      ...safeResponseHeaders,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

class MediaSizeError extends Error {}
class MediaFormatError extends Error {}
