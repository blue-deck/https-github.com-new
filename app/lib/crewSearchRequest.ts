import { nationalityFilterValues } from "./countries";
import { crewDirectoryAvailabilityStatuses } from "./crewDiscovery";
import { parseCrewSearchRequestWithOptions } from "./crewSearch";
import { jobMinimumYachtExperiences } from "./jobPosts";
import { publicJobSearchTaxonomy } from "./publicJobSearchConfig";

export function parseCrewSearchRequest(
  searchParams: URLSearchParams,
) {
  return parseCrewSearchRequestWithOptions(searchParams, {
    positions: publicJobSearchTaxonomy.positions,
    availabilities: crewDirectoryAvailabilityStatuses,
    nationalities: nationalityFilterValues,
    minimumExperiences: jobMinimumYachtExperiences,
  });
}
