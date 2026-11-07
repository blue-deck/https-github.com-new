import type { Metadata } from "next";
import { GuidesLibrary } from "./_components/GuidesLibrary";
import { guideBase } from "./_components/guide-index";
import { getPublishedPosts, publishedSummaries } from "./_components/published-guides";

export const dynamic = "force-dynamic";

const title = "Yacht Careers & Life Onboard | BlueDeck Blog";
const description = "Practical advice for your first yacht job, a stronger crew CV and life onboard. Take the next step in your yacht career with the BlueDeck Blog.";

export async function generateMetadata(): Promise<Metadata> {
  const first = publishedSummaries(await getPublishedPosts()).en[0];
  return {
    title,
    description,
    alternates: { canonical: guideBase },
    openGraph: {
      title, description, url: guideBase, siteName: "BlueDeck", locale: "en_US", type: "website",
      ...(first ? { images: [{ url: first.image, alt: first.imageAlt }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description, ...(first ? { images: [first.image] } : {}) },
  };
}

export default async function GuidesPage() {
  return <GuidesLibrary translations={publishedSummaries(await getPublishedPosts())} />;
}
