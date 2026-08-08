import assert from "node:assert/strict";
import test from "node:test";
import {
  crewSearchFilterCount,
  crewSearchParams,
  parseCrewSearchFilters,
} from "../app/lib/crewSearch.ts";
import { crewExperienceYearsFromDateRanges } from "../app/lib/crewExperience.ts";

test("round-trips every public crew search criterion through the URL contract", () => {
  const source = new URLSearchParams({
    q: "  Chief   Stewardess  ",
    position: "Chief Stewardess",
    location: "Athens",
    availability: "Available",
    contract: "Permanent",
    nationality: "Turkish",
    skill: "Silver service",
    characteristic: "Team player",
    preference: "Motor yacht",
    language: "English",
    level: "Advanced",
    experienceMin: "3",
    experienceMax: "10",
    memberSince: "2024-05",
    premium: "1",
    photo: "1",
    gallery: "1",
    references: "1",
    documents: "1",
  });

  const filters = parseCrewSearchFilters(source);
  assert.equal(filters.query, "Chief Stewardess");
  assert.equal(filters.minimumExperience, 3);
  assert.equal(filters.maximumExperience, 10);
  assert.equal(filters.hasReferences, true);
  const normalizedSource = new URLSearchParams(source);
  normalizedSource.set("q", "Chief Stewardess");
  assert.equal(
    crewSearchParams(filters).toString(),
    normalizedSource.toString(),
  );
  assert.equal(crewSearchFilterCount(filters), 19);
});

test("bounds malformed experience and month values without widening a request", () => {
  const filters = parseCrewSearchFilters(
    new URLSearchParams({
      experienceMin: "8",
      experienceMax: "3",
      memberSince: "2024-19",
      premium: "true",
    }),
  );

  assert.equal(filters.minimumExperience, 8);
  assert.equal(filters.maximumExperience, 8);
  assert.equal(filters.memberSince, "");
  assert.equal(filters.premiumOnly, false);
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
