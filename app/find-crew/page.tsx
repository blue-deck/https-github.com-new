import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FindCrewClient } from "./FindCrewClient";
import { listDiscoverableCrewPage } from "../lib/findCrewData";
import {
  crewSearchFingerprintInput,
  crewSearchParams,
} from "../lib/crewSearch";
import { parseCrewSearchRequest } from "../lib/crewSearchRequest";

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
  const params = searchParamsFromRecord(await searchParams);
  const parsed = parseCrewSearchRequest(params);
  if (!parsed.ok) redirect("/find-crew");
  if (parsed.cursor) {
    const normalized = crewSearchParams(parsed.filters).toString();
    redirect(normalized ? `/find-crew?${normalized}` : "/find-crew");
  }

  const filters = parsed.filters;
  const page = await listDiscoverableCrewPage("", filters);
  return (
    <FindCrewClient
      key={crewSearchFingerprintInput(filters)}
      profiles={page.profiles}
      initialNextCursor={page.nextCursor}
      initialHasMore={page.hasMore}
      initialTotal={page.total}
      initialFilters={filters}
    />
  );
}

function searchParamsFromRecord(
  values: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params;
}
