import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  parsePublicJobSearchParams,
  publicJobSearchParams,
} from "../lib/publicJobSearch";
import { publicJobSearchTaxonomy } from "../lib/publicJobSearchConfig";
import { searchPublicJobs } from "../lib/publicJobSearchServer";
import { consumeRequestRateLimit } from "../lib/requestRateLimitServer";
import { getClientIp } from "../lib/turnstileServer";
import { JobsClient } from "./JobsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yacht Crew Jobs | BlueDeck",
  description:
    "Browse active yacht crew opportunities published through BlueDeck.",
  alternates: {
    canonical: "/jobs",
  },
};

type JobsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const params = searchParamsFromRecord(await searchParams);
  restoreLegacyKeyword(params);

  const parsed = parsePublicJobSearchParams(params, publicJobSearchTaxonomy);
  if (!parsed.ok) redirect("/jobs");

  if (parsed.cursor) {
    const normalized = publicJobSearchParams(parsed.filters).toString();
    redirect(normalized ? `/jobs?${normalized}` : "/jobs");
  }

  const requestHeaders = await headers();
  const request = new Request("http://bluedeck.local/jobs", {
    headers: requestHeaders,
  });
  const clientIp = getClientIp(request) || "unknown";
  const rateLimit = consumeRequestRateLimit(
    `public-job-search:${clientIp}`,
    120,
    10 * 60 * 1_000,
  );
  const result = rateLimit.allowed
    ? await searchPublicJobs(parsed.filters, null)
    : {
        ok: false as const,
        error: "Too many job search requests.",
        status: 503 as const,
      };
  const filterKey = publicJobSearchParams(parsed.filters).toString() || "all";

  return (
    <JobsClient
      key={filterKey}
      initialJobs={result.ok ? result.jobs : []}
      initialTotal={result.ok ? result.total : 0}
      initialNextCursor={result.ok ? result.nextCursor : null}
      initialHasMore={result.ok ? result.hasMore : false}
      initialFilters={parsed.filters}
      initialLoadError={!result.ok}
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

function restoreLegacyKeyword(params: URLSearchParams) {
  const legacyValues = params.getAll("query");
  if (!params.has("q") && legacyValues.length === 1) {
    params.set("q", legacyValues[0]);
    params.delete("query");
  }
}
