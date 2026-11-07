import type { Guide } from "../blog/_components/guide-data";

export type BlogLanguage = "en" | "tr";
export type BlogCategoryId = "career" | "cv-profile" | "onboard-life";
export type BlogSection = { id: string; title: string; paragraphs: string[]; bullets?: string[] };
export type BlogTranslation = {
  title: string; description: string; imageAlt: string; takeaway: string;
  sections: BlogSection[]; checklist: string[];
  ctaTitle: string; ctaDescription: string; ctaLabel: string; ctaHref: string;
  seoTitle: string; seoDescription: string;
};
export type BlogDocument = {
  slug: string; categoryId: BlogCategoryId; coverImage: string; author: string;
  content: Partial<Record<BlogLanguage, BlogTranslation>>;
};
export type BlogPost = {
  id: string; status: "draft" | "published" | "archived";
  draft: BlogDocument; published: BlogDocument | null;
  publishedAt: string | null; publishedUpdatedAt: string | null;
  createdAt: string; updatedAt: string; version: number;
};
export type BlogGuide = Guide & { author: string; seoTitle: string; seoDescription: string; language: BlogLanguage };
export const BLOG_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const BLOG_DOCUMENT_MAX_BYTES = 256 * 1024;
export const BLOG_CATEGORIES: BlogCategoryId[] = ["career", "cv-profile", "onboard-life"];
const categories = {
  en: { career: "Career", "cv-profile": "CV & Profile", "onboard-life": "Life on board" },
  tr: { career: "Kariyer", "cv-profile": "CV & Profil", "onboard-life": "Teknede yaşam" },
};

export function createEmptyBlogTranslation(): BlogTranslation {
  return { title: "", description: "", imageAlt: "", takeaway: "", sections: [], checklist: [],
    ctaTitle: "", ctaDescription: "", ctaLabel: "", ctaHref: "", seoTitle: "", seoDescription: "" };
}
export function createEmptyBlogDocument(): BlogDocument {
  return { slug: "", categoryId: "career", coverImage: "", author: "BlueDeck Blog", content: { tr: createEmptyBlogTranslation() } };
}
export function blogSlug(value: string): string {
  return value.toLowerCase().replace(/ı/g, "i").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100).replace(/-+$/g, "");
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function cleanString(value: unknown, maximum: number): string | null {
  if (typeof value !== "string" || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null;
  return value.trim();
}
function stringList(value: unknown, maximumItems: number, maximumLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const items = value.map((item) => cleanString(item, maximumLength));
  return items.some((item) => item === null) ? null : items as string[];
}
export function isBlogCoverImage(value: string): boolean {
  return /^\/media\/guides\/[a-z0-9-]+\.webp$/.test(value) ||
    /^https:\/\/onftggrmmpvvwgxxzywo\.supabase\.co\/storage\/v1\/object\/public\/blog-media\/[a-f0-9-]+\.webp$/.test(value);
}
function safeCtaHref(value: string): boolean {
  return /^\/(?!\/)[a-zA-Z0-9/_?&=.#%-]*$/.test(value) && !/%(?:0a|0d|2f|5c)/i.test(value);
}

export function validateBlogDocument(input: unknown, forPublish = false):
  { ok: true; document: BlogDocument } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!record(input) || JSON.stringify(input).length > BLOG_DOCUMENT_MAX_BYTES) return fail("Invalid blog document.");
  const slug = cleanString(input.slug, 100);
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return fail("Enter a URL slug using lowercase letters, numbers and hyphens.");
  if (!BLOG_CATEGORIES.includes(input.categoryId as BlogCategoryId)) return fail("Choose a valid category.");
  const coverImage = cleanString(input.coverImage, 500);
  if (coverImage === null || (coverImage && !isBlogCoverImage(coverImage))) return fail("Upload a valid cover image.");
  if (forPublish && !coverImage) return fail("Add a cover image before publishing.");
  const author = cleanString(input.author, 100);
  if (author === null || (forPublish && !author)) return fail("Enter an author name (up to 100 characters).");
  if (!record(input.content) || Object.keys(input.content).some((language) => language !== "en" && language !== "tr")) return fail("Invalid article languages.");
  const content: BlogDocument["content"] = {};
  for (const language of ["en", "tr"] as const) {
    const raw = input.content[language];
    if (raw === undefined || raw === null) continue;
    if (!record(raw)) return fail("Invalid article content.");
    const limits = { title: 180, description: 500, imageAlt: 300, takeaway: 1500,
      ctaTitle: 180, ctaDescription: 700, ctaLabel: 80, ctaHref: 500, seoTitle: 100, seoDescription: 300 };
    const translation = createEmptyBlogTranslation();
    for (const [key, limit] of Object.entries(limits)) {
      const value = cleanString(raw[key], limit);
      if (value === null) return fail(`${language.toUpperCase()}: ${key} is invalid or too long (maximum ${limit}).`);
      (translation as unknown as Record<string, unknown>)[key] = value;
    }
    if (translation.ctaHref && !safeCtaHref(translation.ctaHref)) return fail("The call-to-action link must be a safe page on this site, starting with /.");
    if (!Array.isArray(raw.sections) || raw.sections.length > 40) return fail("Use up to 40 article sections.");
    const sectionIds = new Set<string>();
    for (const section of raw.sections) {
      if (!record(section)) return fail("Invalid article section.");
      const id = cleanString(section.id, 100);
      const title = cleanString(section.title, 180);
      const paragraphs = stringList(section.paragraphs, 50, 8000);
      const bullets = section.bullets === undefined ? undefined : stringList(section.bullets, 40, 1500);
      if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id === "checklist" || sectionIds.has(id) || title === null || !paragraphs || bullets === null) return fail("Each section needs a unique ID and valid text.");
      if (forPublish && (!title || (!paragraphs.some(Boolean) && !bullets?.some(Boolean)))) return fail(`${language.toUpperCase()}: each section needs a heading and text.`);
      sectionIds.add(id);
      translation.sections.push({ id, title, paragraphs: paragraphs.filter(Boolean), ...(bullets ? { bullets: bullets.filter(Boolean) } : {}) });
    }
    const checklist = stringList(raw.checklist, 40, 500);
    if (!checklist) return fail("Use up to 40 checklist items (500 characters each).");
    translation.checklist = checklist.filter(Boolean);
    if (forPublish && (!translation.title || !translation.description || !translation.imageAlt || !translation.sections.length)) return fail(`${language.toUpperCase()}: add a title, summary, image description and at least one section.`);
    if (forPublish && [translation.ctaTitle, translation.ctaDescription, translation.ctaLabel, translation.ctaHref].some(Boolean) && ![translation.ctaTitle, translation.ctaDescription, translation.ctaLabel, translation.ctaHref].every(Boolean)) return fail(`${language.toUpperCase()}: complete all four call-to-action fields or leave them empty.`);
    content[language] = translation;
  }
  if (!Object.keys(content).length) return fail("Add content in at least one language.");
  return { ok: true, document: { slug, categoryId: input.categoryId as BlogCategoryId, coverImage, author, content } };
}

export function blogDocumentToGuide(document: BlogDocument, language: BlogLanguage, publishedAt: string | null): BlogGuide {
  const actualLanguage = document.content[language] ? language : document.content.en ? "en" : "tr";
  const content = document.content[actualLanguage] ?? createEmptyBlogTranslation();
  const words = [content.title, content.description, content.takeaway, ...content.sections.flatMap((section) => [section.title, ...section.paragraphs, ...(section.bullets ?? [])]), ...content.checklist].join(" ").trim().split(/\s+/).length;
  const published = publishedAt && Number.isFinite(Date.parse(publishedAt)) ? publishedAt : "";
  return { ...content, slug: document.slug, categoryId: document.categoryId, category: categories[actualLanguage][document.categoryId],
    image: document.coverImage, minutes: Math.max(1, Math.ceil(words / 200)),
    publishedAt: published, date: published ? new Date(published).toLocaleDateString(actualLanguage === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }) : "",
    author: document.author || "BlueDeck Blog", language: actualLanguage };
}
