import type { MetadataRoute } from "next";
import { BLUEDECK_SITE_URL } from "./lib/site";
import { guideBase, guideHref } from "./blog/_components/guide-index";
import { getPublishedPosts } from "./blog/_components/published-guides";

export const dynamic = "force-dynamic";

const publicRoutes = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/jobs", changeFrequency: "daily", priority: 0.95 },
  { path: "/find-crew", changeFrequency: "daily", priority: 0.9 },
  { path: "/yacht-os", changeFrequency: "monthly", priority: 0.9 },
  { path: "/trust", changeFrequency: "yearly", priority: 0.6 },
  { path: "/about", changeFrequency: "yearly", priority: 0.6 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.55 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPosts();
  return [...publicRoutes.map((route) => ({
    url: `${BLUEDECK_SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  })), {
    url: `${BLUEDECK_SITE_URL}${guideBase}`,
    changeFrequency: "weekly",
    priority: 0.75,
  }, ...posts.filter((post) => post.published).map((post) => ({
    url: `${BLUEDECK_SITE_URL}${guideHref(post.published!.slug)}`,
    lastModified: post.publishedUpdatedAt ?? post.publishedAt ?? undefined,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }))];
}
