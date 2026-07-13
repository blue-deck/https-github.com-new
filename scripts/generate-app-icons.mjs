import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(root, "public");
const source = path.join(publicDirectory, "bluedeck-search-icon.png");

function background(size) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glow" cx="24%" cy="18%" r="92%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="58%" stop-color="#eef9fd" />
          <stop offset="100%" stop-color="#d9edf4" />
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#glow)" />
    </svg>
  `);
}

async function generateIcon(fileName, size, logoRatio) {
  const logoSize = Math.round(size * logoRatio);
  const logo = await sharp(source)
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();
  const offset = Math.round((size - logoSize) / 2);

  await sharp(background(size))
    .composite([{ input: logo, left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDirectory, fileName));
}

await Promise.all([
  generateIcon("app-icon-192.png", 192, 0.74),
  generateIcon("app-icon-512.png", 512, 0.74),
  generateIcon("app-icon-maskable-192.png", 192, 0.58),
  generateIcon("app-icon-maskable-512.png", 512, 0.58),
  generateIcon("apple-touch-icon.png", 180, 0.68),
  generateIcon("apple-touch-icon-precomposed.png", 180, 0.68),
]);
