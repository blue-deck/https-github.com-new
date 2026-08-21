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
  assert.match(
    client,
    /isValidNextCursor\(payload\.nextCursor, payload\.hasMore\)/,
  );
});

test("job filters use explicit keyword and form searches with contextual clear actions", async () => {
  const [jobsClient, crewClient] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/find-crew/FindCrewClient.tsx"),
  ]);

  assert.match(
    jobsClient,
    /const \[draftFilters, setDraftFilters\] = useState/,
  );
  assert.match(
    jobsClient,
    /function applyKeywordSearch\(\) \{[\s\S]*?applyFilterUpdate\(\(current\) => \(\{ \.\.\.current, query \}\)\)/,
  );
  assert.match(
    jobsClient,
    /function applyAllFilters\(\) \{[\s\S]*?applyFilterUpdate\(\(\) => draftFilters\)/,
  );
  assert.match(jobsClient, /aria-label=\{c\.searchKeyword\}/);
  assert.match(jobsClient, /absolute bottom-1\.5 right-1\.5 top-1\.5/);
  assert.match(
    jobsClient,
    /const hasPrimaryDraftFilters =[\s\S]*?draftFilters\.positions\.length > 0 \|\|[\s\S]*?draftFilters\.location\.trim\(\)\.length > 0 \|\|[\s\S]*?draftFilters\.employmentTypes\.length > 0/,
  );
  const primaryVisibility = jobsClient.slice(
    jobsClient.indexOf("const hasPrimaryDraftFilters"),
    jobsClient.indexOf("const optionSets"),
  );
  assert.doesNotMatch(primaryVisibility, /draftFilters\.query/);
  assert.match(
    jobsClient,
    /!advancedOpen && hasPrimaryDraftFilters \? "pb-11" : ""/,
  );
  assert.match(
    jobsClient,
    /!advancedOpen \? \([\s\S]*?<JobFilterSearchButton[\s\S]*?\{hasPrimaryDraftFilters \? \([\s\S]*?<JobFilterClearAction[\s\S]*?className="absolute right-0 top-full mt-1 whitespace-nowrap"/,
  );
  assert.match(
    jobsClient,
    /id="advanced-job-filters"[\s\S]*?className="mt-4 flex items-center justify-end gap-4"[\s\S]*?<JobFilterClearAction[\s\S]*?<JobFilterSearchButton/,
  );
  const clearFilters = jobsClient.slice(
    jobsClient.indexOf("function clearFilters()"),
    jobsClient.indexOf("function removeAppliedFilter"),
  );
  assert.doesNotMatch(clearFilters, /setAdvancedOpen/);
  assert.match(jobsClient, /setDraftFilters\(emptyFilters\)/);
  const sharedClearStyle =
    "inline-flex min-h-11 items-center justify-center px-1 text-sm font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-cyan-900";
  assert.ok(jobsClient.includes(sharedClearStyle));
  assert.ok(crewClient.includes(sharedClearStyle));
  assert.match(jobsClient, /search: "Keyword"/);
  assert.match(
    jobsClient,
    /searchPlaceholder: "Position, skill, language or any"/,
  );
  assert.match(jobsClient, /search: "Anahtar kelime"/);
  assert.match(
    jobsClient,
    /searchPlaceholder: "Pozisyon, beceri, dil veya herhangi bir anahtar kelime"/,
  );
  assert.doesNotMatch(jobsClient, /Position, skill, language or location/);
  assert.doesNotMatch(jobsClient, /Pozisyon, beceri, dil veya konum/);
  assert.match(jobsClient, /employmentType: "Employment type"/);
  assert.match(jobsClient, /capitalizeSearch[\s\S]*?searchLocale=\{language\}/);
  const salaryNumberField = jobsClient.slice(
    jobsClient.indexOf("function NumberField"),
    jobsClient.indexOf("function RangeField"),
  );
  assert.match(salaryNumberField, /\[appearance:textfield\]/);
  assert.match(
    salaryNumberField,
    /\[&::-webkit-inner-spin-button\]:appearance-none/,
  );
  assert.match(
    salaryNumberField,
    /\[&::-webkit-outer-spin-button\]:appearance-none/,
  );
  const rangeNumberField = jobsClient.slice(
    jobsClient.indexOf("function RangeField"),
    jobsClient.indexOf("function FilterSelect"),
  );
  assert.equal(
    rangeNumberField.match(/\[appearance:textfield\]/g)?.length,
    2,
  );
  assert.equal(
    rangeNumberField.match(
      /\[&::-webkit-inner-spin-button\]:appearance-none/g,
    )?.length,
    2,
  );
  assert.equal(
    rangeNumberField.match(
      /\[&::-webkit-outer-spin-button\]:appearance-none/g,
    )?.length,
    2,
  );
  assert.doesNotMatch(jobsClient, /\{advancedFilterCount\}/);
  assert.match(jobsClient, /aria-label=\{c\.searching\}/);
  assert.match(jobsClient, /refreshing \? "opacity-55" : "opacity-100"/);
  assert.doesNotMatch(jobsClient, /pointer-events-none opacity-45/);
});

test("published requirements expose only language and visa filters", async () => {
  const [client, search, config] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/lib/publicJobSearch.ts"),
    source("app/lib/publicJobSearchConfig.ts"),
  ]);

  assert.doesNotMatch(client, /label=\{c\.(characteristics|certificates)\}/);
  assert.doesNotMatch(search, /requiredCharacteristics: JobCharacteristic\[\]/);
  assert.doesNotMatch(search, /requiredCertificates: JobCertificate\[\]/);
  assert.doesNotMatch(search, /setList\(params, "(trait|certificate)"/);
  assert.doesNotMatch(client, /label=\{c\.(smoking|visibleTattoos)\}/);
  assert.doesNotMatch(search, /(smokerPolicies|visibleTattooPolicies):/);
  assert.doesNotMatch(search, /setList\(params, "(smoker|tattoo)"/);
  assert.doesNotMatch(config, /(smokerPolicies|visibleTattooPolicies):/);
});

test("advanced job filters use one flat responsive grid without dropping controls", async () => {
  const client = await source("app/jobs/JobsClient.tsx");
  const start = client.indexOf("{advancedOpen ? (");
  const end = client.indexOf("{draftValidationError ? (", start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const advanced = client.slice(start, end);
  assert.doesNotMatch(advanced, /<FilterGroup\b/);
  assert.doesNotMatch(
    advanced,
    /c\.(roleAndContract|yachtDetails|requirements|salaryAndDisplay)\b/,
  );
  assert.doesNotMatch(client, /function FilterGroup\(/);
  assert.doesNotMatch(
    client,
    /\b(roleAndContract|yachtDetails|requirements|salaryAndDisplay):/,
  );
  assert.match(
    advanced,
    /grid-cols-1[^"\n]*sm:grid-cols-2[^"\n]*lg:grid-cols-3/,
  );

  const labels = [
    ...advanced.matchAll(
      /<(?:MultiSelectField|FilterSelect|RangeField|NumberField)\b[\s\S]*?\blabel=\{c\.([A-Za-z]+)\}/g,
    ),
  ]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    labels,
    [
      "department",
      "teamCouple",
      "minimumExperience",
      "yachtType",
      "yachtFlag",
      "yachtLength",
      "crewCount",
      "languages",
      "visas",
      "currency",
      "payPeriod",
      "minimumSalary",
      "maximumSalary",
    ].sort(),
  );

  const optionSets = [
    ...advanced.matchAll(/\boptions=\{optionSets\.([A-Za-z]+)\}/g),
  ]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    optionSets,
    [
      "departments",
      "teamCouple",
      "minimumExperiences",
      "yachtTypes",
      "flags",
      "languages",
      "visas",
      "salaryCurrencies",
      "salaryPeriods",
    ].sort(),
  );
});

test("yacht brand remains job data but is not exposed as a public job filter", async () => {
  const [client, search] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/lib/publicJobSearch.ts"),
  ]);

  assert.doesNotMatch(client, /label=\{c\.yachtBrand\}/);
  assert.doesNotMatch(client, /draftFilters\.yachtBrand/);
  assert.doesNotMatch(search, /yachtBrand: string;/);
  assert.doesNotMatch(search, /setText\(params, "yachtBrand"/);
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

test("Team/Couple stays a binary filter while Any listings match either choice", async () => {
  const [client, card, detail, search, config] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/jobs/PublicJobListingCard.tsx"),
    source("app/jobs/[id]/JobDetailClient.tsx"),
    source("app/lib/publicJobSearch.ts"),
    source("app/lib/publicJobSearchConfig.ts"),
  ]);

  assert.match(client, /label=\{c\.teamCouple\}/);
  assert.match(client, /placeholder=\{c\.anyTeamCouple\}/);
  assert.match(client, /if \(value === "yes"\) return \["team", "couple"\]/);
  assert.match(client, /if \(value === "no"\) return \["individual"\]/);
  assert.match(search, /return value === "any" \|\| includesSelected\(selected, value\)/);
  assert.match(
    config,
    /candidateTypes: jobCandidateTypes\.filter\(\(value\) => value !== "any"\)/,
  );
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
