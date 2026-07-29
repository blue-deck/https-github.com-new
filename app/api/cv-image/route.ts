const maxImageBytes = 24 * 1024 * 1024;
const allowedSourceContentTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawSource = requestUrl.searchParams.get("src") || requestUrl.searchParams.get("url");
  if (!rawSource) return new Response("Missing image source", { status: 400 });

  let imageUrl: URL;
  try {
    imageUrl = rawSource.startsWith("/")
      ? new URL(rawSource, requestUrl.origin)
      : new URL(rawSource);
  } catch {
    return new Response("Invalid image source", { status: 400 });
  }

  if (!["http:", "https:"].includes(imageUrl.protocol)) {
    return new Response("Unsupported image protocol", { status: 400 });
  }

  if (!isAllowedCvImageHost(imageUrl, requestUrl)) {
    return new Response("Image host is not allowed", { status: 403 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      cache: "no-store",
      redirect: "manual",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
    });

    if (response.status >= 300 && response.status < 400) {
      return new Response("Image redirects are not allowed", { status: 403 });
    }

    if (!response.ok) return new Response("Image could not be loaded", { status: response.status });

    const contentType = (response.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!allowedSourceContentTypes.has(contentType)) {
      return new Response("Unsupported image type", { status: 415 });
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxImageBytes) {
      return new Response("Image is too large", { status: 413 });
    }

    const imageBytes = await response.arrayBuffer();
    if (imageBytes.byteLength > maxImageBytes) {
      return new Response("Image is too large", { status: 413 });
    }

    return new Response(imageBytes, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(imageBytes.byteLength),
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image request failed", { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function isAllowedCvImageHost(imageUrl: URL, requestUrl: URL) {
  if (imageUrl.hostname === requestUrl.hostname) return true;
  if (isLocalAddress(imageUrl.hostname)) return false;
  if (isSupabaseStorageObjectUrl(imageUrl)) return true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;

  try {
    return imageUrl.hostname === new URL(supabaseUrl).hostname;
  } catch {
    return false;
  }
}

function isSupabaseStorageObjectUrl(imageUrl: URL) {
  const host = imageUrl.hostname.toLowerCase();
  const isSupabaseProjectHost = /^[a-z0-9-]+\.supabase\.(co|in)$/.test(host);
  if (!isSupabaseProjectHost) return false;

  return imageUrl.pathname.startsWith("/storage/v1/object/");
}

function isLocalAddress(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}
