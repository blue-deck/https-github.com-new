const turkishCharacterMap: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

const transformableImageMimeTypes = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

const transformableImageExtensions = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "tif",
  "tiff",
  "webp",
]);

export const immutableImageCacheControl = "31536000";
export const maxTransformableImageBytes = 25_000_000;

export function createSafeStoragePath(ownerId: string, file: File, prefix = "upload") {
  const cleanOwnerId = sanitizeStoragePath(ownerId) || "user";
  const cleanPrefix = sanitizeStorageSegment(prefix) || "upload";
  const cleanFileName = sanitizeStorageFileName(file);

  return `${cleanOwnerId}/${cleanPrefix}-${Date.now()}-${cleanFileName}`;
}

export function validateTransformableImage(file: File) {
  if (!file || file.size <= 0) {
    return "Please choose a valid photo file.";
  }

  if (file.size > maxTransformableImageBytes) {
    return "Please choose a photo smaller than 25 MB.";
  }

  const mimeType = file.type.trim().toLowerCase();
  const extension = file.name.split(".").pop()?.trim().toLowerCase() || "";
  if (!transformableImageMimeTypes.has(mimeType) && !transformableImageExtensions.has(extension)) {
    return "Please choose a JPG, PNG, WebP, AVIF, HEIC, GIF, BMP or TIFF photo.";
  }

  return "";
}

export function sanitizeStorageFileName(file: File) {
  const originalName = file.name || "upload";
  const extension = getSafeExtension(originalName, file.type);
  const baseName = originalName.replace(/\.[^.]+$/, "");
  const safeBase = sanitizeStorageSegment(baseName) || "upload";

  return `${safeBase}.${extension}`;
}

function sanitizeStorageSegment(value: string) {
  return value
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (character) => turkishCharacterMap[character] || "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 80);
}

function sanitizeStoragePath(value: string) {
  return value
    .split("/")
    .map((segment) => sanitizeStorageSegment(segment))
    .filter(Boolean)
    .join("/");
}

function getSafeExtension(fileName: string, mimeType: string) {
  const extensionFromName = fileName.includes(".")
    ? fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || ""
    : "";
  if (extensionFromName) return extensionFromName.slice(0, 12);

  const extensionFromMime = mimeType.split("/")[1]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  if (extensionFromMime === "jpeg") return "jpg";
  return extensionFromMime.slice(0, 12) || "bin";
}
