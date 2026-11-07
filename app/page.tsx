import type { Metadata } from "next";
import localFont from "next/font/local";
import HomePageClient from "./HomePageClient";
import { getPublishedPosts, publishedSummaries } from "./blog/_components/published-guides";

export const dynamic = "force-dynamic";

const heroFont = localFont({
  src: "./fonts/michroma/Michroma-Regular.ttf",
  weight: "400",
  display: "swap",
  variable: "--font-bluedeck-display",
});

export const metadata: Metadata = {
  title: "BlueDeck | Yacht Careers, Crew & Operations",
  description:
    "Discover yacht jobs, find professional crew and manage private yacht operations through one connected BlueDeck platform.",
  alternates: {
    canonical: "/",
  },
};

export default async function HomePage() {
  const posts = await getPublishedPosts().catch(() => {
    // Keep the rest of the homepage available during a temporary blog outage.
    console.error("[blog] homepage publications unavailable");
    return [];
  });
  const blogTranslations = publishedSummaries(posts);
  return <HomePageClient heroFontClassName={heroFont.variable} blogTranslations={blogTranslations} />;
}
