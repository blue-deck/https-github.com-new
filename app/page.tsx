import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";
import { crewJournalPreviews } from "./lib/crewJournal";

export const metadata: Metadata = {
  title: "BlueDeck | Yacht Careers, Crew & Operations",
  description:
    "Discover yacht jobs, find professional crew and manage private yacht operations through one connected BlueDeck platform.",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return <HomePageClient articles={crewJournalPreviews} />;
}
