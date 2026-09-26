import type { MetadataRoute } from "next";
import { BLUEDECK_SITE_URL } from "./lib/site";
import { guideBase, guideHref, guideSummaries as guides } from "./guides/_components/guide-index";

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

export default function sitemap(): MetadataRoute.Sitemap {
  return [...publicRoutes.map((route) => ({
    url: `${BLUEDECK_SITE_URL}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  })), {
    url: `${BLUEDECK_SITE_URL}${guideBase}`,
    changeFrequency: "weekly",
    priority: 0.75,
  }, ...guides.map((guide) => ({
    url: `${BLUEDECK_SITE_URL}${guideHref(guide.slug)}`,
    lastModified: guide.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }))];
}
