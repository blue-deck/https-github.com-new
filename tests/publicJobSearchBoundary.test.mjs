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
