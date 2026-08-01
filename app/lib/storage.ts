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

const extensionByMimeType: Record<string, string> = {
  "application/msword": "doc",
  "application/pdf": "pdf",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/plain": "txt",
};

export const safeImageUploadMimeTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const safePortfolioUploadMimeTypes = new Set([
  ...safeImageUploadMimeTypes,
  "image/gif",
]);

export const safeDocumentUploadMimeTypes = new Set([
  ...safeImageUploadMimeTypes,
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export const maximumImageUploadBytes = 10 * 1024 * 1024;
export const maximumCrewDocumentUploadBytes = 20 * 1024 * 1024;
export const maximumYachtDocumentUploadBytes = 25 * 1024 * 1024;

export function validateStorageUpload(
  file: File,
  allowedMimeTypes: ReadonlySet<string>,
  maximumBytes: number,
) {
  const mimeType = file.type.trim().toLowerCase();
  if (!allowedMimeTypes.has(mimeType)) {
    return "This file type is not supported.";
  }
  if (file.size <= 0) {
    return "The selected file is empty.";
  }
  if (file.size > maximumBytes) {
    return `The selected file must be ${Math.floor(maximumBytes / (1024 * 1024))} MB or smaller.`;
  }
  return "";
}

export function createSafeStoragePath(ownerId: string, file: File, prefix = "upload") {
  const cleanOwnerId = sanitizeStoragePath(ownerId) || "user";
  const cleanPrefix = sanitizeStorageSegment(prefix) || "upload";
  const cleanFileName = sanitizeStorageFileName(file);

  return `${cleanOwnerId}/${cleanPrefix}-${Date.now()}-${cleanFileName}`;
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
  void fileName;
  return extensionByMimeType[mimeType.trim().toLowerCase()] || "bin";
}
