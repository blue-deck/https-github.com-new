import type { ImageLoaderProps } from "next/image";

const supabaseObjectPath = "/storage/v1/object/public/";
const supabaseRenderPath = "/storage/v1/render/image/public/";
const minTransformQuality = 20;
const maxTransformQuality = 100;
const maxTransformDimension = 2500;
const privateImageBuckets = new Set([
  "crew-documents",
  "documents",
  "task-photos",
  "yacht-documents",
]);

export const galleryThumbnailQuality = 84;
export const galleryPreviewQuality = 90;

export function isSupabaseStorageImageUrl(src: string) {
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".supabase.co") &&
      (url.pathname.includes(supabaseObjectPath) || url.pathname.includes(supabaseRenderPath))
    );
  } catch {
    return false;
  }
}

export function parseSupabaseStorageObjectUrl(src: string) {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
      return null;
    }

    const marker = url.pathname.includes("/storage/v1/object/public/")
      ? "/storage/v1/object/public/"
      : url.pathname.includes("/storage/v1/render/image/public/")
        ? "/storage/v1/render/image/public/"
        : "";
    if (!marker) return null;

    const objectPath = decodeURIComponent(url.pathname.split(marker)[1] || "");
    const separator = objectPath.indexOf("/");
    if (separator <= 0) return null;

    const bucket = objectPath.slice(0, separator);
    const path = objectPath.slice(separator + 1);
    if (!bucket || !path) return null;

    return {
      bucket,
      path,
      isPrivate: privateImageBuckets.has(bucket),
    };
  } catch {
    return null;
  }
}

export function supabaseSquareImageLoader({ src, width, quality }: ImageLoaderProps) {
  return createSupabaseTransformedImageUrl(src, {
    width,
    height: width,
    quality,
    resize: "cover",
  });
}

export function supabaseContainedImageLoader({ src, width, quality }: ImageLoaderProps) {
  return createSupabaseTransformedImageUrl(src, {
    width,
    quality,
    resize: "contain",
  });
}

export function createSupabaseTransformedImageUrl(
  src: string,
  transform: {
    width: number;
    height?: number;
    quality?: number;
    resize: "cover" | "contain";
  },
) {
  if (!isSupabaseStorageImageUrl(src)) return src;

  const url = new URL(src);
  url.pathname = url.pathname.replace(supabaseObjectPath, supabaseRenderPath);
  url.searchParams.set("width", String(clampInteger(transform.width, 1, maxTransformDimension)));
  url.searchParams.set(
    "quality",
    String(clampInteger(transform.quality || galleryThumbnailQuality, minTransformQuality, maxTransformQuality)),
  );
  url.searchParams.set("resize", transform.resize);

  if (transform.height) {
    url.searchParams.set("height", String(clampInteger(transform.height, 1, maxTransformDimension)));
  } else {
    url.searchParams.delete("height");
  }

  return url.toString();
}

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
