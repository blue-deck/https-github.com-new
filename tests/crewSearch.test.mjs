import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  crewExperienceMatchesFilters,
  crewExperienceMatchesYachtExperienceOption,
  crewPositionsMatchFilters,
  crewSearchFilterCount,
  crewSearchParamKeys,
  crewSearchParams,
  defaultCrewSearchFilters,
  isCrewExperienceType,
  isValidCrewPositionSearchValues,
  maximumCrewPositionSelections,
  parseCrewSearchFilters,
} from "../app/lib/crewSearch.ts";
import {
  crewAvailabilityStatuses,
  crewDirectoryAvailabilityStatuses,
  crewDiscoveryNotesPrefix,
  defaultCrewDiscoverySettings,
  isCrewVisibleInDirectory,
  parseCrewDiscoverySettings,
} from "../app/lib/crewDiscovery.ts";
import {
  crewExperienceBreakdownFromDateRanges,
  crewExperienceYearsFromDateRanges,
  formatCrewExperienceDuration,
} from "../app/lib/crewExperience.ts";
import {
  formatJobMinimumYachtExperience,
  jobMinimumYachtExperiences,
} from "../app/lib/jobPosts.ts";
import { capitalizeInitialInput } from "../app/lib/inputText.ts";

test("find crew opens directly with the compact filter workspace", async () => {
  const [client, loading] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/find-crew/loading.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of [client, loading]) {
    assert.doesNotMatch(source, /Find the right yacht crew with precision\./);
    assert.doesNotMatch(source, /Finding the right crew\./);
  }
  assert.doesNotMatch(
    client,
    /Search privacy-protected Crew and Captain profiles/,
  );
  assert.doesNotMatch(client, /c\.(?:eyebrow|title|intro)/);
  assert.match(client, /<h1\s+id="crew-filter-heading"/);
  assert.match(
    client,
    /max-w-7xl px-5 pb-12 pt-7[\s\S]*?<section[\s\S]*?aria-labelledby="crew-filter-heading"/,
  );
  assert.match(loading, /<h1 id="crew-filter-heading" className="sr-only">/);
});

test("find crew keeps concise labels while matching the jobs position prompt", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  assert.match(client, /position: "Position"/);
  assert.match(client, /allPositions: "All positions"/);
  assert.match(client, /allPositions: "Tüm pozisyonlar"/);
  assert.doesNotMatch(client, /availability: "All /);
  assert.doesNotMatch(client, /nationalityFilter: "All /);
});

test("find crew uses concise English labels for core select filters", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  assert.match(client, /position: "Position"/);
  assert.match(client, /availability: "Availability"/);
  assert.match(client, /nationalityFilter: "Nationality"/);
  assert.match(client, /maritalStatus: "Marital status"/);
  assert.doesNotMatch(client, /position: "Positions"/);
  assert.doesNotMatch(
    client,
    /:\s*"Any (?:availability|contract|nationality|marital status|skill|professional trait|work preference|language)"/,
  );
});

test("crew keyword search waits for its right-side search button", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    client,
    /const \[draftFilters, setDraftFilters\] = useState\(\(\) =>\s*normalizeCrewSearchFilters\(initialFilters\)/,
  );
  assert.match(client, /value=\{draftFilters\.query\}/);
  assert.match(
    client,
    /setDraftFilter\(\s*"query",\s*capitalizeInitialInput\(event\.target\.value, language\)/,
  );
  assert.match(client, /function submitCrewKeywordSearch\(\) \{\s*setFilters\(\(current\) =>\s*normalizeCrewSearchFilters\(\{ \.\.\.current, query: draftFilters\.query \}\)/);
  assert.match(client, /onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*submitCrewKeywordSearch\(\);/);
  assert.match(client, /if \(event\.key !== "Enter"\) return;\s*event\.preventDefault\(\);\s*submitCrewKeywordSearch\(\);/);
  assert.match(client, /type="submit"\s+aria-label=\{c\.keywordSearchAction\}/);
  assert.match(client, /absolute right-1 top-1\/2/);
});

test("primary and advanced crew filters apply only through the relocated Search button", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  for (const field of [
    "positions",
    "nationality",
    "availability",
    "maritalStatus",
    "gender",
    "smoker",
    "visibleTattoos",
    "minimumExperience",
    "premiumOnly",
    "hasPhoto",
    "hasGallery",
    "hasTeamCouple",
  ]) {
    assert.match(client, new RegExp(`draftFilters\\.${field}`));
  }
  assert.match(
    client,
    /function submitAllCrewFilters\(\) \{\s*closeOpenCrewPositionMultiSelects\(\);\s*setFilters\(normalizeCrewSearchFilters\(draftFilters\)\);/,
  );
  assert.match(
    client,
    /!advancedOpen \? \(\s*<div[\s\S]*?<CrewFilterSearchButton[\s\S]*?onClick=\{submitAllCrewFilters\}/,
  );
  assert.match(
    client,
    /id="crew-advanced-filters"[\s\S]*?<CrewFilterSearchButton[\s\S]*?onClick=\{submitAllCrewFilters\}/,
  );
  assert.match(client, /placeholder=\{c\.nationalityFilter\}/);
});

test("find crew position control mirrors the searchable Find Jobs multi-select", async () => {
  const [crewClient, jobsClient] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/jobs/JobsClient.tsx", import.meta.url), "utf8"),
  ]);

  const crewStart = crewClient.indexOf("function PositionMultiSelectField");
  const crewEnd = crewClient.indexOf(
    "function closeOpenCrewPositionMultiSelects",
    crewStart,
  );
  const jobsStart = jobsClient.indexOf("function MultiSelectField");
  const jobsEnd = jobsClient.indexOf("function closeOpenJobMultiSelects", jobsStart);
  const crewControl = crewClient.slice(crewStart, crewEnd);
  const jobsControl = jobsClient.slice(jobsStart, jobsEnd);

  assert.ok(crewStart >= 0 && crewEnd > crewStart);
  assert.ok(jobsStart >= 0 && jobsEnd > jobsStart);
  for (const contract of [
    /<details/,
    /<summary/,
    /type="search"/,
    /role="group"/,
    /type="checkbox"/,
    /disabled=\{!checked && selectionLimitReached\}/,
    /max-h-64/,
    /min-w-64/,
    /values\.length > 0 \? `\$\{values\.length\} \$\{selectedLabel\}` : placeholder/,
  ]) {
    assert.match(crewControl, contract);
    assert.match(jobsControl, contract);
  }
  assert.match(crewClient, /maxSelections=\{maximumCrewPositionSelections\}/);
  assert.equal(maximumCrewPositionSelections, 12);
  assert.match(crewClient, /event\.key !== "Escape"/);
  assert.match(crewClient, /closeOpenCrewPositionMultiSelects\(\)/);
  assert.match(crewClient, /allPositions: "All positions"/);
  assert.match(crewClient, /searchPositions: "Search positions"/);
  assert.match(crewClient, /selected: "selected"/);
  assert.match(crewClient, /noOptions: "No options found"/);
  assert.match(
    crewClient,
    /publicJobSearchTaxonomy\.positions\.map\(\(value\) => \(\{ value, label: value \}\)\)/,
  );
  assert.match(
    crewClient,
    /import \{ publicJobSearchTaxonomy \} from "\.\.\/lib\/publicJobSearchConfig";/,
  );
  assert.doesNotMatch(
    crewClient,
    /new Set\(\[\.\.\.facets\.positions, \.\.\.draftFilters\.positions\]\)/,
  );
  assert.match(
    crewClient,
    /function submitAllCrewFilters\(\) \{\s*closeOpenCrewPositionMultiSelects\(\);\s*setFilters/,
  );
  assert.doesNotMatch(crewControl, /autoCapitalize=/);
});

test("clear filters stays beside both Search actions without closing More filters", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );
  const clearFilters = client.slice(
    client.indexOf("function clearFilters()"),
    client.indexOf("function submitCrewKeywordSearch()"),
  );

  assert.doesNotMatch(client, /advancedFilterCount/);
  assert.doesNotMatch(client, /\{advancedFilterCount\}/);
  assert.match(
    client,
    /!advancedOpen \? \([\s\S]*?<CrewFilterClearAction[\s\S]*?<CrewFilterSearchButton/,
  );
  assert.match(
    client,
    /id="crew-advanced-filters"[\s\S]*?<CrewFilterClearAction[\s\S]*?<CrewFilterSearchButton/,
  );
  assert.match(
    client,
    /function CrewFilterClearAction[\s\S]*?text-slate-500 underline[\s\S]*?\{label\}/,
  );
  assert.doesNotMatch(clearFilters, /setAdvancedOpen/);
  assert.match(clearFilters, /setFilters\(defaultCrewSearchFilters\)/);
  assert.match(clearFilters, /setDraftFilters\(defaultCrewSearchFilters\)/);
  assert.match(client, /setFilterResetVersion\(\(version\) => version \+ 1\)/);
});

test("crew text inputs capitalize their first typed letter for the site language", async () => {
  const nationalityField = await readFile(
    new URL("../app/components/NationalitySearchField.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(capitalizeInitialInput("captain", "en"), "Captain");
  assert.equal(capitalizeInitialInput("  stewardess", "en"), "  Stewardess");
  assert.equal(capitalizeInitialInput("istanbul", "tr"), "İstanbul");
  assert.equal(capitalizeInitialInput("2nd engineer", "en"), "2nd engineer");
  assert.match(
    nationalityField,
    /setQuery\(capitalizeInitialInput\(event\.target\.value, language\)\)/,
  );
  assert.match(nationalityField, /autoCapitalize="sentences"/);
});

test("personal crew selects show Any without changing their field labels", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  for (const field of ["maritalStatus", "gender", "smoker", "visibleTattoos"]) {
    assert.match(
      client,
      new RegExp(`label=\\{c\\.${field}\\}\\s+emptyOptionLabel=\\{c\\.any\\}`),
    );
  }
  assert.match(client, /any: "Any"/);
  assert.match(client, /any: "Herhangi"/);
  assert.match(client, /<option value="">\{emptyOptionLabel\}<\/option>/);
});

test("availability select uses an explicit selection prompt", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    client,
    /label=\{c\.availability\}\s+emptyOptionLabel=\{c\.selectAvailability\}\s+value=\{draftFilters\.availability\}/,
  );
  assert.match(client, /selectAvailability: "Select availability"/);
  assert.match(client, /selectAvailability: "Müsaitlik durumu seçin"/);
});

test("keeps nationality in primary filters and removes the location filter", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );
  const primaryStart = client.indexOf(
    "className={`mt-4 grid gap-3 md:grid-cols-2",
  );
  const advancedStart = client.indexOf("{advancedOpen ?", primaryStart);
  const advancedEnd = client.indexOf(
    "{c.fairHiringNote}",
    advancedStart,
  );
  const primaryFilters = client.slice(primaryStart, advancedStart);
  const advancedSelects = client.slice(advancedStart, advancedEnd);
  assert.ok(primaryStart >= 0 && advancedStart > primaryStart);
  assert.ok(advancedEnd > advancedStart);
  assert.match(primaryFilters, /label=\{c\.nationalityFilter\}/);
  assert.match(primaryFilters, /<NationalitySearchField/);
  assert.doesNotMatch(primaryFilters, /label=\{c\.location\}/);
  assert.doesNotMatch(advancedSelects, /label=\{c\.location\}/);
  assert.doesNotMatch(advancedSelects, /label=\{c\.nationalityFilter\}/);
});

test("advanced crew filters show readiness toggles first without a heading", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );
  const advancedStart = client.indexOf('id="crew-advanced-filters"');
  const advancedEnd = client.indexOf("{c.fairHiringNote}", advancedStart);
  const advancedFilters = client.slice(advancedStart, advancedEnd);
  const orderedFields = [
    "premiumOnly",
    "hasPhoto",
    "hasGallery",
    "hasTeamCouple",
    "maritalStatus",
    "gender",
    "smoker",
    "visibleTattoos",
    "experienceType",
    "minimumExperience",
  ];
  const fieldPositions = orderedFields.map((field) =>
    advancedFilters.indexOf(`draftFilters.${field}`),
  );

  assert.ok(advancedStart >= 0 && advancedEnd > advancedStart);
  assert.ok(fieldPositions.every((position) => position >= 0));
  assert.deepEqual(fieldPositions, [...fieldPositions].sort((a, b) => a - b));
  assert.doesNotMatch(advancedFilters, /profileQuality|Profile readiness/);
  assert.doesNotMatch(advancedFilters, /<legend\b/);
  assert.doesNotMatch(client, /profileQuality:/);
});

test("crew filter controls share equal columns and one select surface", async () => {
  const [client, loading, nationalityField] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/find-crew/loading.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/NationalitySearchField.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(client, /\? "xl:grid-cols-4"/);
  assert.match(
    client,
    /: "xl:grid-cols-\[repeat\(4,minmax\(0,1fr\)\)_auto\]"/,
  );
  assert.match(
    loading,
    /xl:grid-cols-\[repeat\(4,minmax\(0,1fr\)\)_auto\]/,
  );
  assert.doesNotMatch(client, /1\.35fr|0\.9fr/);
  assert.doesNotMatch(loading, /1\.35fr|0\.9fr/);
  assert.match(
    nationalityField,
    /NATIONALITY_CONTROL_SIZE_CLASS_NAME =\s*\n\s*"h-12 min-h-12 w-full min-w-0"/,
  );
  assert.match(
    client,
    /id="crew-keyword-search"[\s\S]*?className=\{`\$\{NATIONALITY_CONTROL_SIZE_CLASS_NAME\}/,
  );
  const selectClassMatch = client.match(
    /const crewFilterSelectClassName = `\$\{NATIONALITY_CONTROL_SIZE_CLASS_NAME\} ([^`]+)`;/,
  );
  assert.ok(selectClassMatch);
  const selectClassTokens = new Set(selectClassMatch[1].split(/\s+/));
  for (const token of [
    "appearance-none",
    "rounded-xl",
    "border-slate-200",
    "bg-slate-50",
    "py-0",
    "pl-4",
    "pr-12",
    "text-slate-950",
    "focus:border-cyan-500",
    "focus:bg-white",
    "focus:ring-4",
    "focus:ring-cyan-100",
  ]) {
    assert.ok(selectClassTokens.has(token), `missing select class: ${token}`);
  }

  const sharedSelectStart = client.indexOf(
    "function CrewFilterSelectControl",
  );
  const sharedSelectEnd = client.indexOf(
    "function formatFilterOption",
    sharedSelectStart,
  );
  const sharedSelect = client.slice(sharedSelectStart, sharedSelectEnd);

  assert.ok(sharedSelectStart >= 0 && sharedSelectEnd > sharedSelectStart);
  assert.match(sharedSelect, /<label className="block min-w-0">/);
  assert.match(sharedSelect, /<span className="relative block min-w-0">/);
  assert.match(sharedSelect, /className=\{crewFilterSelectClassName\}/);
  assert.match(sharedSelect, /aria-hidden="true"/);
  assert.match(sharedSelect, /pointer-events-none/);
  assert.match(sharedSelect, /<ChevronDown className="h-4 w-4"/);

  for (const componentName of [
    "FilterSelect",
    "ExperienceTypeFilterSelect",
    "MinimumExperienceFilterSelect",
  ]) {
    const componentStart = client.indexOf(`function ${componentName}`);
    const componentEnd = client.indexOf("\nfunction ", componentStart + 1);
    const component = client.slice(componentStart, componentEnd);

    assert.ok(componentStart >= 0 && componentEnd > componentStart);
    assert.match(component, /<CrewFilterSelectControl/);
    assert.doesNotMatch(component, /<select/);
  }

  assert.match(
    client,
    /label=\{c\.position\}[\s\S]*?label=\{c\.availability\}[\s\S]*?label=\{c\.maritalStatus\}[\s\S]*?label=\{c\.gender\}[\s\S]*?label=\{c\.smoker\}[\s\S]*?label=\{c\.visibleTattoos\}[\s\S]*?label=\{c\.experienceType\}[\s\S]*?label=\{c\.minimumExperience\}/,
  );
  assert.match(client, /<form\s+className="block min-w-0"/);
  assert.match(nationalityField, /relative block min-w-0/);
});

test("find crew excludes Not available from filters while My Profile keeps it", async () => {
  const [client, searchContract, profile] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/lib/crewSearchRequest.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.deepEqual([...crewAvailabilityStatuses], [
    "Available",
    "In 1 week",
    "In 1 month",
    "Open to offers",
    "Not available",
  ]);
  assert.deepEqual([...crewDirectoryAvailabilityStatuses], [
    "Available",
    "In 1 week",
    "In 1 month",
    "Open to offers",
  ]);
  assert.match(client, /options=\{crewDirectoryAvailabilityStatuses\}/);
  assert.doesNotMatch(client, /options=\{crewAvailabilityStatuses\}/);
  assert.doesNotMatch(client, /options=\{facets\.availabilities\}/);
  assert.match(
    searchContract,
    /searchParams\.get\("availability"\),\s*crewDirectoryAvailabilityStatuses/,
  );
  assert.match(profile, /crewAvailabilityStatuses\.map/);
  assert.doesNotMatch(profile, /<option value="">Select availability<\/option>/);
});

test("missing availability defaults to Available and explicit unavailability stays hidden", () => {
  assert.equal(defaultCrewDiscoverySettings.availabilityStatus, "Available");
  assert.equal(parseCrewDiscoverySettings(null).availabilityStatus, "Available");
  assert.equal(parseCrewDiscoverySettings("private notes").availabilityStatus, "Available");
  assert.equal(
    parseCrewDiscoverySettings(`${crewDiscoveryNotesPrefix}{malformed`).availabilityStatus,
    "Available",
  );

  const unavailable = parseCrewDiscoverySettings(
    `${crewDiscoveryNotesPrefix}${JSON.stringify({ availabilityStatus: "Not available" })}`,
  );
  const legacyUnavailable = parseCrewDiscoverySettings(
    `${crewDiscoveryNotesPrefix}${JSON.stringify({ availabilityStatus: "Currently employed" })}`,
  );
  assert.equal(unavailable.availabilityStatus, "Not available");
  assert.equal(legacyUnavailable.availabilityStatus, "Not available");
  assert.equal(isCrewVisibleInDirectory(unavailable), false);
  assert.equal(isCrewVisibleInDirectory(legacyUnavailable), false);
  assert.equal(isCrewVisibleInDirectory(parseCrewDiscoverySettings(null)), true);

  assert.equal(
    parseCrewSearchFilters(
      new URLSearchParams({ availability: "Not available" }),
    ).availability,
    "",
  );
  assert.equal(
    parseCrewSearchFilters(
      new URLSearchParams({ availability: "Available" }),
    ).availability,
    "Available",
  );
});

test("find crew validates nationality against the complete country dataset", async () => {
  const searchContract = await readFile(
    new URL("../app/lib/crewSearchRequest.ts", import.meta.url),
    "utf8",
  );

  assert.match(searchContract, /import \{ nationalityFilterValues \}/);
  assert.match(
    searchContract,
    /searchParams\.get\("nationality"\),\s*nationalityFilterValues/,
  );
});

test("round-trips every public crew search criterion through the URL contract", () => {
  const source = new URLSearchParams([
    ["q", "  Chief   Stewardess  "],
    ["position", "Deckhand"],
    ["position", "Chief Stewardess"],
    ["availability", "Available"],
    ["nationality", "Turkish"],
    ["maritalStatus", "Married"],
    ["gender", "Female"],
    ["smoker", "No"],
    ["visibleTattoos", "Yes"],
    ["experienceType", "other"],
    ["experienceMin", "3_5_years"],
    ["premium", "1"],
    ["photo", "1"],
    ["gallery", "1"],
    ["teamCouple", "1"],
  ]);

  const filters = parseCrewSearchFilters(source);
  assert.equal(filters.query, "Chief Stewardess");
  assert.equal(filters.experienceType, "other");
  assert.equal(filters.minimumExperience, "3_5_years");
  assert.deepEqual(filters.positions, ["Chief Stewardess", "Deckhand"]);
  const canonicalParams = crewSearchParams(filters);
  assert.deepEqual(canonicalParams.getAll("position"), [
    "Chief Stewardess",
    "Deckhand",
  ]);
  assert.equal(canonicalParams.get("q"), "Chief Stewardess");
  assert.equal(filters.maritalStatus, "Married");
  assert.equal(filters.gender, "Female");
  assert.equal(filters.smoker, "No");
  assert.equal(filters.visibleTattoos, "Yes");
  assert.equal(filters.hasTeamCouple, true);
  assert.equal(crewSearchFilterCount(filters), 15);
});

test("canonicalizes repeated crew positions and matches any exact selected role", () => {
  const fromUrl = parseCrewSearchFilters(
    new URLSearchParams([
      ["position", "Deckhand"],
      ["position", "Captain"],
      ["position", "Deckhand"],
    ]),
  );
  const fromPageProps = parseCrewSearchFilters({
    position: ["Deckhand", "Captain", "Deckhand"],
  });

  assert.deepEqual(fromUrl.positions, ["Captain", "Deckhand"]);
  assert.deepEqual(fromPageProps.positions, fromUrl.positions);
  assert.equal(
    crewSearchParams(fromUrl).toString(),
    "position=Captain&position=Deckhand",
  );
  assert.equal(
    crewSearchParams(fromPageProps).toString(),
    crewSearchParams(fromUrl).toString(),
  );

  assert.equal(crewPositionsMatchFilters(["Captain"], []), true);
  assert.equal(
    crewPositionsMatchFilters(
      ["Chief Stewardess", "Deckhand"],
      ["Captain", "Deckhand"],
    ),
    true,
  );
  assert.equal(
    crewPositionsMatchFilters(
      ["Chief Stewardess", "Relief Captain"],
      ["Captain", "Deckhand"],
    ),
    false,
  );
  assert.equal(
    crewPositionsMatchFilters(["Fleet Captain"], ["Captain"]),
    false,
  );
  assert.equal(
    crewPositionsMatchFilters(["Captain"], ["Captain!"]),
    false,
  );
  assert.equal(
    crewPositionsMatchFilters(["CAPTAIN"], ["Captain"]),
    true,
  );
});

test("validates the crew position multi-select request boundary", async () => {
  const [requestContract, route, page] = await Promise.all([
    readFile(
      new URL("../app/lib/crewSearchRequest.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/api/find-crew/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/find-crew/page.tsx", import.meta.url), "utf8"),
  ]);
  const allowedPositions = Array.from(
    { length: maximumCrewPositionSelections + 1 },
    (_, index) => `Position ${index + 1}`,
  );
  const twelvePositions = allowedPositions.slice(
    0,
    maximumCrewPositionSelections,
  );

  assert.equal(isValidCrewPositionSearchValues([], allowedPositions), true);
  assert.equal(
    isValidCrewPositionSearchValues(twelvePositions, allowedPositions),
    true,
  );
  assert.equal(
    isValidCrewPositionSearchValues(
      [...twelvePositions, allowedPositions[12]],
      allowedPositions,
    ),
    false,
  );
  assert.equal(
    isValidCrewPositionSearchValues(["Unknown position"], allowedPositions),
    false,
  );
  assert.equal(
    isValidCrewPositionSearchValues(["position 1"], allowedPositions),
    false,
  );
  assert.equal(
    isValidCrewPositionSearchValues([" Position 1 "], allowedPositions),
    false,
  );
  assert.equal(isValidCrewPositionSearchValues([""], allowedPositions), false);
  assert.equal(
    isValidCrewPositionSearchValues([" ".repeat(121)], allowedPositions),
    false,
  );
  assert.equal(
    isValidCrewPositionSearchValues(["Position 1\u0000"], allowedPositions),
    false,
  );
  assert.equal(
    isValidCrewPositionSearchValues(["Position 1\nMate"], allowedPositions),
    false,
  );
  assert.match(
    requestContract,
    /!isValidCrewPositionSearchValues\(\s*searchParams\.getAll\("position"\),\s*publicJobSearchTaxonomy\.positions,\s*\)/,
  );
  assert.match(
    requestContract,
    /key === "position"[\s\S]*?valueCount > maximumCrewPositionSelections/,
  );
  assert.match(
    requestContract,
    /filters: parseCrewSearchFilters\(\s*searchParams,\s*publicJobSearchTaxonomy\.positions,\s*\)/,
  );
  assert.match(
    requestContract,
    /key === "position"[\s\S]*?: valueCount !== 1/,
  );
  assert.match(
    route,
    /import \{ parseCrewSearchRequest \} from "\.\.\/\.\.\/lib\/crewSearchRequest";/,
  );
  assert.match(
    page,
    /import \{ parseCrewSearchRequest \} from "\.\.\/lib\/crewSearchRequest";/,
  );
  assert.match(route, /const parsed = parseCrewSearchRequest\(searchParams\)/);
  assert.match(page, /const parsed = parseCrewSearchRequest\(params\)/);
  assert.match(page, /if \(!parsed\.ok\) redirect\("\/find-crew"\)/);
});

test("accepts only supported experience types and omits Any from canonical URLs", () => {
  assert.equal(crewSearchParamKeys.has("experienceType"), true);
  assert.equal(isCrewExperienceType("any"), true);
  assert.equal(isCrewExperienceType("yacht"), true);
  assert.equal(isCrewExperienceType("other"), true);
  assert.equal(isCrewExperienceType("combined"), false);

  const anyFilters = parseCrewSearchFilters(
    new URLSearchParams({ experienceType: "any" }),
  );
  const yachtFilters = parseCrewSearchFilters(
    new URLSearchParams({ experienceType: "yacht" }),
  );
  const invalidFilters = parseCrewSearchFilters(
    new URLSearchParams({ experienceType: "combined" }),
  );

  assert.equal(anyFilters.experienceType, "any");
  assert.equal(crewSearchParams(anyFilters).toString(), "");
  assert.equal(yachtFilters.experienceType, "yacht");
  assert.equal(crewSearchParams(yachtFilters).toString(), "experienceType=yacht");
  assert.equal(invalidFilters.experienceType, "any");
  assert.equal(crewSearchParams(invalidFilters).toString(), "");
});

test("find crew API rejects unsupported experience type values", async () => {
  const searchContract = await readFile(
    new URL("../app/lib/crewSearchRequest.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    searchContract,
    /experienceType = searchParams\.get\("experienceType"\)[\s\S]*?!isCrewExperienceType\(experienceType\)/,
  );
});

test("filters Team/Couple crew as separate profiles from accepted connections", async () => {
  const [client, searchContract, dataSource] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/lib/crewSearchRequest.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/lib/findCrewData.ts", import.meta.url), "utf8"),
  ]);

  const accepted = parseCrewSearchFilters(
    new URLSearchParams({ teamCouple: "1" }),
  );
  const rejected = parseCrewSearchFilters(
    new URLSearchParams({ teamCouple: "true" }),
  );

  assert.equal(crewSearchParamKeys.has("teamCouple"), true);
  assert.equal(accepted.hasTeamCouple, true);
  assert.equal(crewSearchParams(accepted).toString(), "teamCouple=1");
  assert.equal(rejected.hasTeamCouple, false);
  assert.match(
    client,
    /label=\{c\.hasTeamCouple\}[\s\S]*?checked=\{draftFilters\.hasTeamCouple\}/,
  );
  assert.match(client, /hasTeamCouple: "Team\/Couple"/);
  assert.match(
    searchContract,
    /const crewBooleanSearchParamKeys = \[\s*"premium",\s*"photo",\s*"gallery",\s*"teamCouple",\s*\]/,
  );
  assert.match(dataSource, /\.from\("crew_team_relationships"\)/);
  assert.match(dataSource, /\.eq\("status", "accepted"\)/);
  assert.match(
    dataSource,
    /if \(filters\.hasTeamCouple && !record\.hasTeamCouple\) return false;/,
  );
  assert.match(
    dataSource,
    /profiles: selected\.map\(\(record\) => record\.preview\)/,
  );
});

test("removes location from the crew filter contract", async () => {
  const filters = parseCrewSearchFilters(
    new URLSearchParams({ location: "Athens" }),
  );
  const [client, dataSource] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/lib/findCrewData.ts", import.meta.url), "utf8"),
  ]);

  assert.equal(crewSearchParamKeys.has("location"), false);
  assert.equal(Object.hasOwn(filters, "location"), false);
  assert.equal(crewSearchParams(filters).toString(), "");
  assert.doesNotMatch(client, /label=\{c\.location\}/);
  assert.doesNotMatch(client, /draftFilters\.location/);
  assert.doesNotMatch(client, /"locations",/);
  assert.doesNotMatch(dataSource, /filters\.location/);
  assert.doesNotMatch(dataSource, /locations: sortedCrewFacet/);
});

test("removes language from the crew filter contract", async () => {
  const filters = parseCrewSearchFilters(
    new URLSearchParams({ language: "English" }),
  );
  const [client, dataSource] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/lib/findCrewData.ts", import.meta.url), "utf8"),
  ]);

  assert.equal(crewSearchParamKeys.has("language"), false);
  assert.equal(Object.hasOwn(filters, "language"), false);
  assert.equal(crewSearchParams(filters).toString(), "");
  assert.doesNotMatch(client, /label=\{c\.language\}/);
  assert.doesNotMatch(client, /draftFilters\.language/);
  assert.doesNotMatch(client, /"languages",/);
  assert.doesNotMatch(dataSource, /filters\.language/);
  assert.doesNotMatch(dataSource, /languages: sortedCrewFacet/);
});

test("removes employment type from the crew filter contract", async () => {
  const filters = parseCrewSearchFilters(
    new URLSearchParams({ contract: "Permanent" }),
  );
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(crewSearchParamKeys.has("contract"), false);
  assert.equal(Object.hasOwn(filters, "employmentType"), false);
  assert.equal(crewSearchParams(filters).toString(), "");
  assert.doesNotMatch(client, /label=\{c\.contract\}/);
  assert.doesNotMatch(client, /filters\.employmentType/);
});

test("removes skills, professional trait, and work preference filters", async () => {
  const filters = parseCrewSearchFilters(
    new URLSearchParams({
      skill: "Silver service",
      characteristic: "Team player",
      preference: "Motor yacht",
    }),
  );
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  for (const key of ["skill", "characteristic", "preference"]) {
    assert.equal(crewSearchParamKeys.has(key), false);
  }
  for (const key of ["skill", "characteristic", "workPreference"]) {
    assert.equal(Object.hasOwn(filters, key), false);
  }
  assert.equal(crewSearchParams(filters).toString(), "");
  assert.doesNotMatch(
    client,
    /label=\{c\.(?:skill|characteristic|workPreference)\}/,
  );
});

test("accepts only the personal filter options offered by My Profile", () => {
  const accepted = parseCrewSearchFilters(
    new URLSearchParams({
      gender: "Male",
      smoker: "Yes",
      visibleTattoos: "No",
    }),
  );
  assert.equal(accepted.gender, "Male");
  assert.equal(accepted.smoker, "Yes");
  assert.equal(accepted.visibleTattoos, "No");

  const rejected = parseCrewSearchFilters(
    new URLSearchParams({
      gender: "male",
      smoker: "Sometimes",
      visibleTattoos: "Prefer not to say",
    }),
  );
  assert.equal(rejected.gender, "");
  assert.equal(rejected.smoker, "");
  assert.equal(rejected.visibleTattoos, "");
});

test("keeps personal filters server-side while matching crew records", async () => {
  const dataSource = await readFile(
    new URL("../app/lib/findCrewData.ts", import.meta.url),
    "utf8",
  );

  assert.match(dataSource, /sameCrewValue\(record\.gender, filters\.gender\)/);
  assert.match(dataSource, /sameCrewValue\(record\.smoker, filters\.smoker\)/);
  assert.match(
    dataSource,
    /sameCrewValue\(record\.visibleTattoos, filters\.visibleTattoos\)/,
  );
  assert.doesNotMatch(
    dataSource.match(/export type DiscoverableCrewPreview = \{[\s\S]*?\n\};/)?.[0] || "",
    /\b(?:gender|smoker|visibleTattoos):/,
  );
});

test("removes joined date from the crew filter contract", () => {
  const filters = parseCrewSearchFilters(
    new URLSearchParams({ memberSince: "2024-05" }),
  );

  assert.equal(crewSearchParamKeys.has("memberSince"), false);
  assert.equal(Object.hasOwn(filters, "memberSince"), false);
  assert.equal(crewSearchParams(filters).toString(), "");
});

test("removes minimum language level from the crew filter contract", () => {
  const filters = parseCrewSearchFilters(
    new URLSearchParams({ level: "Advanced" }),
  );

  assert.equal(crewSearchParamKeys.has("level"), false);
  assert.equal(Object.hasOwn(filters, "languageLevel"), false);
  assert.equal(crewSearchParams(filters).toString(), "");
});

test("removes public references and documents from the crew filter contract", () => {
  const filters = parseCrewSearchFilters(
    new URLSearchParams({ references: "1", documents: "1" }),
  );

  assert.equal(crewSearchParamKeys.has("references"), false);
  assert.equal(crewSearchParamKeys.has("documents"), false);
  assert.equal(Object.hasOwn(filters, "hasReferences"), false);
  assert.equal(Object.hasOwn(filters, "hasDocuments"), false);
  assert.equal(crewSearchParams(filters).toString(), "");
});

test("rejects unsupported minimum yacht experience options", () => {
  const filters = parseCrewSearchFilters(
    new URLSearchParams({
      experienceMin: "8",
      premium: "true",
    }),
  );

  assert.equal(filters.minimumExperience, null);
  assert.equal(filters.premiumOnly, false);
  assert.equal(crewSearchParams(filters).toString(), "");
});

test("find crew uses minimum thresholds while Create a job retains every option", async () => {
  const [client, manager, searchContract, dataSource] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/hiring/jobs/JobPostsManager.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/lib/crewSearchRequest.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/lib/findCrewData.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.deepEqual([...jobMinimumYachtExperiences], [
    "0_6_months",
    "1_year",
    "2_years",
    "3_years",
    "1_3_years",
    "3_5_years",
    "5_plus_years",
    "5_10_years",
    "10_plus_years",
    "15_plus_years",
    "20_plus_years",
  ]);
  assert.deepEqual(
    jobMinimumYachtExperiences.map((option) =>
      formatJobMinimumYachtExperience(option, "en"),
    ),
    [
      "0–6 months",
      "1+ years",
      "2+ years",
      "3+ years",
      "1–3 years",
      "3–5 years",
      "5+ years",
      "5–10 years",
      "10+ years",
      "15+ years",
      "20+ years",
    ],
  );
  assert.match(
    client,
    /const findCrewMinimumExperienceThresholds = \[\s*"0_6_months",\s*"1_year",\s*"2_years",\s*"3_years",\s*"5_plus_years",\s*"10_plus_years",\s*"15_plus_years",\s*"20_plus_years",/,
  );
  assert.match(client, /findCrewMinimumExperienceThresholds\.map/);
  assert.match(
    client,
    /value === "0_6_months"[\s\S]*?"6\+ months"/,
  );
  assert.match(manager, /jobMinimumYachtExperiences\.map/);
  assert.match(
    searchContract,
    /searchParams\.get\("experienceMin"\),\s*jobMinimumYachtExperiences/,
  );
  assert.match(
    dataSource,
    /crewExperienceMatchesFilters\(preview, filters\)/,
  );
});

test("matches crew yacht experience against ranged and plus options", () => {
  assert.equal(crewExperienceMatchesYachtExperienceOption(0, "0_6_months"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(0.5, "0_6_months"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(0.6, "0_6_months"), false);
  assert.equal(crewExperienceMatchesYachtExperienceOption(1, "1_year"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(20, "1_year"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(2.5, "2_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(1.9, "2_years"), false);
  assert.equal(crewExperienceMatchesYachtExperienceOption(13.1, "2_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(3, "3_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(2.9, "3_years"), false);
  assert.equal(crewExperienceMatchesYachtExperienceOption(13.1, "3_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(2.9, "1_3_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(3.1, "1_3_years"), false);
  assert.equal(crewExperienceMatchesYachtExperienceOption(4.7, "3_5_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(5.1, "3_5_years"), false);
  assert.equal(crewExperienceMatchesYachtExperienceOption(12, "5_plus_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(8, "5_10_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(11, "5_10_years"), false);
  assert.equal(crewExperienceMatchesYachtExperienceOption(10, "10_plus_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(14.9, "15_plus_years"), false);
  assert.equal(crewExperienceMatchesYachtExperienceOption(20, "20_plus_years"), true);
  assert.equal(crewExperienceMatchesYachtExperienceOption(3, null), true);
});

test("matches minimum experience against the selected type without summing categories", () => {
  const mixedExperience = {
    yachtExperienceYears: 1,
    otherExperienceYears: 5,
  };

  assert.equal(
    crewExperienceMatchesFilters(mixedExperience, {
      ...defaultCrewSearchFilters,
      experienceType: "any",
      minimumExperience: "5_plus_years",
    }),
    true,
  );
  assert.equal(
    crewExperienceMatchesFilters(mixedExperience, {
      ...defaultCrewSearchFilters,
      experienceType: "yacht",
      minimumExperience: "5_plus_years",
    }),
    false,
  );
  assert.equal(
    crewExperienceMatchesFilters(mixedExperience, {
      ...defaultCrewSearchFilters,
      experienceType: "other",
      minimumExperience: "5_plus_years",
    }),
    true,
  );
  assert.equal(
    crewExperienceMatchesFilters(
      { yachtExperienceYears: 1.5, otherExperienceYears: 1.5 },
      {
        ...defaultCrewSearchFilters,
        experienceType: "any",
        minimumExperience: "3_years",
      },
    ),
    false,
  );
});

test("typed and minimum experience filters require a valid dated experience", () => {
  const emptyExperience = {
    yachtExperienceYears: 0,
    otherExperienceYears: 0,
  };

  assert.equal(
    crewExperienceMatchesFilters(emptyExperience, defaultCrewSearchFilters),
    true,
  );
  assert.equal(
    crewExperienceMatchesFilters(emptyExperience, {
      ...defaultCrewSearchFilters,
      experienceType: "yacht",
    }),
    false,
  );
  assert.equal(
    crewExperienceMatchesFilters(emptyExperience, {
      ...defaultCrewSearchFilters,
      experienceType: "other",
    }),
    false,
  );
  assert.equal(
    crewExperienceMatchesFilters(emptyExperience, {
      ...defaultCrewSearchFilters,
      minimumExperience: "0_6_months",
    }),
    false,
  );
  assert.equal(
    crewExperienceMatchesFilters(emptyExperience, {
      ...defaultCrewSearchFilters,
      minimumExperience: 0,
    }),
    true,
  );
  assert.equal(
    crewExperienceMatchesFilters(emptyExperience, {
      ...defaultCrewSearchFilters,
      experienceType: "yacht",
      minimumExperience: 0,
    }),
    false,
  );
});

test("treats the Find Crew six-month option as a true 0.5-year minimum", () => {
  const filters = {
    ...defaultCrewSearchFilters,
    experienceType: "yacht",
    minimumExperience: "0_6_months",
  };

  assert.equal(
    crewExperienceMatchesFilters(
      { yachtExperienceYears: 0.4999, otherExperienceYears: 0 },
      filters,
    ),
    false,
  );
  assert.equal(
    crewExperienceMatchesFilters(
      { yachtExperienceYears: 0.5, otherExperienceYears: 0 },
      filters,
    ),
    true,
  );
  assert.equal(
    crewExperienceMatchesFilters(
      { yachtExperienceYears: 0.75, otherExperienceYears: 0 },
      filters,
    ),
    true,
  );
});

test("accepts only the supported marital status filters", () => {
  assert.equal(
    parseCrewSearchFilters(
      new URLSearchParams({ maritalStatus: "Single" }),
    ).maritalStatus,
    "Single",
  );
  assert.equal(
    parseCrewSearchFilters(
      new URLSearchParams({ maritalStatus: "Separated" }),
    ).maritalStatus,
    "",
  );
  assert.equal(
    parseCrewSearchFilters(
      new URLSearchParams({ maritalStatus: "single" }),
    ).maritalStatus,
    "",
  );
});

test("merges exact yacht-work days without overstating short or overlapping roles", () => {
  const currentDate = new Date("2025-01-15T12:00:00.000Z");
  assert.equal(
    crewExperienceYearsFromDateRanges(
      [
        {
          yacht_type: "Motor Yacht",
          start_date: "2024-01-01",
          end_date: "2024-06-30",
        },
        {
          yacht_type: "Sailing Yacht",
          start_date: "2024-04-01",
          end_date: "2024-12-31",
        },
        {
          yacht_type: "__BLUDECK_OTHER_WORK__",
          start_date: "2010-01-01",
          end_date: "2020-12-31",
        },
      ],
      currentDate,
    ),
    1,
  );
  assert.equal(
    crewExperienceYearsFromDateRanges(
      [
        {
          yacht_type: "Motor Yacht",
          start_date: "2024-01-31",
          end_date: "2024-02-01",
        },
      ],
      currentDate,
    ),
    0.1,
  );
});

test("calculates overlap-safe yacht and other work durations independently", () => {
  const breakdown = crewExperienceBreakdownFromDateRanges(
    [
      {
        yacht_type: "Motor Yacht",
        start_date: "2024-01-01",
        end_date: "2024-06-30",
      },
      {
        yacht_type: "Sailing Yacht",
        start_date: "2024-04-01",
        end_date: "2024-12-31",
      },
      {
        yacht_type: "__BLUDECK_OTHER_WORK__",
        start_date: "2024-01-01",
        end_date: "2024-03-31",
      },
      {
        yacht_type: "__BLUDECK_OTHER_WORK__",
        start_date: "2024-03-01",
        end_date: "2024-06-30",
      },
    ],
    new Date("2025-01-15T12:00:00.000Z"),
  );

  assert.equal(Math.round(breakdown.yachtYears * 10) / 10, 1);
  assert.equal(Math.round(breakdown.otherYears * 10) / 10, 0.5);
});

test("uses exact duration at minimum-experience boundaries", () => {
  const justUnderOneYear = [
    {
      yacht_type: "Motor Yacht",
      start_date: "2024-01-01",
      end_date: "2024-12-29",
    },
  ];
  const exactlyOneYear = [
    {
      yacht_type: "Motor Yacht",
      start_date: "2023-01-01",
      end_date: "2023-12-31",
    },
  ];
  const underOneYearBreakdown = crewExperienceBreakdownFromDateRanges(
    justUnderOneYear,
    new Date("2025-01-15T12:00:00.000Z"),
  );
  const oneYearBreakdown = crewExperienceBreakdownFromDateRanges(
    exactlyOneYear,
    new Date("2025-01-15T12:00:00.000Z"),
  );

  assert.equal(underOneYearBreakdown.yachtYears, 0.9972);
  assert.equal(oneYearBreakdown.yachtYears, 1);
  assert.equal(
    crewExperienceYearsFromDateRanges(
      justUnderOneYear,
      new Date("2025-01-15T12:00:00.000Z"),
    ),
    1,
  );
  assert.equal(
    crewExperienceMatchesFilters(
      {
        yachtExperienceYears: underOneYearBreakdown.yachtYears,
        otherExperienceYears: underOneYearBreakdown.otherYears,
      },
      {
        ...defaultCrewSearchFilters,
        experienceType: "yacht",
        minimumExperience: "1_year",
      },
    ),
    false,
  );
  assert.equal(
    crewExperienceMatchesFilters(
      {
        yachtExperienceYears: oneYearBreakdown.yachtYears,
        otherExperienceYears: oneYearBreakdown.otherYears,
      },
      {
        ...defaultCrewSearchFilters,
        experienceType: "yacht",
        minimumExperience: "1_year",
      },
    ),
    true,
  );
  assert.equal(
    formatCrewExperienceDuration(oneYearBreakdown.yachtYears, "en"),
    "1+ years",
  );
});

test("formats experience without decimal-year labels", () => {
  assert.equal(formatCrewExperienceDuration(0, "en"), "0");
  assert.equal(formatCrewExperienceDuration(0.499, "en"), "0–6 months");
  assert.equal(formatCrewExperienceDuration(0.5, "en"), "0–6 months");
  assert.equal(formatCrewExperienceDuration(0.501, "en"), "6–12 months");
  assert.equal(formatCrewExperienceDuration(0.999, "en"), "6–12 months");
  assert.equal(formatCrewExperienceDuration(1, "en"), "1+ years");
  assert.equal(formatCrewExperienceDuration(1.2, "en"), "1+ years");
  assert.equal(formatCrewExperienceDuration(13.1, "en"), "13+ years");
  assert.equal(formatCrewExperienceDuration(0.4, "tr"), "0–6 ay");
  assert.equal(formatCrewExperienceDuration(13.1, "tr"), "13+ yıl");
});

test("ignores future, reversed, and malformed yacht experience dates", () => {
  assert.equal(
    crewExperienceYearsFromDateRanges(
      [
        { start_date: "2025-01-20", end_date: "" },
        { start_date: "2024-05-02", end_date: "2024-05-01" },
        { start_date: "not-a-date", end_date: "" },
      ],
      new Date("2025-01-15T12:00:00.000Z"),
    ),
    0,
  );
});
