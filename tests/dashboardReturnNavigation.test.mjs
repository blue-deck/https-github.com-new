import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Captain Workspace, My Applications, and Contracts expose the shared dashboard return control", async () => {
  const pages = [
    {
      path: "app/yachts/page.tsx",
      contentMarker: '<div className="bd-glass-card-strong overflow-hidden rounded-[34px]">',
    },
    {
      path: "app/portal/applications/MyJobApplicationsPortal.tsx",
      contentMarker: '<section className="relative overflow-hidden rounded-[30px]',
    },
    {
      path: "app/contracts/page.tsx",
      contentMarker: '<header className="bd-glass-card-strong rounded-[34px] p-8">',
    },
  ];

  for (const page of pages) {
    const pageSource = await source(page.path);
    const backLinkIndex = pageSource.indexOf('href="/dashboard"');
    const contentIndex = pageSource.indexOf(page.contentMarker);

    assert.ok(backLinkIndex >= 0, `${page.path} must link back to the dashboard`);
    assert.ok(contentIndex > backLinkIndex, `${page.path} must place the return control before its hero`);
    assert.match(pageSource, /aria-label="Back to dashboard"/);
    assert.match(pageSource, /title="Back to dashboard"/);
    assert.match(pageSource, /<ChevronLeft className="h-4 w-4" aria-hidden \/>/);
  }
});
