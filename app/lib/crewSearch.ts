export type CrewSearchFilters = {
  query: string;
  position: string;
  location: string;
  availability: string;
  employmentType: string;
  nationality: string;
  skill: string;
  workPreference: string;
  language: string;
  minimumExperience: number | null;
};

export type CrewSearchFacets = {
  positions: string[];
  locations: string[];
  availabilities: string[];
  employmentTypes: string[];
  nationalities: string[];
  skills: string[];
  workPreferences: string[];
  languages: string[];
};

export const emptyCrewSearchFacets: CrewSearchFacets = {
  positions: [],
  locations: [],
  availabilities: [],
  employmentTypes: [],
  nationalities: [],
  skills: [],
  workPreferences: [],
  languages: [],
};

export const defaultCrewSearchFilters: CrewSearchFilters = {
  query: "",
  position: "",
  location: "",
  availability: "",
  employmentType: "",
  nationality: "",
  skill: "",
  workPreference: "",
  language: "",
  minimumExperience: null,
};

export const crewSearchParamKeys = new Set([
  "q",
  "position",
  "location",
  "availability",
  "contract",
  "nationality",
  "skill",
  "preference",
  "language",
  "experienceMin",
  "cursor",
]);

type SearchParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function parseCrewSearchFilters(
  source: SearchParamSource,
): CrewSearchFilters {
  const minimumExperience = boundedNumber(
    readSearchParam(source, "experienceMin"),
    0,
    60,
  );
  return normalizeCrewSearchFilters({
    query: limitedText(readSearchParam(source, "q"), 120),
    position: limitedText(readSearchParam(source, "position"), 120),
    location: limitedText(readSearchParam(source, "location"), 120),
    availability: limitedText(
      readSearchParam(source, "availability"),
      120,
    ),
    employmentType: limitedText(readSearchParam(source, "contract"), 120),
    nationality: limitedText(readSearchParam(source, "nationality"), 80),
    skill: limitedText(readSearchParam(source, "skill"), 120),
    workPreference: limitedText(
      readSearchParam(source, "preference"),
      120,
    ),
    language: limitedText(readSearchParam(source, "language"), 80),
    minimumExperience,
  });
}

export function normalizeCrewSearchFilters(
  value: Partial<CrewSearchFilters>,
): CrewSearchFilters {
  const minimumExperience = boundedNumberValue(
    value.minimumExperience,
    0,
    60,
  );
  return {
    query: limitedText(value.query, 120),
    position: limitedText(value.position, 120),
    location: limitedText(value.location, 120),
    availability: limitedText(value.availability, 120),
    employmentType: limitedText(value.employmentType, 120),
    nationality: limitedText(value.nationality, 80),
    skill: limitedText(value.skill, 120),
    workPreference: limitedText(value.workPreference, 120),
    language: limitedText(value.language, 80),
    minimumExperience,
  };
}

export function crewSearchParams(filters: CrewSearchFilters) {
  const normalized = normalizeCrewSearchFilters(filters);
  const params = new URLSearchParams();
  setText(params, "q", normalized.query);
  setText(params, "position", normalized.position);
  setText(params, "location", normalized.location);
  setText(params, "availability", normalized.availability);
  setText(params, "contract", normalized.employmentType);
  setText(params, "nationality", normalized.nationality);
  setText(params, "skill", normalized.skill);
  setText(params, "preference", normalized.workPreference);
  setText(params, "language", normalized.language);
  setNumber(params, "experienceMin", normalized.minimumExperience);
  return params;
}

export function crewSearchFilterCount(filters: CrewSearchFilters) {
  const params = crewSearchParams(filters);
  return Array.from(params.keys()).length;
}

export function crewSearchFingerprintInput(filters: CrewSearchFilters) {
  return crewSearchParams(filters).toString();
}

function readSearchParam(source: SearchParamSource, key: string) {
  if (source instanceof URLSearchParams) return source.get(key) || "";
  const value = source[key];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function limitedText(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maximumLength)
    : "";
}

function boundedNumber(value: string, minimum: number, maximum: number) {
  if (!value || !/^\d+(?:\.\d)?$/.test(value)) return null;
  return boundedNumberValue(Number(value), minimum, maximum);
}

function boundedNumberValue(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? Math.round(value * 10) / 10
    : null;
}

function setText(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
}

function setNumber(
  params: URLSearchParams,
  key: string,
  value: number | null,
) {
  if (value !== null) params.set(key, String(value));
}
