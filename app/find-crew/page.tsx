import type { Metadata } from "next";
import { FindCrewClient } from "./FindCrewClient";
import { listDiscoverableCrew } from "../lib/findCrewData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find Professional Yacht Crew | BlueDeck",
  description:
    "Search discoverable BlueDeck yacht crew profiles by position, location, availability and employment preference.",
  alternates: {
    canonical: "/find-crew",
  },
};

export default async function FindCrewPage() {
  const profiles = await listDiscoverableCrew();
  return <FindCrewClient profiles={profiles} />;
}
