import type { Metadata } from "next";
import { FindCrewClient } from "./FindCrewClient";
import { listDiscoverableCrewPage } from "../lib/findCrewData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find Professional Yacht Crew | BlueDeck",
  description:
    "Browse active BlueDeck yacht crew through privacy-protected profiles, filtered by position, location, availability and employment preference.",
  alternates: {
    canonical: "/find-crew",
  },
};

export default async function FindCrewPage() {
  const page = await listDiscoverableCrewPage();
  return (
    <FindCrewClient
      profiles={page.profiles}
      initialNextCursor={page.nextCursor}
      initialHasMore={page.hasMore}
    />
  );
}
