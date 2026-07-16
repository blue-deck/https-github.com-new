import type { MetadataRoute } from "next";
import { BLUEDECK_SITE_URL } from "./lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
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
        ],
        disallow: [
          "/api/",
          "/applications",
          "/auth/",
          "/contracts",
          "/crew",
          "/dashboard",
          "/forgot-password",
          "/hiring",
          "/invitations/",
          "/login",
          "/my-blue",
          "/offline",
          "/portal",
          "/profile",
          "/reset-password",
          "/settings",
          "/signup",
          "/yachts",
        ],
      },
    ],
    sitemap: `${BLUEDECK_SITE_URL}/sitemap.xml`,
  };
}
