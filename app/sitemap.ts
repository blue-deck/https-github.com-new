import type { MetadataRoute } from "next";
import { BLUEDECK_SITE_URL } from "./lib/site";

const publicRoutes = [
  "",
  "/services",
  "/trust",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/forgot-password",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: `${BLUEDECK_SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route ? "monthly" : "weekly",
    priority: route ? 0.7 : 1,
  }));
}
