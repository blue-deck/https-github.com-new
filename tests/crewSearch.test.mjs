import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  crewExperienceMatchesYachtExperienceOption,
  crewSearchFilterCount,
  crewSearchParamKeys,
  crewSearchParams,
  parseCrewSearchFilters,
} from "../app/lib/crewSearch.ts";
import { crewAvailabilityStatuses } from "../app/lib/crewDiscovery.ts";
import { crewExperienceYearsFromDateRanges } from "../app/lib/crewExperience.ts";
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

test("find crew filter labels omit all and tüm prefixes", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(client, /:\s*"All [^"]+"/);
  assert.doesNotMatch(client, /:\s*"Tüm [^"]+"/);
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
    "position",
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
    /function submitAllCrewFilters\(\) \{\s*setFilters\(normalizeCrewSearchFilters\(draftFilters\)\);/,
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

test("availability select uses its field label as the empty option", async () => {
  const client = await readFile(
    new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    client,
    /label=\{c\.availability\}\s+value=\{draftFilters\.availability\}/,
  );
  assert.doesNotMatch(
    client,
    /label=\{c\.availability\}\s+emptyOptionLabel=\{c\.any\}/,
  );
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

test("primary crew filter controls use equal desktop columns", async () => {
  const [client, loading] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/find-crew/loading.tsx", import.meta.url), "utf8"),
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
});

test("find crew reuses every My Profile availability option", async () => {
  const [client, route] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/find-crew/route.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.deepEqual([...crewAvailabilityStatuses], [
    "Available",
    "In 1 week",
    "In 1 month",
    "Open to offers",
    "Not available",
  ]);
  assert.match(client, /options=\{crewAvailabilityStatuses\}/);
  assert.doesNotMatch(client, /options=\{facets\.availabilities\}/);
  assert.match(
    route,
    /searchParams\.get\("availability"\),\s*crewAvailabilityStatuses/,
  );
});

test("find crew validates nationality against the complete country dataset", async () => {
  const route = await readFile(
    new URL("../app/api/find-crew/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /import \{ nationalityFilterValues \}/);
  assert.match(
    route,
    /searchParams\.get\("nationality"\),\s*nationalityFilterValues/,
  );
});

test("round-trips every public crew search criterion through the URL contract", () => {
  const source = new URLSearchParams({
    q: "  Chief   Stewardess  ",
    position: "Chief Stewardess",
    availability: "Available",
    nationality: "Turkish",
    maritalStatus: "Married",
    gender: "Female",
    smoker: "No",
    visibleTattoos: "Yes",
    experienceMin: "3_5_years",
    premium: "1",
    photo: "1",
    gallery: "1",
    teamCouple: "1",
  });

  const filters = parseCrewSearchFilters(source);
  assert.equal(filters.query, "Chief Stewardess");
  assert.equal(filters.minimumExperience, "3_5_years");
  const normalizedSource = new URLSearchParams(source);
  normalizedSource.set("q", "Chief Stewardess");
  assert.equal(
    crewSearchParams(filters).toString(),
    normalizedSource.toString(),
  );
  assert.equal(filters.maritalStatus, "Married");
  assert.equal(filters.gender, "Female");
  assert.equal(filters.smoker, "No");
  assert.equal(filters.visibleTattoos, "Yes");
  assert.equal(filters.hasTeamCouple, true);
  assert.equal(crewSearchFilterCount(filters), 13);
});

test("filters Team/Couple crew as separate profiles from accepted connections", async () => {
  const [client, route, dataSource] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/api/find-crew/route.ts", import.meta.url), "utf8"),
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
  assert.match(route, /"premium", "photo", "gallery", "teamCouple"/);
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

test("find crew reuses every Create a job post yacht experience option", async () => {
  const [client, manager, route, dataSource] = await Promise.all([
    readFile(
      new URL("../app/find-crew/FindCrewClient.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/hiring/jobs/JobPostsManager.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/find-crew/route.ts", import.meta.url),
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
  assert.match(client, /jobMinimumYachtExperiences\.map/);
  assert.match(client, /formatJobMinimumYachtExperience\(option, language\)/);
  assert.match(manager, /jobMinimumYachtExperiences\.map/);
  assert.match(
    route,
    /searchParams\.get\("experienceMin"\),\s*jobMinimumYachtExperiences/,
  );
  assert.match(
    dataSource,
    /crewExperienceMatchesYachtExperienceOption\(\s*preview\.experienceYears,\s*filters\.minimumExperience/,
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
