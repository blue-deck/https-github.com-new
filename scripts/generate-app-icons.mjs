import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDirectory = path.join(root, "app");
const publicDirectory = path.join(root, "public");
const source = path.join(publicDirectory, "bluedeck-logo-mark.png");
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const trimmedMark = await sharp(source)
  .trim({ background: transparent })
  .png()
  .toBuffer();

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
  const logo = await sharp(trimmedMark)
    .resize(logoSize, logoSize, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  await sharp(background(size))
    .composite([
      {
        input: logo.data,
        left: Math.round((size - logo.info.width) / 2),
        top: Math.round((size - logo.info.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicDirectory, fileName));
}

async function faviconPng(size) {
  const logoSize = Math.max(1, Math.round(size * 0.96));
  const logo = await sharp(trimmedMark)
    .resize(logoSize, logoSize, {
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: transparent,
    },
  })
    .composite([
      {
        input: logo.data,
        left: Math.round((size - logo.info.width) / 2),
        top: Math.round((size - logo.info.height) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

function icoFromPngFrames(frames) {
  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize + frames.length * entrySize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  let offset = header.length;
  frames.forEach(({ size, png }, index) => {
    const entryOffset = headerSize + index * entrySize;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(png.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += png.length;
  });

  return Buffer.concat([header, ...frames.map(({ png }) => png)]);
}

const publicFaviconSizes = [16, 32, 48, 96, 150, 180, 192, 512];
const generatedFavicons = await Promise.all(
  publicFaviconSizes.map(async (size) => ({ size, png: await faviconPng(size) })),
);

await Promise.all(
  generatedFavicons.map(({ size, png }) =>
    writeFile(path.join(publicDirectory, `favicon-${size}x${size}.png`), png),
  ),
);

const searchIcon = await faviconPng(1024);
const appIcon = await faviconPng(512);
const icoFrames = await Promise.all(
  [16, 32, 48, 64, 128, 256].map(async (size) => ({ size, png: await faviconPng(size) })),
);
const faviconIco = icoFromPngFrames(icoFrames);

await Promise.all([
  writeFile(path.join(publicDirectory, "bluedeck-search-icon.png"), searchIcon),
  writeFile(path.join(publicDirectory, "bluedeck-favicon.png"), searchIcon),
  writeFile(path.join(publicDirectory, "favicon-source-512.png"), appIcon),
  writeFile(path.join(publicDirectory, "favicon.ico"), faviconIco),
  writeFile(path.join(appDirectory, "favicon.ico"), faviconIco),
  writeFile(path.join(appDirectory, "icon.png"), appIcon),
  generateIcon("app-icon-192.png", 192, 0.78),
  generateIcon("app-icon-512.png", 512, 0.78),
  generateIcon("app-icon-maskable-192.png", 192, 0.58),
  generateIcon("app-icon-maskable-512.png", 512, 0.58),
  generateIcon("android-chrome-192x192.png", 192, 0.78),
  generateIcon("android-chrome-512x512.png", 512, 0.78),
  generateIcon("favicon-maskable-192x192.png", 192, 0.58),
  generateIcon("favicon-maskable-512x512.png", 512, 0.58),
  generateIcon("apple-touch-icon.png", 180, 0.78),
  generateIcon("apple-touch-icon-precomposed.png", 180, 0.78),
  generateIcon("mstile-150x150.png", 150, 0.72),
]);

await writeFile(
  path.join(appDirectory, "apple-icon.png"),
  await sharp(path.join(publicDirectory, "apple-touch-icon.png")).toBuffer(),
);
