import sharp from "sharp";

const maxImageBytes = 24 * 1024 * 1024;
const defaultMaxImageDimension = 1800;

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
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8" },
    });

    if (!response.ok) return new Response("Image could not be loaded", { status: response.status });

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return new Response("Source is not an image", { status: 415 });
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxImageBytes) {
      return new Response("Image is too large", { status: 413 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxImageBytes) {
      return new Response("Image is too large", { status: 413 });
    }

    const normalizedImage = await normalizeCvImage(buffer, contentType, requestUrl.searchParams);

    return new Response(bufferToArrayBuffer(normalizedImage.buffer), {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": normalizedImage.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image request failed", { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function bufferToArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function normalizeCvImage(buffer: Buffer, sourceContentType: string, searchParams: URLSearchParams) {
  const width = parseImageDimension(searchParams.get("w"));
  const height = parseImageDimension(searchParams.get("h"));
  const max = parseImageDimension(searchParams.get("max")) || defaultMaxImageDimension;
  const fit = parseImageFit(searchParams.get("fit"));

  try {
    let pipeline = sharp(buffer, { animated: false, failOn: "none" }).rotate();
    const metadata = await pipeline.metadata();
    const currentWidth = metadata.width || 0;
    const currentHeight = metadata.height || 0;

    if (width || height) {
      pipeline = pipeline.resize({
        width,
        height,
        fit,
        position: "center",
        withoutEnlargement: false,
      });
    } else if (Math.max(currentWidth, currentHeight) > max) {
      pipeline = pipeline.resize({
        width: max,
        height: max,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    if (metadata.hasAlpha || sourceContentType.toLowerCase().includes("png")) {
      return {
        buffer: await pipeline.png({ compressionLevel: 8, adaptiveFiltering: true }).toBuffer(),
        contentType: "image/png",
      };
    }

    return {
      buffer: await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
      contentType: "image/jpeg",
    };
  } catch {
    return { buffer, contentType: sourceContentType };
  }
}

function parseImageDimension(value: string | null) {
  if (!value) return undefined;
  const dimension = Number.parseInt(value, 10);
  if (!Number.isFinite(dimension)) return undefined;
  return Math.min(Math.max(dimension, 32), 2400);
}

function parseImageFit(value: string | null): "cover" | "contain" | "inside" {
  if (value === "contain" || value === "inside") return value;
  return "cover";
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
