import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { guideBase, guideHref, guideSummaries as guides, getGuideSummaries, legacyGuideSlugs } from "../app/blog/_components/guide-index.ts";
import { blogDocumentToGuide, createEmptyBlogTranslation } from "../app/lib/blog.ts";

test("seed article URLs and dates are valid and unique", () => {
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

test("every former guide link maps to a preserved seed article identity", () => {
  assert.equal(Object.keys(legacyGuideSlugs).length, 3);
  for (const slug of Object.values(legacyGuideSlugs)) {
    assert.ok(guides.some((guide) => guide.slug === slug));
  }
});

test("every seed article retains its local production cover", async () => {
  for (const guide of guides) {
    assert.match(guide.image, /^\/media\/guides\/[a-z0-9-]+\.webp$/);
    await access(new URL(`../public${guide.image}`, import.meta.url));
  }
});

test("published documents supply localized metadata while preserving canonical URLs and covers", () => {
  for (const seed of guides) {
    const translations = Object.fromEntries(["en", "tr"].map((language) => {
      const summary = getGuideSummaries(language).find((item) => item.slug === seed.slug);
      return [language, {
        ...createEmptyBlogTranslation(),
        title: summary.title,
        description: summary.description,
        imageAlt: summary.imageAlt,
        seoTitle: `SEO ${language}: ${summary.title}`,
        seoDescription: `SEO ${language}: ${summary.description}`,
        sections: [{ id: "introduction", title: "Introduction", paragraphs: ["A published article paragraph."], bullets: [] }],
      }];
    }));
    const document = { slug: seed.slug, categoryId: seed.categoryId, coverImage: seed.image, author: "BlueDeck editorial team", content: translations };
    for (const language of ["en", "tr"]) {
      const guide = blogDocumentToGuide(document, language, seed.publishedAt);
      assert.equal(guide.slug, seed.slug);
      assert.equal(guide.image, seed.image);
      assert.equal(guide.publishedAt, seed.publishedAt);
      assert.equal(guide.language, language);
      assert.equal(guide.title, translations[language].title);
      assert.equal(guide.seoTitle, translations[language].seoTitle);
      assert.equal(guide.seoDescription, translations[language].seoDescription);
      assert.equal(guide.author, "BlueDeck editorial team");
      assert.equal(guide.minutes, 1);
      assert.notEqual(guide.date, "Invalid Date");
    }
  }
});

test("a single-language publication has a readable fallback and unpublished previews have no invented date", () => {
  const content = { ...createEmptyBlogTranslation(), title: "Teknede yaşam", description: "Türkçe yazı", imageAlt: "Bir yat" };
  const document = { slug: "new-post", categoryId: "onboard-life", coverImage: guides[0].image, author: "BlueDeck Blog", content: { tr: content } };
  const fallback = blogDocumentToGuide(document, "en", guides[0].publishedAt);
  assert.equal(fallback.language, "tr");
  assert.equal(fallback.title, content.title);
  assert.equal(fallback.category, "Teknede yaşam");
  assert.equal(fallback.slug, "new-post");
  assert.equal(fallback.image, guides[0].image);
  const preview = blogDocumentToGuide(document, "tr", null);
  assert.equal(preview.publishedAt, "");
  assert.equal(preview.date, "");
});
