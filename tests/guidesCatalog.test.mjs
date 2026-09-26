import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { guideBase, guideHref, guideSummaries as guides, getGuideSummaries, legacyGuideSlugs } from "../app/blog/_components/guide-index.ts";

test("published guide URLs and dates are valid and unique", () => {
  assert.equal(guideBase, "/blog");
  assert.ok(guides.length > 0);
  assert.equal(new Set(guides.map(({ slug }) => slug)).size, guides.length);
  for (const guide of guides) {
    assert.match(guide.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(guideHref(guide.slug), `/blog/${guide.slug}`);
    assert.ok(Number.isFinite(Date.parse(guide.publishedAt)));
    assert.ok(guide.minutes > 0);
    assert.ok(guide.title.trim() && guide.description.trim() && guide.imageAlt.trim());
  }
});

test("English is the default and both languages share canonical blog identities", () => {
  assert.deepEqual(getGuideSummaries(), getGuideSummaries("en"));
  const english = getGuideSummaries("en");
  const turkish = getGuideSummaries("tr");
  assert.deepEqual(english.map(({ slug }) => slug), turkish.map(({ slug }) => slug));
  for (const [index, post] of english.entries()) {
    assert.notEqual(post.title, turkish[index].title);
    assert.notEqual(post.description, turkish[index].description);
    assert.notEqual(post.imageAlt, turkish[index].imageAlt);
    assert.equal(post.categoryId, turkish[index].categoryId);
    assert.equal(post.image, turkish[index].image);
  }
});

test("every former guide link resolves to a published blog article", () => {
  assert.equal(Object.keys(legacyGuideSlugs).length, 3);
  for (const slug of Object.values(legacyGuideSlugs)) {
    assert.ok(guides.some((guide) => guide.slug === slug));
  }
});

test("every published guide has its local production image", async () => {
  for (const guide of guides) {
    assert.match(guide.image, /^\/media\/guides\/[a-z0-9-]+\.webp$/);
    await access(new URL(`../public${guide.image}`, import.meta.url));
  }
});
