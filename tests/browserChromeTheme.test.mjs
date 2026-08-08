import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("browser chrome stays white across regular, installed, and offline routes", async () => {
  const [layout, globalStyles, manifest, serviceWorker] = await Promise.all([
    source("app/layout.tsx"),
    source("app/globals.css"),
    source("app/manifest.ts"),
    source("public/sw.js"),
  ]);

  assert.match(layout, /statusBarStyle:\s*"default"/);
  assert.match(layout, /themeColor:\s*"#ffffff"/);
  assert.doesNotMatch(layout, /themeColor:\s*"#071631"/);

  assert.match(globalStyles, /html\s*\{[^}]*background:\s*#ffffff;/);

  assert.match(manifest, /theme_color:\s*"#ffffff"/);
  assert.doesNotMatch(manifest, /theme_color:\s*"#071631"/);

  assert.match(
    serviceWorker,
    /<meta name="theme-color" content="#ffffff" \/>/,
  );
  assert.doesNotMatch(
    serviceWorker,
    /<meta name="theme-color" content="#071631" \/>/,
  );
});
