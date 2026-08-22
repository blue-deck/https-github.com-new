import type { JobMinimumYachtExperience } from "./jobPosts";

const crewYachtExperienceBounds: Record<
  JobMinimumYachtExperience,
  { minimum: number; maximum: number | null }
> = {
  "0_6_months": { minimum: 0, maximum: 0.5 },
  "1_year": { minimum: 1, maximum: null },
  "2_years": { minimum: 2, maximum: null },
  "3_years": { minimum: 3, maximum: null },
  "1_3_years": { minimum: 1, maximum: 3 },
  "3_5_years": { minimum: 3, maximum: 5 },
  "5_plus_years": { minimum: 5, maximum: null },
  "5_10_years": { minimum: 5, maximum: 10 },
  "10_plus_years": { minimum: 10, maximum: null },
  "15_plus_years": { minimum: 15, maximum: null },
  "20_plus_years": { minimum: 20, maximum: null },
};

export type CrewSearchFilters = {
  query: string;
  position: string;
  availability: string;
  nationality: string;
  maritalStatus: string;
  gender: string;
  smoker: string;
  visibleTattoos: string;
  experienceType: CrewExperienceType;
  minimumExperience: JobMinimumYachtExperience | null;
  premiumOnly: boolean;
  hasPhoto: boolean;
  hasGallery: boolean;
  hasTeamCouple: boolean;
};

export const crewExperienceTypes = ["any", "yacht", "other"] as const;
export type CrewExperienceType = (typeof crewExperienceTypes)[number];

export type CrewSearchFacets = {
  positions: string[];
  availabilities: string[];
  employmentTypes: string[];
  nationalities: string[];
  maritalStatuses: string[];
  skills: string[];
  characteristics: string[];
  workPreferences: string[];
};

export const crewMaritalStatuses = ["Single", "Married"] as const;
export const crewGenderOptions = ["Female", "Male"] as const;
export const crewYesNoOptions = ["No", "Yes"] as const;

export const emptyCrewSearchFacets: CrewSearchFacets = {
  positions: [],
  availabilities: [],
  employmentTypes: [],
  nationalities: [],
  maritalStatuses: [],
  skills: [],
  characteristics: [],
  workPreferences: [],
};

export const defaultCrewSearchFilters: CrewSearchFilters = {
  query: "",
  position: "",
  availability: "",
  nationality: "",
  maritalStatus: "",
  gender: "",
  smoker: "",
  visibleTattoos: "",
  experienceType: "any",
  minimumExperience: null,
  premiumOnly: false,
  hasPhoto: false,
  hasGallery: false,
  hasTeamCouple: false,
};

export const crewSearchParamKeys = new Set([
  "q",
  "position",
  "availability",
  "nationality",
  "maritalStatus",
  "gender",
  "smoker",
  "visibleTattoos",
  "experienceType",
  "experienceMin",
  "premium",
  "photo",
  "gallery",
  "teamCouple",
  "cursor",
]);

type SearchParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function parseCrewSearchFilters(
  source: SearchParamSource,
): CrewSearchFilters {
  const minimumExperience = normalizedMinimumYachtExperience(
    readSearchParam(source, "experienceMin"),
  );
  return normalizeCrewSearchFilters({
    query: limitedText(readSearchParam(source, "q"), 120),
    position: limitedText(readSearchParam(source, "position"), 120),
    availability: limitedText(
      readSearchParam(source, "availability"),
      120,
    ),
    nationality: limitedText(readSearchParam(source, "nationality"), 80),
    maritalStatus: normalizedMaritalStatus(
      readSearchParam(source, "maritalStatus"),
    ),
    gender: normalizedCrewProfileOption(
      readSearchParam(source, "gender"),
      crewGenderOptions,
    ),
    smoker: normalizedCrewProfileOption(
      readSearchParam(source, "smoker"),
      crewYesNoOptions,
    ),
    visibleTattoos: normalizedCrewProfileOption(
      readSearchParam(source, "visibleTattoos"),
      crewYesNoOptions,
    ),
    experienceType: normalizeCrewExperienceType(
      readSearchParam(source, "experienceType"),
    ),
    minimumExperience,
    premiumOnly: readSearchParam(source, "premium") === "1",
    hasPhoto: readSearchParam(source, "photo") === "1",
    hasGallery: readSearchParam(source, "gallery") === "1",
    hasTeamCouple: readSearchParam(source, "teamCouple") === "1",
  });
}

export function normalizeCrewSearchFilters(
  value: Partial<CrewSearchFilters>,
): CrewSearchFilters {
  const minimumExperience = normalizedMinimumYachtExperience(
    value.minimumExperience,
  );
  return {
    query: limitedText(value.query, 120),
    position: limitedText(value.position, 120),
    availability: limitedText(value.availability, 120),
    nationality: limitedText(value.nationality, 80),
    maritalStatus: normalizedMaritalStatus(value.maritalStatus),
    gender: normalizedCrewProfileOption(value.gender, crewGenderOptions),
    smoker: normalizedCrewProfileOption(value.smoker, crewYesNoOptions),
    visibleTattoos: normalizedCrewProfileOption(
      value.visibleTattoos,
      crewYesNoOptions,
    ),
    experienceType: normalizeCrewExperienceType(value.experienceType),
    minimumExperience,
    premiumOnly: value.premiumOnly === true,
    hasPhoto: value.hasPhoto === true,
    hasGallery: value.hasGallery === true,
    hasTeamCouple: value.hasTeamCouple === true,
  };
}

export function crewSearchParams(filters: CrewSearchFilters) {
  const normalized = normalizeCrewSearchFilters(filters);
  const params = new URLSearchParams();
  setText(params, "q", normalized.query);
  setText(params, "position", normalized.position);
  setText(params, "availability", normalized.availability);
  setText(params, "nationality", normalized.nationality);
  setText(params, "maritalStatus", normalized.maritalStatus);
  setText(params, "gender", normalized.gender);
  setText(params, "smoker", normalized.smoker);
  setText(params, "visibleTattoos", normalized.visibleTattoos);
  if (normalized.experienceType !== "any") {
    params.set("experienceType", normalized.experienceType);
  }
  setNullableText(params, "experienceMin", normalized.minimumExperience);
  setBoolean(params, "premium", normalized.premiumOnly);
  setBoolean(params, "photo", normalized.hasPhoto);
  setBoolean(params, "gallery", normalized.hasGallery);
  setBoolean(params, "teamCouple", normalized.hasTeamCouple);
  return params;
}

export function crewSearchFilterCount(filters: CrewSearchFilters) {
  const params = crewSearchParams(filters);
  return Array.from(params.keys()).length;
}

export function crewSearchFingerprintInput(filters: CrewSearchFilters) {
  return crewSearchParams(filters).toString();
}

export function isCrewExperienceType(
  value: unknown,
): value is CrewExperienceType {
  return crewExperienceTypes.includes(value as CrewExperienceType);
}

export function crewExperienceMatchesFilters(
  experience: { yachtExperienceYears: number; otherExperienceYears: number },
  filters: Pick<CrewSearchFilters, "experienceType" | "minimumExperience">,
) {
  const experienceType = normalizeCrewExperienceType(filters.experienceType);
  const minimumExperience = normalizedMinimumYachtExperience(
    filters.minimumExperience,
  );
  const yachtMatches = experienceMeetsMinimum(
    experience.yachtExperienceYears,
    minimumExperience,
  );
  const otherMatches = experienceMeetsMinimum(
    experience.otherExperienceYears,
    minimumExperience,
  );

  if (experienceType === "yacht") return yachtMatches;
  if (experienceType === "other") return otherMatches;
  return minimumExperience === null || yachtMatches || otherMatches;
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

function normalizedMaritalStatus(value: unknown) {
  const normalized = limitedText(value, 16);
  return crewMaritalStatuses.includes(
    normalized as (typeof crewMaritalStatuses)[number],
  )
    ? normalized
    : "";
}

function normalizedCrewProfileOption(
  value: unknown,
  options: readonly string[],
) {
  const normalized = limitedText(value, 60);
  return options.includes(normalized) ? normalized : "";
}

function normalizeCrewExperienceType(value: unknown): CrewExperienceType {
  return isCrewExperienceType(value) ? value : "any";
}

function normalizedMinimumYachtExperience(
  value: unknown,
): JobMinimumYachtExperience | null {
  return typeof value === "string" &&
    Object.hasOwn(crewYachtExperienceBounds, value)
    ? (value as JobMinimumYachtExperience)
    : null;
}

export function crewExperienceMatchesYachtExperienceOption(
  experienceYears: number,
  option: JobMinimumYachtExperience | null,
) {
  if (option === null) return true;
  if (!Number.isFinite(experienceYears) || experienceYears < 0) return false;

  const { minimum, maximum } = crewYachtExperienceBounds[option];
  return (
    experienceYears >= minimum &&
    (maximum === null || experienceYears <= maximum)
  );
}

function experienceMeetsMinimum(
  years: number,
  option: JobMinimumYachtExperience | null,
) {
  if (!Number.isFinite(years) || years <= 0) return false;
  if (option === null) return true;

  const minimum = option === "0_6_months"
    ? 0.5
    : crewYachtExperienceBounds[option].minimum;
  return years >= minimum;
}

function setText(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
}

function setNullableText(
  params: URLSearchParams,
  key: string,
  value: string | null,
) {
  if (value !== null) params.set(key, value);
}

function setBoolean(params: URLSearchParams, key: string, value: boolean) {
  if (value) params.set(key, "1");
}
