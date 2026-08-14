import type { Metadata } from "next";
import { FindCrewClient } from "./FindCrewClient";
import { listDiscoverableCrewPage } from "../lib/findCrewData";
import {
  crewSearchFingerprintInput,
  parseCrewSearchFilters,
} from "../lib/crewSearch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Find Professional Yacht Crew | BlueDeck",
  description:
    "Browse active BlueDeck yacht crew through privacy-protected profiles, filtered by position, availability and profile criteria.",
  alternates: {
    canonical: "/find-crew",
  },
};

type FindCrewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FindCrewPage({
  searchParams,
}: FindCrewPageProps) {
  const filters = parseCrewSearchFilters(await searchParams);
  const page = await listDiscoverableCrewPage("", filters);
  return (
    <FindCrewClient
      key={crewSearchFingerprintInput(filters)}
      profiles={page.profiles}
      initialNextCursor={page.nextCursor}
      initialHasMore={page.hasMore}
      initialTotal={page.total}
      initialFacets={page.facets}
      initialFilters={filters}
    />
  );
}
