import { nationalityFilterValues } from "./countries";
import { crewDirectoryAvailabilityStatuses } from "./crewDiscovery";
import {
  crewGenderOptions,
  crewMaritalStatuses,
  crewSearchParamKeys,
  crewYesNoOptions,
  isCrewExperienceType,
  isValidCrewPositionSearchValues,
  maximumCrewPositionSelections,
  parseCrewSearchFilters,
  type CrewSearchFilters,
} from "./crewSearch";
import { jobMinimumYachtExperiences } from "./jobPosts";
import { publicJobSearchTaxonomy } from "./publicJobSearchConfig";

export type CrewSearchRequestParseResult =
  | {
      ok: true;
      filters: CrewSearchFilters;
      cursor: string;
    }
  | { ok: false };

const crewBooleanSearchParamKeys = [
  "premium",
  "photo",
  "gallery",
  "teamCouple",
] as const;
const crewSearchCursorPattern =
  /^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{1,256}\.[A-Za-z0-9_-]{22}$/;

export function parseCrewSearchRequest(
  searchParams: URLSearchParams,
): CrewSearchRequestParseResult {
  const keys = Array.from(new Set(searchParams.keys()));
  if (
    keys.some((key) => {
      const valueCount = searchParams.getAll(key).length;
      return (
        !crewSearchParamKeys.has(key) ||
        (key === "position"
          ? valueCount > maximumCrewPositionSelections
          : valueCount !== 1)
      );
    }) ||
    Array.from(searchParams.values()).some((value) => value.length > 256) ||
    !isValidCrewPositionSearchValues(
      searchParams.getAll("position"),
      publicJobSearchTaxonomy.positions,
    )
  ) {
    return { ok: false };
  }

  for (const key of crewBooleanSearchParamKeys) {
    const value = searchParams.get(key);
    if (value !== null && value !== "1") return { ok: false };
  }

  const experienceType = searchParams.get("experienceType");
  if (experienceType !== null && !isCrewExperienceType(experienceType)) {
    return { ok: false };
  }

  if (
    !isAllowedCrewOption(
      searchParams.get("availability"),
      crewDirectoryAvailabilityStatuses,
    ) ||
    !isAllowedCrewOption(
      searchParams.get("experienceMin"),
      jobMinimumYachtExperiences,
    ) ||
    !isAllowedCrewOption(
      searchParams.get("nationality"),
      nationalityFilterValues,
    ) ||
    !isAllowedCrewOption(
      searchParams.get("maritalStatus"),
      crewMaritalStatuses,
    ) ||
    !isAllowedCrewOption(searchParams.get("gender"), crewGenderOptions) ||
    !isAllowedCrewOption(searchParams.get("smoker"), crewYesNoOptions) ||
    !isAllowedCrewOption(
      searchParams.get("visibleTattoos"),
      crewYesNoOptions,
    )
  ) {
    return { ok: false };
  }

  const cursor = searchParams.get("cursor") || "";
  if (cursor && !crewSearchCursorPattern.test(cursor)) {
    return { ok: false };
  }

  return {
    ok: true,
    filters: parseCrewSearchFilters(
      searchParams,
      publicJobSearchTaxonomy.positions,
    ),
    cursor,
  };
}

function isAllowedCrewOption(
  value: string | null,
  options: readonly string[],
) {
  return value === null || options.includes(value);
}
