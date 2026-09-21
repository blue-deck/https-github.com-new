import { canonicalNationalityValue } from "./countries";
import {
  crewSearchParams,
  defaultCrewSearchFilters,
  maximumCrewPositionSelections,
} from "./crewSearch";
import {
  createDefaultPublicJobSearchFilters,
  publicJobSearchParams,
} from "./publicJobSearch";

export type HomeJobsSearchInput = {
  query: string;
  positions: readonly string[];
  location: string;
};

export type HomeCrewSearchInput = {
  query: string;
  positions: readonly string[];
  nationality: string;
};

export function homeJobsSearchHref(input: HomeJobsSearchInput) {
  const params = publicJobSearchParams({
    ...createDefaultPublicJobSearchFilters(),
    query: normalizedSearchText(input.query),
    positions: boundedPositions(input.positions),
    location: normalizedSearchText(input.location),
  });
  return searchHref("/jobs", params);
}

export function homeCrewSearchHref(input: HomeCrewSearchInput) {
  const params = crewSearchParams({
    ...defaultCrewSearchFilters,
    query: normalizedSearchText(input.query),
    positions: boundedPositions(input.positions),
    nationality: canonicalNationalityValue(input.nationality),
  });
  return searchHref("/find-crew", params);
}

function normalizedSearchText(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function boundedPositions(positions: readonly string[]) {
  return Array.from(new Set(positions)).slice(0, maximumCrewPositionSelections);
}

function searchHref(path: "/jobs" | "/find-crew", params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
