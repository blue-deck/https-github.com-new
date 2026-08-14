import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public job search is SSR hydrated and does not issue a duplicate first fetch", async () => {
  const [page, client] = await Promise.all([
    source("app/jobs/page.tsx"),
    source("app/jobs/JobsClient.tsx"),
  ]);

  assert.match(page, /parsePublicJobSearchParams/);
  assert.match(page, /await searchPublicJobs\(parsed\.filters, null\)/);
  assert.match(page, /initialJobs=/);
  assert.match(page, /initialFilters=\{parsed\.filters\}/);
  assert.match(page, /key=\{filterKey\}/);
  assert.match(client, /skipInitialFetch\.current = true/);
  assert.match(client, /if \(skipInitialFetch\.current\)/);
});

test("client restores URL filters, advances a filter-bound cursor, and exposes both error states", async () => {
  const client = await source("app/jobs/JobsClient.tsx");

  assert.match(client, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(client, /addEventListener\("popstate"/);
  assert.match(client, /fetchJobsPage\([\s\S]*?requestedCursor/);
  assert.match(client, /publicJobSearchParams\(filters, cursor\)/);
  assert.match(client, /setLoadState\("error"\)/);
  assert.match(client, /setLoadMoreFailed\(true\)/);
  assert.match(client, /requestId !== requestSequence\.current/);
  assert.match(client, /tooManyDecimals/);
  assert.match(client, /parsedJobs\.length !== payload\.jobs\.length/);
  assert.match(client, /payload\.limit !== filters\.limit/);
  assert.match(client, /isValidNextCursor\(payload\.nextCursor, payload\.hasMore\)/);
});

test("job filters mirror crew auto-search and clear-all feedback", async () => {
  const [jobsClient, crewClient] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/find-crew/FindCrewClient.tsx"),
  ]);

  assert.match(crewClient, /}, 280\);/);
  assert.match(jobsClient, /}, 280\);/);
  assert.match(jobsClient, /aria-label=\{c\.searching\}/);
  assert.match(
    jobsClient,
    /\{c\.clear\}[\s\S]*?<span data-i18n-ignore>\(\{activeFilterCount\}\)<\/span>/,
  );
  assert.match(
    jobsClient,
    /function clearFilters\(\) \{[\s\S]*?setAdvancedOpen\(false\);[\s\S]*?createDefaultPublicJobSearchFilters\(\)/,
  );
  assert.match(jobsClient, /refreshing \? "opacity-55" : "opacity-100"/);
  assert.doesNotMatch(jobsClient, /pointer-events-none opacity-45/);
});

test("multi-select filters are exclusive and dismiss on outside click or Escape", async () => {
  const client = await source("app/jobs/JobsClient.tsx");

  assert.match(client, /name="job-multi-select"/);
  assert.match(client, /data-job-multi-select="true"/);
  assert.match(client, /onToggle=\{\(event\) => \{/);
  assert.match(client, /closeOpenJobMultiSelects\(event\.currentTarget\)/);
  assert.match(client, /document\.addEventListener\("pointerdown"/);
  assert.match(client, /event\.target\.closest\(jobMultiSelectSelector\)/);
  assert.match(client, /document\.addEventListener\("keydown"/);
  assert.match(client, /event\.key !== "Escape"/);
  assert.match(client, /querySelector<HTMLElement>\("summary"\)\?\.focus\(\)/);
  assert.match(client, /document\.removeEventListener\("pointerdown"/);
  assert.match(client, /document\.removeEventListener\("keydown"/);
});

test("Team/Couple is a binary job filter and listing fact", async () => {
  const [client, card, detail] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/jobs/PublicJobListingCard.tsx"),
    source("app/jobs/[id]/JobDetailClient.tsx"),
  ]);

  assert.match(client, /label=\{c\.teamCouple\}/);
  assert.match(client, /placeholder=\{c\.anyTeamCouple\}/);
  assert.match(client, /if \(value === "yes"\) return \["team", "couple"\]/);
  assert.match(client, /if \(value === "no"\) return \["individual"\]/);
  assert.match(
    client,
    /add\("team-couple", `\$\{c\.teamCouple\}: \$\{c\[teamCouple\]\}`/,
  );
  assert.doesNotMatch(client, /label=\{c\.candidateType\}/);
  assert.match(
    card,
    /formatJobTeamCoupleAnswer\(job\.candidateType, language\)/,
  );
  assert.match(card, /isJobTeamCouple\(job\.candidateType\) \? \(/);
  assert.match(
    card,
    /\{c\.posted\}: \{formatJobDate\(job\.publishedAt, language\)\}[\s\S]*?isJobTeamCouple\(job\.candidateType\)/,
  );
  assert.match(detail, /label: c\.teamCouple/);
  assert.match(
    detail,
    /formatJobTeamCoupleAnswer\(job\.candidateType, language\)/,
  );
  assert.doesNotMatch(detail, /individualCandidate/);
});

test("server scan uses a keyset, current activity, batched authority, and result-state binding", async () => {
  const server = await source("app/lib/publicJobSearchServer.ts");

  assert.match(server, /applyScanKeyset\(query, scanAfter\)/);
  assert.doesNotMatch(server, /\.range\(scannedRows/);
  assert.match(server, /\.gt\("closes_at", activeAt\)/);
  assert.match(server, /Promise\.all\([\s\S]*?currentPublicJobPostIds/);
  assert.match(server, /publicJobSearchResultFingerprint\(matches\)/);
  assert.match(server, /expectedResultFingerprint !== resultFingerprint/);
  assert.match(server, /status: 400/);
});

test("expensive job searches are IP limited and always return no-store responses", async () => {
  const route = await source("app/api/jobs/route.ts");

  assert.match(route, /getClientIp\(request\)/);
  assert.match(
    route,
    /consumeRequestRateLimit\([\s\S]*?120,[\s\S]*?10 \* 60 \* 1_000/,
  );
  assert.match(route, /status[^]*?429|,\s*429,/);
  assert.match(route, /"Retry-After"/);
  assert.match(route, /"Cache-Control", "no-store, max-age=0"/);
});

test("public card hydration rejects malformed identities, dates, and salary metadata", async () => {
  const parser = await source("app/jobs/job-data.ts");

  assert.match(parser, /canonicalUuidPattern\.test\(id\)/);
  assert.match(parser, /validTimestamp\(publishedAt\)/);
  assert.match(parser, /validDate\(startDate\)/);
  assert.match(parser, /isJobSalaryCurrency\(value\.currency\)/);
  assert.match(parser, /isJobSalaryPeriod\(value\.period\)/);
});
