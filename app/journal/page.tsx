import type { Metadata } from "next";
import { crewJournalPreviews } from "../lib/crewJournal";
import { absoluteSiteUrl } from "../lib/site";
import { JournalClient } from "./JournalClient";

export const metadata: Metadata = {
  title: "Crew Journal | BlueDeck",
  description:
    "Practical guides for yacht crew: prepare for your next role, build a clear professional profile and find your rhythm on board.",
  alternates: { canonical: absoluteSiteUrl("/journal") },
  openGraph: {
    title: "Crew Journal | BlueDeck",
    description:
      "Practical perspectives on yacht careers, crew profiles and life on board.",
    url: absoluteSiteUrl("/journal"),
    type: "website",
    images: [{ url: absoluteSiteUrl("/media/journal-first-role.webp"), alt: "BlueDeck Crew Journal" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crew Journal | BlueDeck",
    description: "Practical perspectives on yacht careers, crew profiles and life on board.",
    images: [absoluteSiteUrl("/media/journal-first-role.webp")],
  },
};

export default function JournalPage() {
  return <JournalClient articles={crewJournalPreviews} />;
}
