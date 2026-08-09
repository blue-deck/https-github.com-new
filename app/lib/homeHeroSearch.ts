import {
  createDefaultPublicJobSearchFilters,
  publicJobSearchParams,
} from "./publicJobSearch";
import { isJobEmploymentType } from "./jobPosts";
import {
  crewSearchParams,
  defaultCrewSearchFilters,
} from "./crewSearch";
import { yachtPositionTitles } from "./yachtOperations";

export type HomeHeroSearchValues = {
  position: string;
  location: string;
  employmentType: string;
};

const yachtPositionsByFoldedTitle = new Map(
  yachtPositionTitles.map((position) => [fold(position), position]),
);

export function buildHomeJobSearchHref(values: HomeHeroSearchValues) {
  const filters = createDefaultPublicJobSearchFilters();
  const requestedPosition = cleanText(values.position);
  const canonicalPosition = yachtPositionsByFoldedTitle.get(
    fold(requestedPosition),
  );
  const employmentType = cleanText(values.employmentType);

  if (canonicalPosition) {
    filters.positions = [canonicalPosition];
  } else if (requestedPosition) {
    filters.query = requestedPosition;
  }

  filters.location = cleanText(values.location);
  if (isJobEmploymentType(employmentType)) {
    filters.employmentTypes = [employmentType];
  }

  return withSearchParams("/jobs", publicJobSearchParams(filters));
}

export function buildHomeCrewSearchHref(values: HomeHeroSearchValues) {
  const filters = {
    ...defaultCrewSearchFilters,
    position: cleanText(values.position),
    location: cleanText(values.location),
    employmentType: cleanText(values.employmentType),
  };

  return withSearchParams("/find-crew", crewSearchParams(filters));
}

function withSearchParams(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? pathname + "?" + query : pathname;
}

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function fold(value: string) {
  return cleanText(value).toLocaleLowerCase("en-US");
}
