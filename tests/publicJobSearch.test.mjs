import assert from "node:assert/strict";
import test from "node:test";
import {
  comparePublicJobs,
  createDefaultPublicJobSearchFilters,
  decodePublicJobSearchCursor,
  encodePublicJobSearchCursor,
  hasPublicJobSearchFilters,
  matchesPublicJobSearch,
  parsePublicJobSearchParams,
  publicJobSearchAnchor,
  publicJobSearchPageStartIndex,
  publicJobSearchParams,
  publicJobSearchResultFingerprint,
  publicJobYachtLengthMetres,
} from "../app/lib/publicJobSearch.ts";
import {
  formatJobYachtProgram,
  formatJobSalaryCurrencyOption,
  formatJobSalaryPeriod,
  formatJobTeamCoupleAnswer,
  isJobSalaryCurrency,
  isJobTeamCouple,
  jobSalaryCurrencyOptions,
  jobSalaryPeriods,
  jobYachtPrograms,
} from "../app/lib/jobPosts.ts";

const taxonomy = {
  positions: ["Captain", "Chief Stewardess"],
  departments: ["Command", "Interior"],
  employmentTypes: ["permanent", "rotation"],
  candidateTypes: ["individual", "team", "couple"],
  yachtTypes: ["motor_yacht", "sailing_yacht"],
  yachtPrograms: jobYachtPrograms,
  salaryCurrencies: jobSalaryCurrencyOptions,
  salaryPeriods: jobSalaryPeriods,
  yachtFlagCountryCodes: ["TR", "GB"],
};

test("default salary units stay inactive until the salary filter is used", () => {
  const defaults = createDefaultPublicJobSearchFilters();
  const params = publicJobSearchParams(defaults);

  assert.equal(defaults.salaryCurrency, null);
  assert.equal(defaults.salaryPeriod, null);
  assert.equal(defaults.yachtProgram, null);
  assert.equal(params.has("salaryCurrency"), false);
  assert.equal(params.has("salaryPeriod"), false);
  assert.equal(params.has("yachtProgram"), false);
  assert.equal(hasPublicJobSearchFilters(defaults), false);
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({
        salary: {
          min: 4_000,
          max: 5_000,
          currency: "USD",
          period: "year",
        },
      }),
      defaults,
    ),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ salary: null }), defaults),
    true,
  );
});

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
    ["yachtProgram", "private_charter"],
    ["yachtFlag", "tr"],
    ["lengthMin", "20"],
    ["lengthMax", "70"],
    ["crewMin", "8"],
    ["crewMax", "18"],
    ["salaryCurrency", "EUR"],
    ["salaryPeriod", "month"],
    ["salaryMin", "1000"],
    ["salaryMax", "10000"],
    ["sort", "salary_highest"],
  ]) {
    source.append(key, value);
  }

  const parsed = parsePublicJobSearchParams(source, taxonomy);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.filters.query, "refit Captain");
  assert.deepEqual(parsed.filters.yachtFlagCountryCodes, ["TR"]);
  assert.equal(parsed.filters.yachtLengthMinMetres, 20);
  assert.equal(parsed.filters.yachtLengthMaxMetres, 70);
  assert.equal(parsed.filters.crewMemberCountMin, 8);
  assert.equal(parsed.filters.crewMemberCountMax, 18);
  assert.equal(parsed.filters.yachtProgram, "private_charter");
  assert.equal(parsed.filters.salaryCurrency, "EUR");
  assert.equal(
    publicJobSearchParams(parsed.filters).get("yachtProgram"),
    "private_charter",
  );
  assert.equal(publicJobSearchParams(parsed.filters).get("salaryMin"), "1000");
  assert.equal(publicJobSearchParams(parsed.filters).get("salaryMax"), "10000");

  const reparsed = parsePublicJobSearchParams(
    publicJobSearchParams(parsed.filters),
    taxonomy,
  );
  assert.equal(reparsed.ok, true);
  assert.deepEqual(reparsed.filters, parsed.filters);
});

test("yacht program is a scalar filter with shared values and labels", () => {
  assert.deepEqual(jobYachtPrograms, [
    "private",
    "charter",
    "private_charter",
  ]);
  assert.deepEqual(
    jobYachtPrograms.map((program) => formatJobYachtProgram(program, "en")),
    ["Private", "Charter", "Private & Charter"],
  );

  for (const yachtProgram of jobYachtPrograms) {
    const parsed = parsePublicJobSearchParams(
      new URLSearchParams({ yachtProgram }),
      taxonomy,
    );
    assert.equal(parsed.ok, true, yachtProgram);
    if (!parsed.ok) continue;
    assert.equal(parsed.filters.yachtProgram, yachtProgram);
    assert.equal(
      publicJobSearchParams(parsed.filters).toString(),
      `yachtProgram=${yachtProgram}`,
    );
    assert.equal(hasPublicJobSearchFilters(parsed.filters), true);
  }
});

test("salary currency filters mirror the create-job picker and match every supported currency", () => {
  assert.deepEqual(
    jobSalaryCurrencyOptions.map(formatJobSalaryCurrencyOption),
    ["EUR (€)", "USD ($)", "GBP (£)", "AUD (A$)", "TL (TRY)"],
  );
  assert.equal(isJobSalaryCurrency("NZD"), true);
  assert.equal(
    parsePublicJobSearchParams(
      new URLSearchParams("salaryCurrency=NZD"),
      taxonomy,
    ).ok,
    false,
  );

  jobSalaryCurrencyOptions.forEach((currency, index) => {
    const params = new URLSearchParams({
      salaryCurrency: currency,
      salaryPeriod: "month",
      salaryMin: "8000",
      salaryMax: "9000",
    });
    const parsed = parsePublicJobSearchParams(params, taxonomy);
    assert.equal(parsed.ok, true, currency);
    if (!parsed.ok) return;

    assert.equal(parsed.filters.salaryCurrency, currency);
    assert.equal(
      publicJobSearchParams(parsed.filters).get("salaryCurrency"),
      currency,
    );
    assert.equal(
      matchesPublicJobSearch(
        sampleJob({
          salary: {
            min: 7_000,
            max: 8_000,
            currency,
            period: "month",
          },
        }),
        parsed.filters,
      ),
      true,
      currency,
    );

    const otherCurrency =
      jobSalaryCurrencyOptions[(index + 1) % jobSalaryCurrencyOptions.length];
    assert.equal(
      matchesPublicJobSearch(
        sampleJob({
          salary: {
            min: 7_000,
            max: 8_000,
            currency: otherCurrency,
            period: "month",
          },
        }),
        parsed.filters,
      ),
      false,
      `${currency} must not match ${otherCurrency}`,
    );
  });
});

test("salary period filters mirror the create-job picker and match every supported period", () => {
  assert.deepEqual(
    jobSalaryPeriods.map((period) => formatJobSalaryPeriod(period, "en")),
    ["Day", "Week", "Month", "Year"],
  );
  assert.deepEqual(
    jobSalaryPeriods.map((period) => formatJobSalaryPeriod(period, "tr")),
    ["Gün", "Hafta", "Ay", "Yıl"],
  );
  assert.equal(
    parsePublicJobSearchParams(
      new URLSearchParams("salaryPeriod=fortnight"),
      taxonomy,
    ).ok,
    false,
  );

  jobSalaryPeriods.forEach((period, index) => {
    const params = new URLSearchParams({
      salaryCurrency: "EUR",
      salaryPeriod: period,
      salaryMin: "8000",
      salaryMax: "9000",
    });
    const parsed = parsePublicJobSearchParams(params, taxonomy);
    assert.equal(parsed.ok, true, period);
    if (!parsed.ok) return;

    assert.equal(parsed.filters.salaryPeriod, period);
    assert.equal(
      publicJobSearchParams(parsed.filters).get("salaryPeriod"),
      period,
    );
    assert.equal(
      matchesPublicJobSearch(
        sampleJob({
          salary: {
            min: 7_000,
            max: 8_000,
            currency: "EUR",
            period,
          },
        }),
        parsed.filters,
      ),
      true,
      period,
    );

    const otherPeriod =
      jobSalaryPeriods[(index + 1) % jobSalaryPeriods.length];
    assert.equal(
      matchesPublicJobSearch(
        sampleJob({
          salary: {
            min: 7_000,
            max: 8_000,
            currency: "EUR",
            period: otherPeriod,
          },
        }),
        parsed.filters,
      ),
      false,
      `${period} must not match ${otherPeriod}`,
    );
  });
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
      new URLSearchParams("yachtProgram=private&yachtProgram=charter"),
      taxonomy,
    ).ok,
    false,
  );
  assert.equal(
    parsePublicJobSearchParams(
      new URLSearchParams("yachtProgram=private-charter"),
      taxonomy,
    ).ok,
    false,
  );
  assert.equal(
    parsePublicJobSearchParams(
      new URLSearchParams("visa=Schengen%20Visa"),
      taxonomy,
    ).ok,
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
      new URLSearchParams(
        "salaryCurrency=EUR&salaryPeriod=month&salaryMin=6000&salaryMax=5000",
      ),
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
    "lengthMin=-5",
    "lengthMin=NaN",
    "lengthMin=2.5",
    "lengthMin=7",
    "lengthMin=205",
    "lengthMin=5&lengthMin=10",
    "lengthMax=-5",
    "lengthMax=NaN",
    "lengthMax=2.5",
    "lengthMax=7",
    "lengthMax=205",
    "lengthMax=5&lengthMax=10",
    "lengthMin=50&lengthMax=20",
    "salaryMax=Infinity&salaryCurrency=EUR&salaryPeriod=month",
    "salaryMax=1000001&salaryCurrency=EUR&salaryPeriod=month",
    "salaryMax=1000.5&salaryCurrency=EUR&salaryPeriod=month",
    "salaryMax=1.000&salaryCurrency=EUR&salaryPeriod=month",
    "salaryMax=1%2C000&salaryCurrency=EUR&salaryPeriod=month",
    "salaryMax=1e3&salaryCurrency=EUR&salaryPeriod=month",
    "salaryMax=1000&salaryMax=2000&salaryCurrency=EUR&salaryPeriod=month",
    "crewMin=-1",
    "crewMin=0",
    "crewMin=1.5",
    "crewMin=51",
    "crewMin=200",
    "crewMin=201",
    "crewMin=NaN",
    "crewMin=Infinity",
    "crewMin=1&crewMin=2",
    "crewMax=-1",
    "crewMax=51",
    "crewMax=1.5",
    "crewMax=NaN",
    "crewMax=Infinity",
    "crewMax=1&crewMax=2",
    "crewMin=20&crewMax=10",
  ]) {
    assert.equal(
      parsePublicJobSearchParams(new URLSearchParams(query), taxonomy).ok,
      false,
      query,
    );
  }
});

test("accepts the exact whole-number salary boundaries", () => {
  const parsed = parsePublicJobSearchParams(
    new URLSearchParams({
      salaryCurrency: "EUR",
      salaryPeriod: "month",
      salaryMin: "0",
      salaryMax: "1000000",
    }),
    taxonomy,
  );

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.filters.salaryMin, 0);
  assert.equal(parsed.filters.salaryMax, 1_000_000);
  assert.equal(publicJobSearchParams(parsed.filters).get("salaryMax"), "1000000");
});

test("rejects removed experience, brand, language, requirement, policy, build-year, date-recency, and page-size filters", () => {
  for (const query of [
    "minimumExperience=3_5_years",
    "yachtBrand=Feadship",
    "language=English",
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
    yachtProgram: "private",
    yachtFlagCountryCodes: ["TR"],
    yachtLengthMaxMetres: 50,
    crewMemberCountMin: 10,
    crewMemberCountMax: 20,
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
      { ...sampleJob(), yachtProgram: "charter" },
      filters,
      "2026-08-08T12:00:00.000Z",
    ),
    false,
  );
});

test("yacht program matching is exact while All includes combined and legacy listings", () => {
  const privateFilters = createDefaultPublicJobSearchFilters();
  privateFilters.yachtProgram = "private";

  assert.equal(
    matchesPublicJobSearch(sampleJob({ yachtProgram: "private" }), privateFilters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ yachtProgram: "charter" }), privateFilters),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtProgram: "private_charter" }),
      privateFilters,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ yachtProgram: null }), privateFilters),
    false,
  );

  const allPrograms = createDefaultPublicJobSearchFilters();
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtProgram: "private_charter" }),
      allPrograms,
    ),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ yachtProgram: null }), allPrograms),
    true,
  );
});

test("minimum yacht experience remains searchable job content without a structured filter", () => {
  const filters = createDefaultPublicJobSearchFilters();
  filters.query = "plus";

  assert.equal(matchesPublicJobSearch(sampleJob(), filters), false);
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ minimumYachtExperience: "5_plus_years" }),
      filters,
    ),
    true,
  );
});

test("required languages remain searchable job content without a structured filter", () => {
  const filters = createDefaultPublicJobSearchFilters();
  filters.query = "Turkish";

  assert.equal(matchesPublicJobSearch(sampleJob(), filters), true);
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ requiredLanguages: ["English"] }),
      filters,
    ),
    false,
  );
});

test("required visas remain searchable job content without a structured filter", () => {
  const filters = createDefaultPublicJobSearchFilters();
  filters.query = "Schengen";

  assert.equal(matchesPublicJobSearch(sampleJob(), filters), true);
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ requiredVisas: ["US B1/B2 Visa"] }),
      filters,
    ),
    false,
  );
});

test("Team/Couple filters treat an Any listing as a wildcard", () => {
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
  assert.equal(
    matchesPublicJobSearch(sampleJob({ candidateType: "any" }), yesFilters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ candidateType: "any" }), noFilters),
    true,
  );
  assert.equal(isJobTeamCouple("any"), false);
  assert.equal(isJobTeamCouple("individual"), false);
  assert.equal(isJobTeamCouple("team"), true);
  assert.equal(isJobTeamCouple("couple"), true);
  assert.equal(formatJobTeamCoupleAnswer("any", "en"), "Any");
  assert.equal(formatJobTeamCoupleAnswer("any", "tr"), "Tümü");
  assert.equal(formatJobTeamCoupleAnswer("team", "en"), "Yes");
  assert.equal(formatJobTeamCoupleAnswer("individual", "tr"), "Hayır");
});

test("uses OR within a category, AND between categories, inclusive ranges, and fails null fields closed", () => {
  const filters = createDefaultPublicJobSearchFilters();
  Object.assign(filters, {
    positions: ["Chief Stewardess", "Captain"],
    departments: ["Command"],
    yachtLengthMaxMetres: 50,
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

test("crew size range is inclusive and preserves legacy minimum-only searches", () => {
  const filters = createDefaultPublicJobSearchFilters();
  assert.equal(filters.crewMemberCountMin, null);
  assert.equal(filters.crewMemberCountMax, null);
  assert.equal(publicJobSearchParams(filters).has("crewMin"), false);
  assert.equal(publicJobSearchParams(filters).has("crewMax"), false);
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: null }), filters),
    true,
  );

  filters.crewMemberCountMin = 50;
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 50 }), filters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 51 }), filters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 200 }), filters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 49 }), filters),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: null }), filters),
    false,
  );

  Object.assign(filters, {
    crewMemberCountMin: 10,
    crewMemberCountMax: 20,
  });
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 10 }), filters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 20 }), filters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 9 }), filters),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 21 }), filters),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ crewMemberCount: null }),
      filters,
    ),
    false,
  );

  Object.assign(filters, {
    crewMemberCountMin: null,
    crewMemberCountMax: 12,
  });
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 1 }), filters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 12 }), filters),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(sampleJob({ crewMemberCount: 13 }), filters),
    false,
  );
});

test("every crew size endpoint round-trips through the public URL contract", () => {
  for (const minimum of Array.from({ length: 50 }, (_, index) => index + 1)) {
    const parsed = parsePublicJobSearchParams(
      new URLSearchParams(`crewMin=${minimum}`),
      taxonomy,
    );
    assert.equal(parsed.ok, true, String(minimum));
    if (!parsed.ok) continue;
    assert.equal(parsed.filters.crewMemberCountMin, minimum);
    assert.equal(
      publicJobSearchParams(parsed.filters).get("crewMin"),
      String(minimum),
    );
    assert.equal(
      publicJobSearchParams(parsed.filters).toString(),
      `crewMin=${minimum}`,
    );
    assert.equal(publicJobSearchParams(parsed.filters).has("crewMax"), false);
  }

  for (const maximum of Array.from({ length: 51 }, (_, index) => index)) {
    const parsed = parsePublicJobSearchParams(
      new URLSearchParams(`crewMax=${maximum}`),
      taxonomy,
    );
    assert.equal(parsed.ok, true, String(maximum));
    if (!parsed.ok) continue;
    assert.equal(parsed.filters.crewMemberCountMax, maximum);
    assert.equal(
      publicJobSearchParams(parsed.filters).get("crewMax"),
      String(maximum),
    );
    assert.equal(
      publicJobSearchParams(parsed.filters).toString(),
      `crewMax=${maximum}`,
    );
    assert.equal(publicJobSearchParams(parsed.filters).has("crewMin"), false);
  }
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
  assert.equal(publicJobYachtLengthMetres(88, "ft"), 26.8224);
  assert.equal(publicJobYachtLengthMetres(100, "ft"), 30.48);
  assert.equal(publicJobYachtLengthMetres(100, "m"), 100);
  assert.equal(publicJobYachtLengthMetres(0, "ft"), null);
  assert.equal(publicJobYachtLengthMetres(null, "m"), null);
});

test("yacht length range uses 5-metre steps while the visual 0–200 endpoints remain unfiltered by default", () => {
  const defaults = createDefaultPublicJobSearchFilters();
  assert.equal(defaults.yachtLengthMinMetres, null);
  assert.equal(defaults.yachtLengthMaxMetres, null);
  assert.equal(publicJobSearchParams(defaults).has("lengthMin"), false);
  assert.equal(publicJobSearchParams(defaults).has("lengthMax"), false);

  for (const [query, minimum, maximum] of [
    ["lengthMin=20", 20, null],
    ["lengthMax=30", null, 30],
    ["lengthMax=200", null, 200],
    ["lengthMax=0", null, 0],
    ["lengthMin=200", 200, null],
    ["lengthMin=20&lengthMax=50", 20, 50],
    ["lengthMin=0&lengthMax=200", 0, 200],
    ["lengthMin=25&lengthMax=25", 25, 25],
  ]) {
    const parsed = parsePublicJobSearchParams(
      new URLSearchParams(query),
      taxonomy,
    );
    assert.equal(parsed.ok, true, query);
    if (!parsed.ok) continue;
    assert.equal(parsed.filters.yachtLengthMinMetres, minimum);
    assert.equal(parsed.filters.yachtLengthMaxMetres, maximum);
    const roundTrip = publicJobSearchParams(parsed.filters);
    assert.equal(roundTrip.get("lengthMin"), minimum === null ? null : String(minimum));
    assert.equal(roundTrip.get("lengthMax"), maximum === null ? null : String(maximum));
  }
});

test("yacht length range converts feet to metres, keeps both bounds inclusive, and fails missing values closed", () => {
  const filters = createDefaultPublicJobSearchFilters();
  filters.yachtLengthMinMetres = 20;
  filters.yachtLengthMaxMetres = 50;

  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 88, yachtLengthUnit: "ft" }),
      filters,
    ),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 60, yachtLengthUnit: "ft" }),
      filters,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 200, yachtLengthUnit: "ft" }),
      filters,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 20, yachtLengthUnit: "m" }),
      filters,
    ),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 50, yachtLengthUnit: "m" }),
      filters,
    ),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 19.9999, yachtLengthUnit: "m" }),
      filters,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 50.0001, yachtLengthUnit: "m" }),
      filters,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: null, yachtLengthUnit: null }),
      filters,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: null, yachtLengthUnit: null }),
      createDefaultPublicJobSearchFilters(),
    ),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 250, yachtLengthUnit: "m" }),
      createDefaultPublicJobSearchFilters(),
    ),
    true,
  );

  const explicitFullSpan = createDefaultPublicJobSearchFilters();
  explicitFullSpan.yachtLengthMinMetres = 0;
  explicitFullSpan.yachtLengthMaxMetres = 200;
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 200, yachtLengthUnit: "m" }),
      explicitFullSpan,
    ),
    true,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: 250, yachtLengthUnit: "m" }),
      explicitFullSpan,
    ),
    false,
  );
  assert.equal(
    matchesPublicJobSearch(
      sampleJob({ yachtLength: null, yachtLengthUnit: null }),
      explicitFullSpan,
    ),
    false,
  );
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
  const changedMinimum = { ...filters, yachtLengthMinMetres: 25 };
  assert.equal(
    await decodePublicJobSearchCursor({
      filters: changedMinimum,
      token,
      key,
    }),
    null,
  );
  const changedMaximum = { ...filters, yachtLengthMaxMetres: 55 };
  assert.equal(
    await decodePublicJobSearchCursor({
      filters: changedMaximum,
      token,
      key,
    }),
    null,
  );
  const changedCrewMaximum = { ...filters, crewMemberCountMax: 18 };
  assert.equal(
    await decodePublicJobSearchCursor({
      filters: changedCrewMaximum,
      token,
      key,
    }),
    null,
  );
  const changedYachtProgram = { ...filters, yachtProgram: "charter" };
  assert.equal(
    await decodePublicJobSearchCursor({
      filters: changedYachtProgram,
      token,
      key,
    }),
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
  assert.notEqual(
    await publicJobSearchResultFingerprint([
      first,
      { ...second, minimumYachtExperience: "5_plus_years" },
    ]),
    baseline,
  );
  assert.notEqual(
    await publicJobSearchResultFingerprint([
      first,
      { ...second, requiredLanguages: ["English"] },
    ]),
    baseline,
  );
  assert.notEqual(
    await publicJobSearchResultFingerprint([
      first,
      { ...second, yachtProgram: "charter" },
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
    yachtProgram: "private",
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
