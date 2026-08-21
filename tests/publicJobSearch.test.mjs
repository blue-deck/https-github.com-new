import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePublicJobs,
  createDefaultPublicJobSearchFilters,
  decodePublicJobSearchCursor,
  encodePublicJobSearchCursor,
  matchesPublicJobSearch,
  parsePublicJobSearchParams,
  publicJobSearchAnchor,
  publicJobSearchPageStartIndex,
  publicJobSearchParams,
  publicJobSearchResultFingerprint,
  publicJobYachtLengthMetres,
} from "../app/lib/publicJobSearch.ts";
import {
  formatJobTeamCoupleAnswer,
  isJobTeamCouple,
} from "../app/lib/jobPosts.ts";

const taxonomy = {
  positions: ["Captain", "Chief Stewardess"],
  departments: ["Command", "Interior"],
  employmentTypes: ["permanent", "rotation"],
  candidateTypes: ["individual", "team", "couple"],
  yachtTypes: ["motor_yacht", "sailing_yacht"],
  minimumYachtExperiences: ["3_5_years", "5_plus_years"],
  requiredLanguages: ["English", "Turkish"],
  visas: ["Schengen Visa", "US B1/B2 Visa"],
  salaryCurrencies: ["EUR", "USD"],
  salaryPeriods: ["month", "year"],
  yachtFlagCountryCodes: ["TR", "GB"],
};

test("strictly parses and round-trips the complete public job filter contract", () => {
  const source = new URLSearchParams();
  for (const [key, value] of [
    ["q", "  refit   Captain "],
    ["position", "Captain"],
    ["department", "Command"],
    ["location", "Athens"],
    ["employmentType", "rotation"],
    ["candidateType", "couple"],
    ["yachtType", "motor_yacht"],
    ["yachtFlag", "tr"],
    ["lengthMin", "40"],
    ["lengthMax", "70.5"],
    ["crewMin", "8"],
    ["crewMax", "20"],
    ["minimumExperience", "3_5_years"],
    ["language", "English"],
    ["visa", "Schengen Visa"],
    ["salaryCurrency", "EUR"],
    ["salaryPeriod", "month"],
    ["salaryMin", "6000"],
    ["salaryMax", "9000"],
    ["sort", "salary_highest"],
  ]) {
    source.append(key, value);
  }

  const parsed = parsePublicJobSearchParams(source, taxonomy);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.filters.query, "refit Captain");
  assert.deepEqual(parsed.filters.yachtFlagCountryCodes, ["TR"]);
  assert.equal(parsed.filters.yachtLengthMaxMetres, 70.5);
  assert.equal(parsed.filters.salaryCurrency, "EUR");

  const reparsed = parsePublicJobSearchParams(
    publicJobSearchParams(parsed.filters),
    taxonomy,
  );
  assert.equal(reparsed.ok, true);
  assert.deepEqual(reparsed.filters, parsed.filters);
});

test("rejects unknown, duplicated, invalid, and logically unsafe filters", () => {
  assert.equal(
    parsePublicJobSearchParams(new URLSearchParams("privateField=x"), taxonomy).ok,
    false,
  );
  assert.equal(
    parsePublicJobSearchParams(new URLSearchParams("q=a&q=b"), taxonomy).ok,
    false,
  );
  assert.equal(
    parsePublicJobSearchParams(
      new URLSearchParams("employmentType=freelance"),
      taxonomy,
    ).ok,
    false,
  );
  assert.equal(
    parsePublicJobSearchParams(
      new URLSearchParams("lengthMin=60&lengthMax=40"),
      taxonomy,
    ).ok,
    false,
  );
  assert.equal(
    parsePublicJobSearchParams(
      new URLSearchParams("salaryMin=5000"),
      taxonomy,
    ).ok,
    false,
  );
});

test("rejects malformed decimals, negative values, and non-finite tokens", () => {
  for (const query of [
    "lengthMin=-1",
    "lengthMin=NaN",
    "lengthMin=1.234",
    "salaryMax=Infinity&salaryCurrency=EUR&salaryPeriod=month",
    "crewMin=1.5",
  ]) {
    assert.equal(
      parsePublicJobSearchParams(new URLSearchParams(query), taxonomy).ok,
      false,
      query,
    );
  }
});

test("rejects removed brand, requirement, policy, build-year, date-recency, and page-size filters", () => {
  for (const query of [
    "yachtBrand=Feadship",
    "skill=Crew%20management",
    "trait=Leadership",
    "certificate=STCW%20Basic%20Safety%20Training",
    "smoker=non_smoker",
    "smoker=smoker_accepted",
    "smoker=no_preference",
    "tattoo=accepted",
    "tattoo=not_accepted",
    "tattoo=no_preference",
    "buildYearMin=2018",
    "buildYearMax=2026",
    "startFrom=2026-09-01",
    "startTo=2026-10-01",
    "postedWithin=14",
    "limit=50",
  ]) {
    assert.equal(
      parsePublicJobSearchParams(new URLSearchParams(query), taxonomy).ok,
      false,
      query,
    );
  }
});

test("matches every structured public-detail category with normalized yacht units", () => {
  const filters = createDefaultPublicJobSearchFilters();
  Object.assign(filters, {
    query: "GÖRÜNÜR, refit-captain crew-management",
    positions: ["Captain"],
    departments: ["Command"],
    location: "ath",
    employmentTypes: ["rotation"],
    candidateTypes: ["couple"],
    yachtTypes: ["motor_yacht"],
    yachtFlagCountryCodes: ["TR"],
    yachtLengthMinMetres: 49.9,
    yachtLengthMaxMetres: 50.1,
    crewMemberCountMin: 10,
    crewMemberCountMax: 15,
    minimumYachtExperiences: ["3_5_years"],
    requiredLanguages: ["English"],
    requiredVisas: ["Schengen Visa"],
    salaryCurrency: "EUR",
    salaryPeriod: "month",
    salaryMin: 6_000,
    salaryMax: 9_000,
  });

  assert.equal(
    matchesPublicJobSearch(sampleJob(), filters, "2026-08-08T12:00:00.000Z"),
    true,
  );
  assert.equal(publicJobYachtLengthMetres(164.04, "ft"), 49.9994);
  assert.equal(
    matchesPublicJobSearch(
      {
        ...sampleJob(),
        requiredCharacteristics: [],
        requiredCertificates: [],
      },
      filters,
    ),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(
      { ...sampleJob(), requiredVisas: ["US B1/B2 Visa"] },
      filters,
      "2026-08-08T12:00:00.000Z",
    ),
    false,
  );
});

test("Team/Couple uses one binary meaning for current and legacy candidate values", () => {
  const yesFilters = createDefaultPublicJobSearchFilters();
  yesFilters.candidateTypes = ["team", "couple"];
  const noFilters = createDefaultPublicJobSearchFilters();
  noFilters.candidateTypes = ["individual"];

  assert.equal(
    matchesPublicJobSearch(sampleJob({ candidateType: "team" }), yesFilters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ candidateType: "couple" }), yesFilters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ candidateType: "individual" }),
      yesFilters,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ candidateType: "individual" }),
      noFilters,
    ),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ candidateType: "team" }), noFilters),
    false,
  );
  assert.equal(isJobTeamCouple("individual"), false);
  assert.equal(isJobTeamCouple("team"), true);
  assert.equal(isJobTeamCouple("couple"), true);
  assert.equal(formatJobTeamCoupleAnswer("team", "en"), "Yes");
  assert.equal(formatJobTeamCoupleAnswer("individual", "tr"), "Hayır");
});

test("uses OR within a category, AND between categories, inclusive ranges, and fails null fields closed", () => {
  const filters = createDefaultPublicJobSearchFilters();
  Object.assign(filters, {
    positions: ["Chief Stewardess", "Captain"],
    departments: ["Command"],
    requiredLanguages: ["Turkish"],
    yachtLengthMinMetres: 49.9994,
    yachtLengthMaxMetres: 49.9994,
    salaryCurrency: "EUR",
    salaryPeriod: "month",
    salaryMin: 8_000,
    salaryMax: 8_000,
  });
  const snapshot = "2026-08-08T12:00:00.000Z";

  assert.equal(matchesPublicJobSearch(sampleJob(), filters, snapshot), true);
  assert.equal(
    matchesPublicJobSearch(
      { ...sampleJob(), department: "Interior" },
      filters,
      snapshot,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      { ...sampleJob(), yachtLength: null, yachtLengthUnit: null },
      filters,
      snapshot,
    ),
    false,
  );
});

test("salary filters require the published currency and period and use inclusive overlap", () => {
  const filters = createDefaultPublicJobSearchFilters();
  Object.assign(filters, {
    salaryCurrency: "EUR",
    salaryPeriod: "month",
    salaryMin: 8_000,
    salaryMax: 9_000,
  });
  const snapshot = "2026-08-08T12:00:00.000Z";
  assert.equal(matchesPublicJobSearch(sampleJob(), filters, snapshot), true);
  assert.equal(
    matchesPublicJobSearch(
      { ...sampleJob(), salary: { min: 7_000, max: 8_000, currency: "USD", period: "month" } },
      filters,
      snapshot,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      { ...sampleJob(), salary: { min: 7_000, max: 8_000, currency: "EUR", period: "year" } },
      filters,
      snapshot,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch({ ...sampleJob(), salary: null }, filters, snapshot),
    false,
  );
});

test("normalizes feet to metres at small and large boundaries", () => {
  assert.equal(publicJobYachtLengthMetres(1, "ft"), 0.3048);
  assert.equal(publicJobYachtLengthMetres(100, "ft"), 30.48);
  assert.equal(publicJobYachtLengthMetres(100, "m"), 100);
  assert.equal(publicJobYachtLengthMetres(0, "ft"), null);
  assert.equal(publicJobYachtLengthMetres(null, "m"), null);
});

test("sort anchors provide stable load-more semantics", () => {
  const jobs = [
    sampleJob({ id: "10000000-0000-4000-8000-000000000001", publishedAt: "2026-08-08T10:00:00.000Z" }),
    sampleJob({ id: "10000000-0000-4000-8000-000000000002", publishedAt: "2026-08-07T10:00:00.000Z" }),
    sampleJob({ id: "10000000-0000-4000-8000-000000000003", publishedAt: "2026-08-06T10:00:00.000Z" }),
  ].sort((left, right) => comparePublicJobs(left, right, "newest"));
  const anchor = publicJobSearchAnchor(jobs[1], "newest");
  assert.equal(publicJobSearchPageStartIndex(jobs, "newest", anchor), 2);
});

test("all sorts place missing primary values last and keep deterministic ties", () => {
  const complete = sampleJob({
    id: "10000000-0000-4000-8000-000000000002",
  });
  const missing = sampleJob({
    id: "10000000-0000-4000-8000-000000000003",
    startDate: null,
    salary: null,
    yachtLength: null,
    yachtLengthUnit: null,
  });
  for (const sort of [
    "start_soonest",
    "salary_highest",
    "salary_lowest",
    "yacht_length_desc",
    "yacht_length_asc",
  ]) {
    assert.deepEqual(
      [missing, complete].sort((left, right) =>
        comparePublicJobs(left, right, sort),
      ).map((job) => job.id),
      [complete.id, missing.id],
      sort,
    );
  }
  const earlierId = sampleJob({
    id: "10000000-0000-4000-8000-000000000001",
  });
  assert.equal(comparePublicJobs(earlierId, complete, "newest") < 0, true);
});

test("cursor is opaque, filter-bound, authenticated, and round-trips", async () => {
  const filters = createDefaultPublicJobSearchFilters();
  filters.positions = ["Captain"];
  const payload = {
    snapshotAt: "2026-08-08T12:00:00.000Z",
    resultFingerprint: "a".repeat(64),
    total: 3,
    anchor: publicJobSearchAnchor(sampleJob(), "newest"),
  };
  const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const token = await encodePublicJobSearchCursor({
    filters,
    payload,
    key,
    randomBytes: (length) => new Uint8Array(length).fill(7),
  });
  assert.match(token, /^v1\./);
  assert.equal(token.includes(payload.anchor.id), false);
  assert.deepEqual(
    await decodePublicJobSearchCursor({ filters, token, key }),
    payload,
  );

  const changedFilters = { ...filters, query: "different" };
  assert.equal(
    await decodePublicJobSearchCursor({ filters: changedFilters, token, key }),
    null,
  );
  const parts = token.split(".");
  parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  assert.equal(
    await decodePublicJobSearchCursor({ filters, token: parts.join("."), key }),
    null,
  );
});

test("cursor rejects wrong keys, versions, truncation, invalid payloads, and reuses no nonce", async () => {
  const filters = createDefaultPublicJobSearchFilters();
  const key = new Uint8Array(32).fill(4);
  const otherKey = new Uint8Array(32).fill(5);
  const payload = {
    snapshotAt: "2026-08-08T12:00:00.000Z",
    resultFingerprint: "b".repeat(64),
    total: 3,
    anchor: publicJobSearchAnchor(sampleJob(), "newest"),
  };
  const first = await encodePublicJobSearchCursor({ filters, payload, key });
  const second = await encodePublicJobSearchCursor({ filters, payload, key });
  assert.notEqual(first, second);
  assert.equal(
    await decodePublicJobSearchCursor({ filters, token: first, key: otherKey }),
    null,
  );
  assert.equal(
    await decodePublicJobSearchCursor({
      filters,
      token: first.replace(/^v1\./, "v2."),
      key,
    }),
    null,
  );
  assert.equal(
    await decodePublicJobSearchCursor({
      filters,
      token: first.slice(0, -12),
      key,
    }),
    null,
  );
  assert.equal(
    await encodePublicJobSearchCursor({
      filters,
      payload: { ...payload, snapshotAt: "not-a-date" },
      key,
    }),
    null,
  );
  assert.equal(
    await encodePublicJobSearchCursor({
      filters,
      payload: {
        ...payload,
        anchor: { ...payload.anchor, id: "not-a-uuid" },
      },
      key,
    }),
    null,
  );
  assert.equal(
    await encodePublicJobSearchCursor({
      filters,
      payload,
      key,
      randomBytes: () => new Uint8Array(8),
    }),
    null,
  );
  assert.equal(
    await encodePublicJobSearchCursor({
      filters,
      payload: { ...payload, resultFingerprint: "short" },
      key,
    }),
    null,
  );
});

test("result fingerprint changes with membership, order, or mutable public state", async () => {
  const first = sampleJob();
  const second = sampleJob({
    id: "10000000-0000-4000-8000-000000000002",
    salary: { min: 8_000, max: 9_000, currency: "EUR", period: "month" },
  });
  const baseline = await publicJobSearchResultFingerprint([first, second]);
  assert.match(baseline, /^[0-9a-f]{64}$/);
  assert.notEqual(
    await publicJobSearchResultFingerprint([second, first]),
    baseline,
  );
  assert.notEqual(
    await publicJobSearchResultFingerprint([
      first,
      { ...second, startDate: "2026-10-01" },
    ]),
    baseline,
  );
  assert.notEqual(await publicJobSearchResultFingerprint([first]), baseline);
});

function sampleJob(overrides = {}) {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    listingNumber: "12345",
    title: "Refit Captain",
    position: "Captain",
    department: "Command",
    employmentType: "rotation",
    candidateType: "couple",
    smokerPolicy: "non_smoker",
    visibleTattooPolicy: "not_accepted",
    requiredLanguages: ["English", "Turkish"],
    requiredSkills: ["Crew management"],
    requiredCharacteristics: ["Leadership"],
    requiredCertificates: ["STCW Basic Safety Training"],
    requiredVisas: ["Schengen Visa"],
    yachtBrand: "Feadship",
    yachtFlagCountryCode: "TR",
    yachtBuildYear: 2022,
    yachtType: "motor_yacht",
    yachtLength: 164.04,
    yachtLengthUnit: "ft",
    crewMemberCount: 12,
    minimumYachtExperience: "3_5_years",
    location: "Athens, Greece",
    startDate: "2026-09-15",
    summary: "Visible tattoo policy and refit programme.",
    description: "Lead a professional international crew.",
    responsibilities: ["Passage planning"],
    requirements: ["Strong leadership"],
    benefits: ["Private medical insurance"],
    salary: { min: 7_000, max: 8_000, currency: "EUR", period: "month" },
    publishedAt: "2026-08-05T12:00:00.000Z",
    ...overrides,
  };
}
