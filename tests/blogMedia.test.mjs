import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const origin = "https://www.bluedeck.app";
const maximumBytes = 4 * 1024 * 1024;
const compiled = new Map();
function harness(options = {}) {
  const uploads = [];
  let authCalls = 0;
  const storage = { from(bucket) {
    assert.equal(bucket, "blog-media");
    return {
      async upload(filename, bytes, settings) {
        uploads.push({ filename, bytes, settings });
        return options.storageError ? { error: { message: "Internal storage credentials and diagnostics" } } : { error: null };
      },
      getPublicUrl(filename) { return { data: { publicUrl: `https://onftggrmmpvvwgxxzywo.supabase.co/storage/v1/object/public/blog-media/${filename}` } }; },
    };
  } };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    if (!compiled.has(filename)) compiled.set(filename, ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText);
    const require = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/server") return { NextResponse: { json: Response.json } };
      if (specifier.endsWith("blogServer")) return {
        async blogAdminClients() {
          authCalls++;
          return options.authError ?? { adminUser: { id: "owner" }, serviceClient: { storage } };
        },
        blogFailure: (error, status) => load(path.join(root, "app/lib/privateApiResponse.ts")).privateNextResponse.json({ ok: false, error }, { status }),
        blogRateLimit: () => options.rateLimited ? Response.json({ ok: false, error: "Rate limited" }, { status: 429 }) : null,
      };
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      return nativeRequire(specifier);
    };
    new Function("require", "module", "exports", compiled.get(filename))(require, loaded, loaded.exports);
    return loaded.exports;
  }
  const route = load(path.join(root, "app/api/admin/blog/media/route.ts"));
  function send(bytes, settings = {}) {
    const headers = { origin: settings.origin ?? origin, "sec-fetch-site": "same-origin", "content-type": settings.mime ?? "image/png",
      ...(settings.length === undefined ? {} : { "content-length": String(settings.length) }) };
    return route.POST(new Request(`${origin}/api/admin/blog/media`, { method: "POST", headers, body: bytes }));
  }
  return { send, uploads, authCalls: () => authCalls };
}
async function raster(width = 480, height = 320, type = "png") {
  return sharp({ create: { width, height, channels: 3, background: { r: 16, g: 90, b: 120 } } })[type]().toBuffer();
}

test("upload rejects unauthorized users before reading or storing image data", async () => {
  for (const status of [401, 403, 503]) {
    const h = harness({ authError: { error: "Access denied", status } });
    const result = await h.send(new Uint8Array([1, 2, 3]));
    assert.equal(result.status, status);
    assert.equal(h.authCalls(), 1);
    assert.equal(h.uploads.length, 0);
    assert.match(result.headers.get("cache-control"), /private, no-store/);
  }
});

test("cross-origin uploads and rate-limited requests never reach storage", async () => {
  const untrusted = harness();
  assert.equal((await untrusted.send(new Uint8Array([1]), { origin: "https://attacker.example" })).status, 403);
  assert.equal(untrusted.authCalls(), 0);
  const limited = harness({ rateLimited: true });
  assert.equal((await limited.send(new Uint8Array([1]))).status, 429);
  assert.equal(limited.uploads.length, 0);
});

test("unsupported MIME types and mismatched file signatures are rejected", async () => {
  const image = await raster();
  for (const mime of ["image/svg+xml", "text/html", "application/octet-stream", "image/gif"]) {
    const h = harness();
    assert.equal((await h.send(image, { mime })).status, 415);
    assert.equal(h.uploads.length, 0);
  }
  const h = harness();
  assert.equal((await h.send(image, { mime: "image/jpeg" })).status, 400);
  assert.equal((await h.send(Buffer.from("<html><script>alert(1)</script></html>"))).status, 400);
  assert.equal(h.uploads.length, 0);
});

test("size is bounded by streamed bytes even with a misleading Content-Length", async () => {
  const h = harness();
  assert.equal((await h.send(Buffer.alloc(16), { length: maximumBytes + 1 })).status, 413);
  assert.equal((await h.send(Buffer.alloc(maximumBytes + 1), { length: 1 })).status, 413);
  assert.equal((await h.send(Buffer.alloc(maximumBytes + 1))).status, 413);
  assert.equal(h.uploads.length, 0);
});

test("a matching magic signature does not bypass actual decoding", async () => {
  const h = harness();
  const forgedPng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("Not a PNG")]);
  const result = await h.send(forgedPng);
  assert.equal(result.status, 400);
  assert.equal(h.uploads.length, 0);
});

test("tiny images are rejected without storing an unusable blog cover", async () => {
  for (const [width, height] of [[319, 300], [500, 199]]) {
    const h = harness();
    assert.equal((await h.send(await raster(width, height))).status, 400);
    assert.equal(h.uploads.length, 0);
  }
});

test("valid uploads are decoded, bounded, stripped of metadata and stored as unique WebP files", async () => {
  const image = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#145a78" } })
    .withMetadata({ exif: { IFD0: { Artist: "Private camera owner" } } }).jpeg().toBuffer();
  assert.ok((await sharp(image).metadata()).exif);
  const h = harness();
  const result = await h.send(image, { mime: "image/jpeg" });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.ok, true);
  assert.equal(h.uploads.length, 1);
  const stored = h.uploads[0];
  assert.match(stored.filename, /^[0-9a-f-]{36}\.webp$/);
  assert.deepEqual(stored.settings, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  assert.equal(body.url, `https://onftggrmmpvvwgxxzywo.supabase.co/storage/v1/object/public/blog-media/${stored.filename}`);
  const metadata = await sharp(stored.bytes).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 800);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.xmp, undefined);
  assert.ok(stored.bytes.length < maximumBytes);
  assert.equal(result.headers.get("x-content-type-options"), "nosniff");
});

test("small valid images are not enlarged and storage errors stay private", async () => {
  const image = await raster(400, 240, "webp");
  const h = harness();
  assert.equal((await h.send(image, { mime: "image/webp" })).status, 200);
  const metadata = await sharp(h.uploads[0].bytes).metadata();
  assert.equal(metadata.width, 400);
  assert.equal(metadata.height, 240);
  const broken = harness({ storageError: true });
  const response = await broken.send(image, { mime: "image/webp" });
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(await response.json()), /credentials|diagnostics/);
});
