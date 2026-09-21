import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

// Next resolves extensionless local TypeScript imports; use the same source
// modules in Node so these tests exercise the real destination parsers.
const libraryRoot = new URL("../app/lib/", import.meta.url);
const loader = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith(".") &&
      context.parentURL?.startsWith(libraryRoot.href) &&
      !/\.[a-z]+$/i.test(specifier)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const [homeSearch, jobSearch, crewSearch, crewRequest, config, countries] =
  await Promise.all([
    import("../app/lib/homeSearch.ts"),
    import("../app/lib/publicJobSearch.ts"),
    import("../app/lib/crewSearch.ts"),
    import("../app/lib/crewSearchRequest.ts"),
    import("../app/lib/publicJobSearchConfig.ts"),
    import("../app/lib/countries.ts"),
  ]);
loader.deregister();

const { homeJobsSearchHref, homeCrewSearchHref } = homeSearch;
const { parsePublicJobSearchParams, publicJobSearchParams } = jobSearch;
const { crewSearchParams, maximumCrewPositionSelections } = crewSearch;
const { parseCrewSearchRequest } = crewRequest;
const { publicJobSearchTaxonomy } = config;

function searchParams(href) {
  return new URL(href, "https://bluedeck.test").searchParams;
}

function parseJobs(href) {
  const parsed = parsePublicJobSearchParams(
    searchParams(href),
    publicJobSearchTaxonomy,
  );
  assert.equal(parsed.ok, true);
  return parsed.filters;
}

function parseCrew(href) {
  const parsed = parseCrewSearchRequest(searchParams(href));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.cursor, "");
  return parsed.filters;
}

test("homepage Careers transfers every field and multiple positions into Find Jobs", () => {
  const href = homeJobsSearchHref({
    query: "  Refit   captain  ",
    positions: ["Deckhand", "Captain", "Deckhand"],
    location: "  Athens,   Greece  ",
  });
  assert.ok(href.startsWith("/jobs?"));
  const params = searchParams(href);
  assert.deepEqual(params.getAll("position"), ["Captain", "Deckhand"]);
  const filters = parseJobs(href);
  assert.equal(filters.query, "Refit captain");
  assert.equal(filters.location, "Athens, Greece");
  assert.deepEqual(filters.positions, ["Captain", "Deckhand"]);
  assert.equal(publicJobSearchParams(filters).toString(), params.toString());
  assert.deepEqual([...params.keys()], ["q", "position", "position", "location"]);
});

test("homepage Crew transfers keyword, multiple positions, and selected country", () => {
  const href = homeCrewSearchHref({
    query: "  Silver   service ",
    positions: ["Deckhand", "Chief Stewardess"],
    nationality: "Turkey",
  });
  assert.ok(href.startsWith("/find-crew?"));
  const filters = parseCrew(href);
  assert.equal(filters.query, "Silver service");
  assert.deepEqual(filters.positions, ["Chief Stewardess", "Deckhand"]);
  assert.equal(filters.nationality, "Turkey");
  assert.equal(crewSearchParams(filters).toString(), searchParams(href).toString());
  assert.equal(searchParams(href).has("location"), false);
});

test("every nationality picker value produces an accepted crew search", () => {
  for (const country of countries.nationalityOptions) {
    const href = homeCrewSearchHref({
      query: "",
      positions: [],
      nationality: countries.nationalityStorageValue(country),
    });
    assert.equal(parseCrew(href).nationality, country.countryEn);
  }
  for (const legacyValue of ["Turkish", "TR", "Türkiye"]) {
    const filters = parseCrew(homeCrewSearchHref({
      query: "",
      positions: [],
      nationality: legacyValue,
    }));
    assert.equal(filters.nationality, "Turkey");
  }
});

test("empty homepage searches retain plain destination paths and default filters", () => {
  const jobsHref = homeJobsSearchHref({ query: " \t ", positions: [], location: "\n" });
  const crewHref = homeCrewSearchHref({ query: " ", positions: [], nationality: " " });
  assert.equal(jobsHref, "/jobs");
  assert.equal(crewHref, "/find-crew");
  assert.deepEqual(parseJobs(jobsHref), jobSearch.createDefaultPublicJobSearchFilters());
  assert.deepEqual(parseCrew(crewHref), crewSearch.defaultCrewSearchFilters);
});

test("special characters stay inside values without changing routes or filters", () => {
  const query = "İstanbul & C++ / refit? q=deck#crew";
  const location = "Çeşme, Türkiye & Aegean";
  const href = homeJobsSearchHref({ query, positions: ["Captain"], location });
  const filters = parseJobs(href);
  assert.equal(filters.query, query);
  assert.equal(filters.location, location);
  assert.equal(new URL(href, "https://bluedeck.test").hash, "");
  assert.equal(searchParams(href).getAll("q").length, 1);
  const crewHref = homeCrewSearchHref({
    query,
    positions: ["Captain"],
    nationality: "Åland Islands",
  });
  assert.equal(parseCrew(crewHref).query, query);
  assert.equal(parseCrew(crewHref).nationality, "Aland Islands");
});

test("homepage inputs remain within both receiver length and position limits", () => {
  const positions = publicJobSearchTaxonomy.positions.slice(0, 14);
  assert.equal(positions.length, 14);
  const query = "x".repeat(160);
  const jobs = parseJobs(homeJobsSearchHref({
    query,
    positions,
    location: `  ${"y".repeat(160)} `,
  }));
  const crew = parseCrew(homeCrewSearchHref({
    query,
    positions,
    nationality: "Turkey",
  }));
  assert.equal(jobs.query.length, 120);
  assert.equal(jobs.location.length, 120);
  assert.equal(crew.query.length, 120);
  assert.equal(jobs.positions.length, maximumCrewPositionSelections);
  assert.equal(crew.positions.length, maximumCrewPositionSelections);
  assert.equal(positions.length, 14);
});
