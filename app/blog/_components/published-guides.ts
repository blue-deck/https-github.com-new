import "server-only";

import { cache } from "react";
import { blogDocumentToGuide, type BlogPost } from "../../lib/blog";
import { getPublishedBlogPost, getPublishedBlogPosts } from "../../lib/blogServer";
import type { GuideLanguage, GuideSummary } from "./guide-index";

// Request-scoped memoization keeps the page and its metadata on one snapshot.
export const getPublishedPosts = cache(getPublishedBlogPosts);
export const getPublishedPost = cache(getPublishedBlogPost);

export function publishedGuide(post: BlogPost, language: GuideLanguage) {
  if (!post.published || !post.publishedAt) throw new Error("A published blog snapshot is required.");
  return blogDocumentToGuide(post.published, language, post.publishedAt);
}

export function publishedSummaries(posts: BlogPost[]): Record<GuideLanguage, GuideSummary[]> {
  const summarize = (language: GuideLanguage): GuideSummary[] => posts.map((post) => {
    const guide = publishedGuide(post, language);
    // Never serialize article bodies or unpublished working copies into listing pages.
    return {
      slug: guide.slug,
      categoryId: guide.categoryId,
      category: guide.category,
      title: guide.title,
      description: guide.description,
      image: guide.image,
      imageAlt: guide.imageAlt,
      minutes: guide.minutes,
      date: guide.date,
      publishedAt: guide.publishedAt,
    };
  });
  return { en: summarize("en"), tr: summarize("tr") };
}
