import type { MetadataRoute } from "next";
import { BLUEDECK_SITE_URL } from "./lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/services", "/find-crew", "/trust", "/about", "/contact", "/privacy", "/terms"],
        disallow: [
          "/api/",
          "/auth/",
          "/contracts",
          "/crew",
          "/dashboard",
          "/invitations/",
          "/profile",
          "/settings",
          "/yachts",
        ],
      },
    ],
    sitemap: `${BLUEDECK_SITE_URL}/sitemap.xml`,
  };
}
