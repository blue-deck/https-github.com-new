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

test("Find Jobs opens directly on filters without the promotional hero", async () => {
  const client = await source("app/jobs/JobsClient.tsx");

  assert.match(
    client,
    /<main id="main-content">\s*<h1 className="sr-only">\{c\.pageTitle\}<\/h1>\s*<section\s+id="jobs-board"/,
  );
  assert.doesNotMatch(client, /c\.(eyebrow|title|intro)/);
  assert.doesNotMatch(client, /Your next role may already be on deck/);
  assert.doesNotMatch(client, /Search every detail employers publish/);
  assert.doesNotMatch(client, /Sıradaki göreviniz güvertede sizi bekliyor olabilir/);
  assert.doesNotMatch(client, /İşverenlerin yayınladığı yat özelliklerinden/);
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
  assert.match(client, /maximumJobSalaryAmount/);
  assert.match(client, /Number\.isSafeInteger\(value\)/);
  assert.match(client, /parsedJobs\.length !== payload\.jobs\.length/);
  assert.match(client, /payload\.limit !== filters\.limit/);
  assert.match(
    client,
    /isValidNextCursor\(payload\.nextCursor, payload\.hasMore\)/,
  );
});

test("job filters use explicit searches and clear actions without selection summaries", async () => {
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
  const sharedKeywordButtonStyle =
    "bd-focus absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-cyan-700 transition hover:bg-cyan-50 hover:text-cyan-950";
  assert.ok(jobsClient.includes(sharedKeywordButtonStyle));
  assert.ok(crewClient.includes(sharedKeywordButtonStyle));
  const sharedMoreFiltersButtonStyle =
    "bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-cyan-500 hover:text-cyan-900";
  assert.ok(jobsClient.includes(sharedMoreFiltersButtonStyle));
  assert.ok(crewClient.includes(sharedMoreFiltersButtonStyle));
  const jobsMoreFiltersControl = jobsClient.indexOf(
    'aria-controls="advanced-job-filters"',
  );
  const jobsMoreFiltersButton = jobsClient.slice(
    jobsClient.lastIndexOf("<button", jobsMoreFiltersControl),
    jobsClient.indexOf("</button>", jobsMoreFiltersControl),
  );
  assert.doesNotMatch(jobsMoreFiltersButton, /<Filter\b/);
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
    /id="advanced-job-filters"[\s\S]*?className="mt-4 flex items-center justify-end gap-4 border-t border-slate-200 pt-4"[\s\S]*?<JobFilterClearAction[\s\S]*?<JobFilterSearchButton/,
  );
  const clearFilters = jobsClient.slice(
    jobsClient.indexOf("function clearFilters()"),
    jobsClient.indexOf("function updateSort"),
  );
  assert.doesNotMatch(clearFilters, /setAdvancedOpen/);
  assert.match(jobsClient, /setDraftFilters\(emptyFilters\)/);
  assert.doesNotMatch(
    jobsClient,
    /ActiveFilterChip|activeFilters|buildActiveFilterChips|removeAppliedFilter|keywordChip|locationChip/,
  );
  const sharedClearStyle =
    "inline-flex min-h-11 items-center justify-center px-1 text-sm font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-cyan-900";
  assert.ok(jobsClient.includes(sharedClearStyle));
  assert.ok(crewClient.includes(sharedClearStyle));
  assert.match(jobsClient, /search: "Keyword"/);
  assert.match(crewClient, /search: "Keyword"/);
  assert.match(
    jobsClient,
    /searchPlaceholder: "Position, skill, language or any"/,
  );
  assert.match(jobsClient, /search: "Anahtar kelime"/);
  assert.match(jobsClient, /advanced: "More filters"/);
  assert.match(jobsClient, /advanced: "Daha fazla filtre"/);
  assert.doesNotMatch(
    jobsClient,
    /advanced: "(?:Advanced filters|Gelişmiş filtreler)"/,
  );
  assert.match(crewClient, /search: "Anahtar kelime"/);
  assert.match(
    jobsClient,
    /searchPlaceholder: "Pozisyon, beceri, dil veya herhangi bir anahtar kelime"/,
  );
  assert.doesNotMatch(jobsClient, /Position, skill, language or location/);
  assert.doesNotMatch(jobsClient, /Pozisyon, beceri, dil veya konum/);
  assert.match(jobsClient, /employmentType: "Employment type"/);
  assert.match(jobsClient, /capitalizeSearch[\s\S]*?searchLocale=\{language\}/);
  assert.doesNotMatch(jobsClient, /function NumberField\(/);
  assert.doesNotMatch(jobsClient, /readNullableNumber/);
  assert.doesNotMatch(jobsClient, /function RangeField\(/);
  assert.doesNotMatch(jobsClient, /\{advancedFilterCount\}/);
  assert.match(jobsClient, /aria-label=\{c\.searching\}/);
  assert.match(jobsClient, /refreshing \? "opacity-55" : "opacity-100"/);
  assert.doesNotMatch(jobsClient, /pointer-events-none opacity-45/);
});

test("Find Jobs reuses the Create Job Post location search without auto-applying it", async () => {
  const [jobsClient, manager, locationSearch] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/hiring/jobs/JobPostsManager.tsx"),
    source("app/components/LocationSearchField.tsx"),
  ]);

  assert.match(
    jobsClient,
    /import \{ LocationSearchField \} from "\.\.\/components\/LocationSearchField"/,
  );
  assert.match(manager, /<LocationSearchField/);
  assert.match(
    jobsClient,
    /<LocationSearchField[\s\S]*?value=\{draftFilters\.location\}[\s\S]*?searchingText=\{c\.locationSearching\}[\s\S]*?noResultsText=\{c\.locationNoResults\}[\s\S]*?resultsText=\{c\.locationResults\}[\s\S]*?maxLength=\{120\}/,
  );
  const locationField = jobsClient.slice(
    jobsClient.indexOf("<LocationSearchField"),
    jobsClient.indexOf(
      "<MultiSelectField",
      jobsClient.indexOf("<LocationSearchField"),
    ),
  );
  assert.match(locationField, /updateDraftFilters/);
  assert.doesNotMatch(locationField, /applyFilterUpdate|applyAllFilters/);
  assert.match(locationField, /popupClassName="absolute left-0 top-full z-50/);
  assert.match(
    locationField,
    /popupListClassName="max-h-72 overflow-y-auto overscroll-contain"/,
  );
  assert.doesNotMatch(jobsClient, /function TextField\(/);

  assert.match(
    locationSearch,
    /https:\/\/geocoding-api\.open-meteo\.com\/v1\/search/,
  );
  assert.match(locationSearch, /}, 450\)/);
  assert.match(locationSearch, /event\.key === "ArrowDown"/);
  assert.match(locationSearch, /event\.key === "Enter"/);
  assert.match(locationSearch, /role="combobox"/);
  assert.match(locationSearch, /role="listbox"/);

  assert.match(jobsClient, /locationPlaceholder: "Search location"/);
  assert.match(jobsClient, /locationSearching: "Searching locations…"/);
  assert.match(jobsClient, /locationPlaceholder: "Konum ara"/);
  assert.match(jobsClient, /locationSearching: "Konumlar aranıyor…"/);
});

test("published requirements remain searchable job data without structured filters", async () => {
  const [client, search, config, manager, parser, detail] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/lib/publicJobSearch.ts"),
    source("app/lib/publicJobSearchConfig.ts"),
    source("app/hiring/jobs/JobPostsManager.tsx"),
    source("app/jobs/job-data.ts"),
    source("app/jobs/[id]/JobDetailClient.tsx"),
  ]);

  assert.doesNotMatch(
    client,
    /label=\{c\.(characteristics|certificates|smoking|visibleTattoos|visas|languages)\}/,
  );
  assert.doesNotMatch(search, /requiredCharacteristics: JobCharacteristic\[\]/);
  assert.doesNotMatch(search, /requiredCertificates: JobCertificate\[\]/);
  assert.doesNotMatch(search, /requiredVisas: JobVisa\[\]/);
  assert.doesNotMatch(
    search,
    /setList\(params, "(trait|certificate|visa|language)"/,
  );
  assert.doesNotMatch(search, /(smokerPolicies|visibleTattooPolicies):/);
  assert.doesNotMatch(search, /setList\(params, "(smoker|tattoo)"/);
  assert.doesNotMatch(search, /filters\.requiredVisas|taxonomy\.visas/);
  assert.doesNotMatch(config, /(smokerPolicies|visibleTattooPolicies):/);
  assert.doesNotMatch(config, /jobVisaOptions|\bvisas:/);

  const fingerprint = search.slice(
    search.indexOf("export async function publicJobSearchResultFingerprint"),
    search.indexOf("function publicJobSearchDocument"),
  );
  const keywordDocument = search.slice(
    search.indexOf("function publicJobSearchDocument"),
    search.indexOf("function keywordMatches"),
  );
  assert.match(fingerprint, /job\.requiredVisas/);
  assert.match(keywordDocument, /\.\.\.job\.requiredVisas/);
  assert.match(manager, /title=\{c\.visas\}/);
  assert.match(parser, /requiredVisas/);
  assert.match(
    detail,
    /title=\{c\.visas\}[\s\S]*?job\.requiredVisas\.map\(formatJobVisa\)/,
  );
});

test("advanced job filters use a separate two-column sidebar and compact result cards", async () => {
  const [client, card] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/jobs/PublicJobListingCard.tsx"),
  ]);
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
  assert.match(advanced, /<aside[\s\S]*?id="advanced-job-filters"/);
  assert.match(
    advanced,
    /className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2"/,
  );
  assert.match(advanced, /xl:sticky xl:top-6/);
  assert.match(
    client,
    /aria-labelledby="jobs-filter-heading"[\s\S]*?className="rounded-\[1\.35rem\] border border-slate-200 bg-white p-5 shadow-\[0_18px_55px_rgba\(15,45,72,0\.07\)\] sm:p-6 lg:pb-\[1\.625rem\]"/,
  );
  assert.match(
    client,
    /xl:grid-cols-\[minmax\(0,2\.157fr\)_minmax\(28rem,1fr\)\]/,
  );
  assert.match(client, /mt-2\.5 grid items-start/);
  assert.doesNotMatch(client, /grid items-start border-t border-slate-200/);
  assert.match(
    client,
    /advancedOpen \? "xl:col-start-1 xl:row-start-1" : ""/,
  );
  assert.doesNotMatch(client, /xl:border-r xl:border-slate-200/);
  assert.ok(
    client.indexOf('id="advanced-job-filters"') <
      client.indexOf('id="jobs-results-heading"'),
  );
  assert.match(client, /compact=\{advancedOpen\}/);
  assert.match(card, /compact = false/);
  assert.match(card, /data-job-card-layout="navy-ticket"/);
  assert.match(advanced, /<SalaryFilterGroup/);
  assert.doesNotMatch(advanced, /<FilterSelect\b[^>]*label=\{c\.currency\}/);

  const requestedFilterOrder = [
    advanced.indexOf("label={c.department}"),
    advanced.indexOf("<SalaryFilterGroup"),
    advanced.indexOf("label={c.yachtLength}"),
    advanced.indexOf("label={c.yachtType}"),
    advanced.indexOf("label={c.yachtProgram}"),
    advanced.indexOf("label={c.crewSize}"),
    advanced.indexOf("label={c.yachtFlag}"),
    advanced.indexOf("label={c.teamCouple}"),
  ];
  assert.equal(requestedFilterOrder.every((index) => index >= 0), true);
  assert.deepEqual(
    requestedFilterOrder,
    [...requestedFilterOrder].sort((left, right) => left - right),
  );

  const labels = [
    ...advanced.matchAll(
      /<(?:MultiSelectField|FilterSelect|DualRangeSlider)\b[\s\S]*?\blabel=\{c\.([A-Za-z]+)\}/g,
    ),
  ]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    labels,
    [
      "department",
      "teamCouple",
      "yachtType",
      "yachtProgram",
      "yachtFlag",
      "yachtLength",
      "crewSize",
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
      "yachtTypes",
      "yachtPrograms",
      "flags",
    ].sort(),
  );

  assert.match(
    advanced,
    /<FilterSelect\s+dense\s+allowEmpty\s+label=\{c\.yachtProgram\}\s+placeholder=\{c\.allYachtPrograms\}\s+options=\{optionSets\.yachtPrograms\}\s+value=\{draftFilters\.yachtProgram \|\| ""\}/,
  );
  assert.match(
    advanced,
    /yachtProgram: \(value \|\|\s+null\) as PublicJobSearchFilters\["yachtProgram"\]/,
  );
  assert.doesNotMatch(advanced, /c\.visas|optionSets\.visas|requiredVisas/);

  assert.match(
    advanced,
    /currencyOptions=\{optionSets\.salaryCurrencies\}/,
  );
  assert.match(advanced, /periodOptions=\{optionSets\.salaryPeriods\}/);
  assert.match(advanced, /minimum=\{draftFilters\.salaryMin\}/);
  assert.match(advanced, /maximum=\{draftFilters\.salaryMax\}/);
  assert.match(
    advanced,
    /currency=\{\s*draftFilters\.salaryCurrency \?\? defaultSalaryCurrency\s*\}/,
  );
  assert.match(
    advanced,
    /period=\{draftFilters\.salaryPeriod \?\? defaultSalaryPeriod\}/,
  );
  assert.match(
    advanced,
    /salaryPeriod:\s*current\.salaryPeriod \?\? defaultSalaryPeriod/,
  );
  assert.match(
    advanced,
    /salaryCurrency:\s*current\.salaryCurrency \?\? defaultSalaryCurrency/,
  );

  const groupStart = client.indexOf("function SalaryFilterGroup(");
  const groupEnd = client.indexOf("function SalaryAmountField(", groupStart);
  const salaryGroup = client.slice(groupStart, groupEnd);
  assert.notEqual(groupStart, -1);
  assert.notEqual(groupEnd, -1);
  assert.equal(salaryGroup.match(/<SalaryAmountField\b/g)?.length, 2);
  assert.equal(salaryGroup.match(/currency=\{currency\}/g)?.length, 2);
  assert.equal(salaryGroup.match(/period=\{period\}/g)?.length, 2);
  assert.equal(
    salaryGroup.match(/periodOptions=\{periodOptions\}/g)?.length,
    2,
  );
  assert.equal(
    salaryGroup.match(/onPeriodChange=\{onPeriodChange\}/g)?.length,
    2,
  );
  assert.doesNotMatch(salaryGroup, /<FilterSelect/);
  assert.match(salaryGroup, /return \(\s*<>/);
  assert.doesNotMatch(salaryGroup, /<fieldset|col-span|rounded-2xl|\bp-[34]\b/);

  const amountStart = client.indexOf("function SalaryAmountField(");
  const amountEnd = client.indexOf(
    "function DualRangeSlider(",
    amountStart,
  );
  const amountField = client.slice(amountStart, amountEnd);
  assert.notEqual(amountStart, -1);
  assert.notEqual(amountEnd, -1);
  assert.equal(amountField.match(/<select\b/g)?.length, 2);
  assert.doesNotMatch(amountField, /<option value="">/);
  assert.doesNotMatch(amountField, /any(?:Currency|Period)Label/);
  assert.match(amountField, /aria-label=\{`\$\{label\} \$\{currencyLabel\}`\}/);
  assert.match(amountField, /aria-label=\{`\$\{label\} \$\{periodLabel\}`\}/);
  assert.match(amountField, /onPeriodChange\(event\.target\.value\)/);
  assert.match(amountField, /periodOptions\.map\(\(option\) =>/);
  assert.ok(
    amountField.indexOf('type="text"') <
      amountField.indexOf('aria-label={`${label} ${currencyLabel}`}'),
  );
  assert.ok(
    amountField.indexOf('aria-label={`${label} ${currencyLabel}`}') <
      amountField.indexOf('aria-label={`${label} ${periodLabel}`}'),
  );
  assert.match(
    amountField,
    /\$\{dense \? "h-11" : "h-12"\} grid min-w-0 grid-cols-\[minmax\(3\.25rem,1fr\)_4\.5rem_4rem\]/,
  );
  assert.match(
    amountField,
    /sm:grid-cols-\[minmax\(3\.5rem,1fr\)_4\.75rem_4\.25rem\]/,
  );
  assert.match(
    amountField,
    /xl:grid-cols-\[minmax\(0,1fr\)_3\.625rem_2\.875rem\]/,
  );
  assert.match(amountField, /xl:px-2 xl:text-\[13px\]/);
  assert.equal(
    amountField.match(
      /flex-col items-center justify-center gap-0\.5/g,
    )?.length,
    2,
  );
  assert.equal(amountField.match(/<ChevronDown\b/g)?.length, 2);
  assert.equal(
    amountField.match(/max-w-full truncate whitespace-nowrap/g)?.length,
    2,
  );
  assert.doesNotMatch(amountField, /absolute right-1 top-1\/2/);
  assert.doesNotMatch(amountField, /min-\[390px\]:grid-cols-|col-span-2|border-t/);
});

test("Yacht program uses shared options in Create and Find Jobs", async () => {
  const [jobPosts, manager, config, client] = await Promise.all([
    source("app/lib/jobPosts.ts"),
    source("app/hiring/jobs/JobPostsManager.tsx"),
    source("app/lib/publicJobSearchConfig.ts"),
    source("app/jobs/JobsClient.tsx"),
  ]);

  assert.match(
    jobPosts,
    /export const jobYachtPrograms = \[\s*"private",\s*"charter",\s*"private_charter",?\s*\] as const/,
  );
  assert.match(jobPosts, /private: \{ en: "Private", tr: "Özel" \}/);
  assert.match(jobPosts, /charter: \{ en: "Charter", tr: "Charter" \}/);
  assert.match(
    jobPosts,
    /private_charter: \{ en: "Private & Charter", tr: "Özel & Charter" \}/,
  );
  assert.match(jobPosts, /export function formatJobYachtProgram/);
  assert.match(config, /yachtPrograms: jobYachtPrograms/);
  assert.match(
    client,
    /yachtPrograms: publicJobSearchTaxonomy\.yachtPrograms\.map\(\(value\) =>[\s\S]*?formatJobYachtProgram\(value, language\)/,
  );
  assert.match(client, /allYachtPrograms: "All yacht programs"/);

  const yachtDetailsStart = manager.indexOf(
    '<FormSection icon={<Ship />} title={c.yachtDetails}>',
  );
  const yachtTypeStart = manager.indexOf(
    "label={c.yachtType}",
    yachtDetailsStart,
  );
  const yachtProgramStart = manager.indexOf(
    "<Field label={c.yachtProgram}>",
    yachtDetailsStart,
  );
  const yachtTypeEnd = manager.indexOf("</Field>", yachtTypeStart);
  const yachtProgramEnd = manager.indexOf("</Field>", yachtProgramStart);
  assert.notEqual(yachtDetailsStart, -1);
  assert.notEqual(yachtTypeStart, -1);
  assert.notEqual(yachtProgramStart, -1);
  assert.notEqual(yachtTypeEnd, -1);
  assert.notEqual(yachtProgramEnd, -1);
  assert.ok(yachtTypeStart < yachtProgramStart);
  const yachtTypeField = manager.slice(yachtTypeStart, yachtTypeEnd);
  const yachtProgramField = manager.slice(yachtProgramStart, yachtProgramEnd);
  assert.match(yachtTypeField, /className=\{inputClass\}/);
  assert.match(yachtProgramField, /className=\{inputClass\}/);
  assert.match(
    yachtProgramField,
    /<option value="">\{c\.yachtProgramPlaceholder\}<\/option>/,
  );
  assert.match(yachtProgramField, /jobYachtPrograms\.map\(\(program\) =>/);
  assert.match(
    yachtProgramField,
    /formatJobYachtProgram\(program, language\)/,
  );
});

test("Yacht program contributes one advanced-filter count without a selection summary", async () => {
  const client = await source("app/jobs/JobsClient.tsx");

  assert.match(client, /\(filters\.yachtProgram \? 1 : 0\)/);
  assert.doesNotMatch(client, /"yacht-program"|buildActiveFilterChips/);
  assert.doesNotMatch(client, /filters\.requiredVisas|optionSets\.visas/);
});

test("yacht length is an accessible two-thumb 0–200 m range backed by exact unit conversion", async () => {
  const [client, search, server, manager, yachtSizeField, styles] =
    await Promise.all([
      source("app/jobs/JobsClient.tsx"),
      source("app/lib/publicJobSearch.ts"),
      source("app/lib/publicJobSearchServer.ts"),
      source("app/hiring/jobs/JobPostsManager.tsx"),
      source("app/components/YachtSizeField.tsx"),
      source("app/globals.css"),
    ]);

  assert.match(
    client,
    /<DualRangeSlider[\s\S]*?label=\{c\.yachtLength\}[\s\S]*?minimumValue=\{draftFilters\.yachtLengthMinMetres\}[\s\S]*?maximumValue=\{draftFilters\.yachtLengthMaxMetres\}/,
  );
  const rangeStart = client.indexOf("function DualRangeSlider(");
  const rangeEnd = client.indexOf("function FilterSelect(", rangeStart);
  const range = client.slice(rangeStart, rangeEnd);
  assert.equal(range.match(/type="range"/g)?.length, 2);
  assert.match(range, /aria-label=\{minimumLabel\}/);
  assert.match(range, /aria-label=\{maximumLabel\}/);
  assert.match(range, /aria-valuetext=\{minimumValueText\}/);
  assert.match(range, /aria-valuetext=\{maximumValueText\}/);
  assert.match(range, /aria-valuemax=\{upperValue\}/);
  assert.match(range, /aria-valuemin=\{lowerValue\}/);
  assert.match(client, /minimumValue=\{draftFilters\.yachtLengthMinMetres\}/);
  assert.match(client, /maximumValue=\{draftFilters\.yachtLengthMaxMetres\}/);
  assert.match(
    client,
    /minimum=\{publicJobYachtLengthSlider\.minimumMetres\}/,
  );
  assert.match(
    client,
    /maximum=\{publicJobYachtLengthSlider\.maximumMetres\}/,
  );
  assert.match(client, /step=\{publicJobYachtLengthSlider\.stepMetres\}/);
  assert.match(range, /nextValue === minimum \? null : nextValue/);
  assert.match(range, /nextValue === maximum \? null : nextValue/);
  assert.match(range, /Math\.min\([\s\S]*?upperValue/);
  assert.match(range, /Math\.max\([\s\S]*?lowerValue/);
  assert.match(range, /onPointerDown=\{handlePointerDown\}/);
  assert.match(range, /setPointerCapture\(event\.pointerId\)/);
  assert.match(range, /event\.isPrimary/);
  assert.match(range, /event\.button !== 0/);
  assert.match(range, /pointerId: event\.pointerId/);
  assert.match(range, /onLostPointerCapture=\{handleLostPointerCapture\}/);
  assert.equal(range.match(/onKeyDown=/g)?.length, 2);
  assert.match(range, /event\.key === "ArrowLeft"/);
  assert.match(range, /event\.key === "Home"/);
  assert.match(range, /event\.key === "End"/);
  assert.match(
    range,
    /className=\{`\$\{dense \? "h-11" : "h-12"\} relative rounded-xl border border-slate-200 bg-white px-3`\}/,
  );
  assert.match(
    range,
    /className="bd-job-length-range bd-job-length-range-compact"/,
  );
  assert.match(
    range,
    /className="pointer-events-none absolute inset-x-3 bottom-1 flex justify-between/,
  );

  assert.match(search, /minimumMetres: 0/);
  assert.match(search, /maximumMetres: 200/);
  assert.match(search, /stepMetres: 5/);
  assert.match(search, /const metres = unit === "ft" \? value \* 0\.3048 : value/);
  assert.match(search, /yachtLengthMetres < filters\.yachtLengthMinMetres/);
  assert.match(
    search,
    /yachtLengthMetres > filters\.yachtLengthMaxMetres/,
  );
  assert.match(search, /yachtLengthMinMetres/);
  assert.match(search, /"lengthMin"/);

  assert.match(styles, /\.bd-job-length-range/);
  assert.match(styles, /\.bd-job-length-range-input/);
  assert.match(styles, /::-webkit-slider-thumb/);
  assert.match(styles, /::-moz-range-thumb/);
  assert.match(styles, /--bd-range-start/);
  assert.match(styles, /--bd-range-end/);
  assert.match(styles, /--bd-range-thumb-inset: 12px/);
  assert.match(styles, /height: 2\.75rem/);
  assert.match(styles, /touch-action: pan-y/);
  assert.match(
    styles,
    /\.bd-job-length-range-compact \.bd-job-length-range-track \{\s*top: calc\(50% - 0\.375rem\)/,
  );
  assert.match(
    styles,
    /\.bd-job-length-range-compact \.bd-job-length-range-input \{\s*transform: translateY\(-0\.375rem\)/,
  );

  assert.match(server, /matchesPublicJobSearch\(job, filters\)/);
  assert.match(manager, /<YachtSizeField/);
  assert.match(yachtSizeField, /<option value="ft">/);
  assert.match(yachtSizeField, /<option value="m">/);
});

test("crew size is an accessible two-thumb 0–50 inclusive range", async () => {
  const [client, search, server, page, route] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/lib/publicJobSearch.ts"),
    source("app/lib/publicJobSearchServer.ts"),
    source("app/jobs/page.tsx"),
    source("app/api/jobs/route.ts"),
  ]);

  assert.match(
    client,
    /<DualRangeSlider[\s\S]*?label=\{c\.crewSize\}[\s\S]*?anyLabel=\{c\.anyCrewSize\}[\s\S]*?minimumLabel=\{c\.minimumCrewSize\}[\s\S]*?maximumLabel=\{c\.maximumCrewSize\}[\s\S]*?minimumValue=\{draftFilters\.crewMemberCountMin\}[\s\S]*?maximumValue=\{draftFilters\.crewMemberCountMax\}[\s\S]*?minimum=\{publicJobCrewSizeSlider\.minimumCrewMembers\}[\s\S]*?maximum=\{publicJobCrewSizeSlider\.maximumCrewMembers\}[\s\S]*?step=\{publicJobCrewSizeSlider\.stepCrewMembers\}[\s\S]*?onMinimumChange=\{\(crewMemberCountMin\)[\s\S]*?onMaximumChange=\{\(crewMemberCountMax\)/,
  );
  assert.match(client, /crewSize: "Crew size"/);
  assert.match(client, /crewSize: "Mürettebat sayısı"/);
  assert.match(client, /minimumCrewSize: "Minimum crew size"/);
  assert.match(client, /maximumCrewSize: "Maximum crew size"/);
  assert.match(client, /noMinimumCrewSize: "No minimum crew size"/);
  assert.match(client, /noMaximumCrewSize: "No maximum crew size"/);
  assert.doesNotMatch(client, /function NumberField\(/);
  const sliderStart = client.indexOf("function DualRangeSlider(");
  const sliderEnd = client.indexOf("function FilterSelect(", sliderStart);
  const slider = client.slice(sliderStart, sliderEnd);
  assert.notEqual(sliderStart, -1);
  assert.notEqual(sliderEnd, -1);
  assert.equal(slider.match(/type="range"/g)?.length, 2);
  assert.match(slider, /aria-label=\{minimumLabel\}/);
  assert.match(slider, /aria-label=\{maximumLabel\}/);
  assert.match(slider, /aria-valuetext=\{minimumValueText\}/);
  assert.match(slider, /aria-valuetext=\{maximumValueText\}/);
  assert.match(slider, /aria-valuemax=\{upperValue\}/);
  assert.match(slider, /aria-valuemin=\{lowerValue\}/);
  assert.match(slider, /nextValue === minimum \? null : nextValue/);
  assert.match(slider, /nextValue === maximum \? null : nextValue/);
  assert.match(slider, /onPointerDown=\{handlePointerDown\}/);
  assert.match(slider, /setPointerCapture\(event\.pointerId\)/);
  assert.match(slider, /onLostPointerCapture=\{handleLostPointerCapture\}/);
  assert.equal(slider.match(/onKeyDown=/g)?.length, 2);
  assert.match(slider, /"--bd-range-start": `\$\{start\}%`/);
  assert.match(slider, /"--bd-range-end": `\$\{end\}%`/);
  assert.match(search, /minimumCrewMembers: 0/);
  assert.match(search, /minimumActiveCrewMembers: 1/);
  assert.match(search, /maximumCrewMembers: 50/);
  assert.match(search, /stepCrewMembers: 1/);

  assert.match(search, /setNumber\(params, "crewMin", filters\.crewMemberCountMin\)/);
  assert.match(search, /setNumber\(params, "crewMax", filters\.crewMemberCountMax\)/);
  assert.match(
    search,
    /job\.crewMemberCount < filters\.crewMemberCountMin/,
  );
  assert.match(
    search,
    /job\.crewMemberCount > filters\.crewMemberCountMax/,
  );
  assert.match(
    search,
    /reversed\(filters\.crewMemberCountMin, filters\.crewMemberCountMax\)/,
  );

  assert.match(server, /matchesPublicJobSearch\(job, filters\)/);
  assert.match(page, /if \(!parsed\.ok\) redirect\("\/jobs"\)/);
  assert.match(
    route,
    /if \(!parsed\.ok\) \{[\s\S]*?publicResponse\(\{ ok: false, error: parsed\.error \}, 400\)/,
  );
});

test("required languages remain job data but are not a public job filter", async () => {
  const [client, search, config, manager, parser, detail] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/lib/publicJobSearch.ts"),
    source("app/lib/publicJobSearchConfig.ts"),
    source("app/hiring/jobs/JobPostsManager.tsx"),
    source("app/jobs/job-data.ts"),
    source("app/jobs/[id]/JobDetailClient.tsx"),
  ]);

  assert.doesNotMatch(
    client,
    /c\.(languages|anyLanguage)|draftFilters\.requiredLanguages|optionSets\.languages|formatJobRequiredLanguage/,
  );
  assert.doesNotMatch(search, /requiredLanguages: JobRequiredLanguage\[\]/);
  assert.doesNotMatch(search, /filters\.requiredLanguages/);
  assert.doesNotMatch(search, /taxonomy\.requiredLanguages/);
  assert.doesNotMatch(search, /"language"/);
  assert.doesNotMatch(config, /jobRequiredLanguages|requiredLanguages/);

  const fingerprint = search.slice(
    search.indexOf("export async function publicJobSearchResultFingerprint"),
    search.indexOf("function publicJobSearchDocument"),
  );
  const keywordDocument = search.slice(
    search.indexOf("function publicJobSearchDocument"),
    search.indexOf("function keywordMatches"),
  );
  assert.match(fingerprint, /job\.requiredLanguages/);
  assert.match(keywordDocument, /\.\.\.job\.requiredLanguages/);
  assert.match(manager, /title=\{c\.requiredLanguages\}/);
  assert.match(manager, /jobRequiredLanguages/);
  assert.match(parser, /requiredLanguages/);
  assert.match(detail, /label: c\.languages/);
});

test("minimum yacht experience remains job data but is not a public job filter", async () => {
  const [client, search, config, manager, parser, detail] = await Promise.all([
    source("app/jobs/JobsClient.tsx"),
    source("app/lib/publicJobSearch.ts"),
    source("app/lib/publicJobSearchConfig.ts"),
    source("app/hiring/jobs/JobPostsManager.tsx"),
    source("app/jobs/job-data.ts"),
    source("app/jobs/[id]/JobDetailClient.tsx"),
  ]);

  assert.doesNotMatch(
    client,
    /c\.(minimumExperience|anyExperience)|minimumYachtExperiences|minimumExperiences/,
  );
  assert.doesNotMatch(search, /minimumYachtExperiences/);
  assert.doesNotMatch(search, /"minimumExperience"/);
  assert.doesNotMatch(
    config,
    /jobMinimumYachtExperiences|minimumYachtExperiences/,
  );
  assert.match(search, /job\.minimumYachtExperience/);
  assert.match(manager, /<Field label=\{c\.minimumYachtExperience\}>/);
  assert.match(manager, /jobMinimumYachtExperiences\.map/);
  assert.match(parser, /minimumYachtExperience/);
  assert.match(detail, /label: c\.minimumYachtExperience/);
});

test("Find Jobs and Create Job Post share salary currency options and labels", async () => {
  const [jobPosts, manager, config, client] = await Promise.all([
    source("app/lib/jobPosts.ts"),
    source("app/hiring/jobs/JobPostsManager.tsx"),
    source("app/lib/publicJobSearchConfig.ts"),
    source("app/jobs/JobsClient.tsx"),
  ]);

  assert.match(jobPosts, /export const jobSalaryCurrencyOptions =/);
  assert.match(jobPosts, /export function formatJobSalaryCurrencyOption/);
  assert.match(manager, /jobSalaryCurrencyOptions\.map\(\(currency\) =>/);
  assert.match(manager, /formatJobSalaryCurrencyOption\(currency\)/);
  assert.doesNotMatch(manager, /function formatSalaryCurrencyOption/);
  assert.match(config, /salaryCurrencies: jobSalaryCurrencyOptions/);
  assert.doesNotMatch(config, /\bjobSalaryCurrencies\b/);
  assert.match(client, /formatJobSalaryCurrencyOption\(value\)/);
});

test("Find Jobs and Create Job Post share salary period options and labels", async () => {
  const [jobPosts, manager, config, client] = await Promise.all([
    source("app/lib/jobPosts.ts"),
    source("app/hiring/jobs/JobPostsManager.tsx"),
    source("app/lib/publicJobSearchConfig.ts"),
    source("app/jobs/JobsClient.tsx"),
  ]);

  assert.match(jobPosts, /export const jobSalaryPeriods =/);
  assert.match(jobPosts, /export function formatJobSalaryPeriod/);
  assert.match(manager, /jobSalaryPeriods\.map\(\(period\) =>/);
  assert.match(manager, /formatJobSalaryPeriod\(period, language\)/);
  assert.match(config, /salaryPeriods: jobSalaryPeriods/);
  assert.match(client, /formatJobSalaryPeriod\(value, language\)/);
  assert.doesNotMatch(client, /function formatSalaryPeriod/);
  assert.doesNotMatch(client, /Per (?:day|week|month|year)/);
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
  const filterSelectStart = client.indexOf("function FilterSelect(");
  const filterSelectEnd = client.indexOf("function MultiSelectField(", filterSelectStart);
  const filterSelect = client.slice(filterSelectStart, filterSelectEnd);
  assert.match(
    filterSelect,
    /className=\{`relative block w-full \$\{dense \? "h-11" : "h-12"\}`\}/,
  );
  assert.match(
    filterSelect,
    /className=\{`bd-focus w-full[^`]*appearance-none[^`]*\$\{dense \? "h-11" : "h-12"\}`\}/,
  );
  assert.match(filterSelect, /<ChevronDown[\s\S]*?pointer-events-none absolute right-4/);
  assert.match(client, /if \(value === "yes"\) return \["team", "couple"\]/);
  assert.match(client, /if \(value === "no"\) return \["individual"\]/);
  assert.match(search, /return value === "any" \|\| includesSelected\(selected, value\)/);
  assert.match(
    config,
    /candidateTypes: jobCandidateTypes\.filter\(\(value\) => value !== "any"\)/,
  );
  assert.doesNotMatch(client, /label=\{c\.candidateType\}/);
  assert.match(
    card,
    /formatJobTeamCoupleAnswer\(job\.candidateType, language\)/,
  );
  assert.match(
    card,
    /const teamCouple = isJobTeamCouple\(job\.candidateType\)/,
  );
  assert.match(
    card,
    /<MetaLine\b[\s\S]*?icon=\{<MapPin \/>\}[\s\S]*?value=\{job\.location\}/,
  );
  assert.match(
    card,
    /<InfoLine\b[\s\S]*?icon=\{<UsersRound \/>\}[\s\S]*?value=\{teamCouple\}/,
  );
  assert.ok(
    card.indexOf("value={job.location}") <
      card.indexOf("value={teamCouple}"),
  );
  assert.doesNotMatch(card, /function StatusPill/);
  assert.equal(
    (card.match(/\{salary \|\| c\.salaryNotSpecified\}/g) || []).length,
    1,
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

test("Yacht program is mapped through public cards and renders above Start", async () => {
  const [jobPosts, jobPostsServer, search, searchServer, parser, card] =
    await Promise.all([
      source("app/lib/jobPosts.ts"),
      source("app/lib/jobPostsServer.ts"),
      source("app/lib/publicJobSearch.ts"),
      source("app/lib/publicJobSearchServer.ts"),
      source("app/jobs/job-data.ts"),
      source("app/jobs/PublicJobListingCard.tsx"),
    ]);

  const publicCard = jobPosts.slice(
    jobPosts.indexOf("export type PublicJobCard"),
    jobPosts.indexOf("export type EmployerJobPost"),
  );
  assert.match(publicCard, /\| "yachtProgram"/);
  assert.match(jobPostsServer, /publicJobCardSelect[\s\S]*?yacht_program/);

  const cardMapping = searchServer.slice(
    searchServer.indexOf("function publicJobCardFromPost"),
    searchServer.indexOf("async function derivePublicJobCursorKey"),
  );
  assert.match(cardMapping, /yachtProgram: job\.yachtProgram/);

  const cardParser = parser.slice(
    parser.indexOf("export function parsePublicJobCard"),
    parser.indexOf("function parseStrictCardSalary"),
  );
  assert.match(cardParser, /isJobYachtProgram\(yachtProgramValue\)/);
  assert.match(cardParser, /yachtProgramValue === undefined/);
  assert.match(cardParser, /yachtProgram === undefined/);
  assert.match(cardParser, /yachtProgram,/);

  const fingerprint = search.slice(
    search.indexOf("export async function publicJobSearchResultFingerprint"),
    search.indexOf("function publicJobSearchDocument"),
  );
  assert.match(fingerprint, /job\.yachtProgram/);

  assert.match(
    card,
    /const yachtProgram = job\.yachtProgram[\s\S]*?formatJobYachtProgram\(job\.yachtProgram, language\)/,
  );
  assert.match(
    card,
    /\{yachtProgram \? \([\s\S]*?<InfoLine[\s\S]*?icon=\{<Anchor \/>\}[\s\S]*?value=\{yachtProgram\}[\s\S]*?\) : null\}/,
  );
  assert.ok(
    card.indexOf('value={yachtProgram}') <
      card.indexOf('value={`${c.start}: ${'),
  );
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
  assert.match(parser, /isJobYachtProgram\(yachtProgramValue\)/);
  assert.match(parser, /yachtProgram === undefined/);
});
