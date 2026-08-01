import "server-only";

export const safeRasterImageContentTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function hasExpectedRasterSignature(
  value: Uint8Array,
  contentType: string,
) {
  if (contentType === "image/jpeg") {
    return value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff;
  }
  if (contentType === "image/png") {
    return startsWith(value, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (contentType === "image/gif") {
    return ascii(value, 0, 6) === "GIF87a" || ascii(value, 0, 6) === "GIF89a";
  }
  if (contentType === "image/webp") {
    return ascii(value, 0, 4) === "RIFF" && ascii(value, 8, 4) === "WEBP";
  }
  if (contentType === "image/avif") {
    if (ascii(value, 4, 4) !== "ftyp") return false;
    const brands = ascii(value, 8, Math.min(40, Math.max(0, value.length - 8)));
    return brands.includes("avif") || brands.includes("avis");
  }
  return false;
}

function startsWith(value: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => value[index] === byte);
}

function ascii(value: Uint8Array, offset: number, length: number) {
  if (offset < 0 || length < 0 || offset + length > value.length) return "";
  let result = "";
  for (let index = offset; index < offset + length; index += 1) {
    result += String.fromCharCode(value[index]);
  }
  return result;
}
