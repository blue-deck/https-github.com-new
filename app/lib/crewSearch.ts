export type CrewSearchFilters = {
  query: string;
  position: string;
  location: string;
  availability: string;
  employmentType: string;
  nationality: string;
  skill: string;
  characteristic: string;
  workPreference: string;
  language: string;
  minimumExperience: number | null;
  memberSince: string;
};

export type CrewSearchFacets = {
  positions: string[];
  locations: string[];
  availabilities: string[];
  employmentTypes: string[];
  nationalities: string[];
  skills: string[];
  characteristics: string[];
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
  characteristics: [],
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
  characteristic: "",
  workPreference: "",
  language: "",
  minimumExperience: null,
  memberSince: "",
};

export const crewSearchParamKeys = new Set([
  "q",
  "position",
  "location",
  "availability",
  "contract",
  "nationality",
  "skill",
  "characteristic",
  "preference",
  "language",
  "experienceMin",
  "memberSince",
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
    characteristic: limitedText(
      readSearchParam(source, "characteristic"),
      120,
    ),
    workPreference: limitedText(
      readSearchParam(source, "preference"),
      120,
    ),
    language: limitedText(readSearchParam(source, "language"), 80),
    minimumExperience,
    memberSince: validMonth(readSearchParam(source, "memberSince")),
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
    characteristic: limitedText(value.characteristic, 120),
    workPreference: limitedText(value.workPreference, 120),
    language: limitedText(value.language, 80),
    minimumExperience,
    memberSince: validMonth(value.memberSince),
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
  setText(params, "characteristic", normalized.characteristic);
  setText(params, "preference", normalized.workPreference);
  setText(params, "language", normalized.language);
  setNumber(params, "experienceMin", normalized.minimumExperience);
  setText(params, "memberSince", normalized.memberSince);
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

function validMonth(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return "";
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12 ? value : "";
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
