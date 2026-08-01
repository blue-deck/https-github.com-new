import type { MetadataRoute } from "next";
import { BLUEDECK_SITE_URL } from "./lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/contact",
          "/find-crew",
          "/jobs",
          "/trust",
          "/privacy",
          "/terms",
          "/yacht-os",
        ],
        disallow: [
          "/api/",
          "/admin/",
          "/auth/",
          "/contracts",
          "/crew",
          "/dashboard",
          "/hiring",
          "/invitations/",
          "/my-blue",
          "/offline",
          "/portal",
          "/profile",
          "/settings",
          "/yachts",
        ],
      },
    ],
    host: BLUEDECK_SITE_URL,
    sitemap: `${BLUEDECK_SITE_URL}/sitemap.xml`,
  };
}
