import type { Metadata } from "next";
import { GuidesLibrary } from "./_components/GuidesLibrary";
import { guideBase, guideSummaries as guides } from "./_components/guide-index";

const title = "Yacht Careers & Life Onboard | BlueDeck Blog";
const description = "Practical advice for your first yacht job, a stronger crew CV and life onboard. Take the next step in your yacht career with the BlueDeck Blog.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: guideBase },
  openGraph: {
    title, description, url: guideBase, siteName: "BlueDeck", locale: "en_US", type: "website",
    images: [{ url: guides[0].image, width: 1440, height: 960, alt: guides[0].imageAlt }],
  },
  twitter: { card: "summary_large_image", title, description, images: [guides[0].image] },
};

export default function GuidesPage() {
  return <GuidesLibrary />;
}
