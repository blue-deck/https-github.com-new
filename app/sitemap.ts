import type { MetadataRoute } from "next";
import { getPublicJobSitemapEntries } from "./lib/jobs/queries";
import { BLUEDECK_SITE_URL } from "./lib/site";

export const revalidate = 3600;

const publicRoutes = [
  "",
  "/jobs",
  "/for-crew",
  "/hire-crew",
  "/services",
  "/management",
  "/trust",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const jobs = await getPublicJobSitemapEntries();

  return [
    ...publicRoutes.map((route) => ({
      url: `${BLUEDECK_SITE_URL}${route}`,
      lastModified: now,
      changeFrequency: route ? ("monthly" as const) : ("weekly" as const),
      priority: route ? 0.7 : 1,
    })),
    ...jobs.map((job) => ({
      url: `${BLUEDECK_SITE_URL}/jobs/${encodeURIComponent(job.slug)}`,
      lastModified: job.updatedAt ? new Date(job.updatedAt) : now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
