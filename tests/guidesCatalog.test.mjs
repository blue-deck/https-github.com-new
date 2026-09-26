import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { guideBase, guideHref, guideSummaries as guides } from "../app/guides/_components/guide-index.ts";

test("published guide URLs and dates are valid and unique", () => {
  assert.equal(guideBase, "/guides");
  assert.ok(guides.length > 0);
  assert.equal(new Set(guides.map(({ slug }) => slug)).size, guides.length);
  for (const guide of guides) {
    assert.match(guide.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(guideHref(guide.slug), `/guides/${guide.slug}`);
    assert.ok(Number.isFinite(Date.parse(guide.publishedAt)));
    assert.ok(guide.minutes > 0);
    assert.ok(guide.title.trim() && guide.description.trim() && guide.imageAlt.trim());
  }
});

test("every published guide has its local production image", async () => {
  for (const guide of guides) {
    assert.match(guide.image, /^\/media\/guides\/[a-z0-9-]+\.webp$/);
    await access(new URL(`../public${guide.image}`, import.meta.url));
  }
});
