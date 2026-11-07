import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { NextRequest } from "next/server";
import { BLOG_IMAGE_MAX_BYTES } from "../../../../lib/blog";
import { blogAdminClients, blogFailure, blogRateLimit } from "../../../../lib/blogServer";
import { hasExpectedRasterSignature } from "../../../../lib/imageSafetyServer";
import { privateNextResponse as NextResponse } from "../../../../lib/privateApiResponse";
import { isTrustedSameOriginMutation } from "../../../../lib/requestOriginServer";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return blogFailure("This request is not allowed.", 403);
  try {
    const clients = await blogAdminClients(request);
    if ("error" in clients) return blogFailure(clients.error, clients.status);
    const limited = blogRateLimit("upload", clients.adminUser.id, 30);
    if (limited) return limited;
    const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) return blogFailure("Upload a JPG, PNG or WebP image.", 415);
    if (Number(request.headers.get("content-length")) > BLOG_IMAGE_MAX_BYTES) return blogFailure("The image must be no larger than 4 MB.", 413);
    const reader = request.body?.getReader();
    if (!reader) return blogFailure("Choose an image to upload.", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > BLOG_IMAGE_MAX_BYTES) { await reader.cancel(); return blogFailure("The image must be no larger than 4 MB.", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const input = Buffer.concat(chunks);
    if (!hasExpectedRasterSignature(input, contentType)) return blogFailure("This file is not a valid image.", 400);
    let output: Buffer;
    try {
      const raster = sharp(input, { limitInputPixels: 32_000_000, animated: false, failOn: "warning" });
      const metadata = await raster.metadata();
      if (!metadata.width || !metadata.height || metadata.width < 320 || metadata.height < 200 || (metadata.pages ?? 1) > 1) return blogFailure("Use a still image at least 320 × 200 pixels.", 400);
      // Decoding and re-encoding strips metadata and rejects disguised non-image payloads.
      output = await raster.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
    } catch { return blogFailure("The image could not be read. Try another JPG, PNG or WebP file.", 400); }
    const path = `${randomUUID()}.webp`;
    const result = await clients.serviceClient.storage.from("blog-media").upload(path, output, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (result.error) return blogFailure("The image could not be uploaded.", 503);
    const { data } = clients.serviceClient.storage.from("blog-media").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl });
  } catch { return blogFailure("Image uploads are temporarily unavailable.", 503); }
}
