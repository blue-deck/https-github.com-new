import { parseCrewDiscoverySettings } from "./crewDiscovery";
import { countExperienceReferences as countLinkedExperienceReferences } from "./crewExperienceReferences";
import {
  crewExperienceBreakdownFromDateRanges,
  crewExperienceYearsFromDateRanges,
} from "./crewExperience";

export const premiumProfileCompletionThreshold = 85;

export type CompletionProfile = {
  profile_photo_url?: unknown;
  full_name?: unknown;
  current_position?: unknown;
  current_positions?: unknown;
  date_of_birth?: unknown;
  nationality?: unknown;
  gender?: unknown;
  height_cm?: unknown;
  weight_kg?: unknown;
  smoker?: unknown;
  visible_tattoos?: unknown;
  phone?: unknown;
  email?: unknown;
  location?: unknown;
  bio?: unknown;
  languages?: unknown;
  personal_skills?: unknown;
  personal_characteristics?: unknown;
  work_preferences?: unknown;
  notes?: unknown;
};

export type CompletionExperience = {
  id?: unknown;
  yacht_name?: unknown;
  yacht_type?: unknown;
  yacht_program?: unknown;
  yacht_size?: unknown;
  location?: unknown;
  position?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  description?: unknown;
};

export type CompletionReference = {
  crew_experience_id?: unknown;
};

const otherWorkExperienceMarker = "__BLUDECK_OTHER_WORK__";
const experienceMetadataPrefix = "__BLUDECK_EXPERIENCE_META__";

export function calculateCrewProfileCompletion({
  profile,
  experiences,
}: {
  profile: CompletionProfile;
  experiences: CompletionExperience[];
}) {
  const discovery = parseCrewDiscoverySettings(text(profile.notes));
  const visibleSkills = [
    ...stringArray(profile.personal_skills),
    ...stringArray(profile.personal_characteristics),
  ];
  const visiblePreferences = Array.from(
    new Set([
      ...stringArray(profile.work_preferences),
      ...discovery.preferredLocations,
      ...discovery.employmentTypes,
    ]),
  );
  const visibleLanguages = languageEntries(profile.languages);
  const normalizedExperiences = experiences.map(normalizeCompletionExperience);
  const yachtExperiences = normalizedExperiences.filter(
    (experience) => text(experience.yacht_type) !== otherWorkExperienceMarker,
  );
  const otherWorkExperiences = normalizedExperiences.filter(
    (experience) => text(experience.yacht_type) === otherWorkExperienceMarker,
  );
  const firstPageExperiences = [...yachtExperiences, ...otherWorkExperiences].slice(0, 3);
  const firstPageExperienceScore =
    firstPageExperiences.reduce(
      (sum, experience) => sum + experienceCompletionRatio(experience),
      0,
    ) / 3;

  const completionChecks: Array<{ ratio: number; weight: number }> = [
    { ratio: text(profile.profile_photo_url) ? 1 : 0, weight: 8 },
    { ratio: text(profile.full_name) ? 1 : 0, weight: 5 },
    { ratio: currentPosition(profile) ? 1 : 0, weight: 5 },
    {
      ratio: filledRatio([
        profile.date_of_birth,
        profile.nationality,
        profile.gender,
        profile.height_cm,
        profile.weight_kg,
        profile.smoker,
        profile.visible_tattoos,
      ]),
      weight: 14,
    },
    {
      ratio: filledRatio([profile.phone, profile.email, profile.location]),
      weight: 12,
    },
    { ratio: textCompletionRatio(profile.bio, 200), weight: 14 },
    { ratio: firstPageExperienceScore, weight: 24 },
    { ratio: Math.min(visibleLanguages.length / 4, 1), weight: 6 },
    { ratio: Math.min(visibleSkills.length / 10, 1), weight: 8 },
    { ratio: Math.min(visiblePreferences.length / 5, 1), weight: 4 },
  ];
  const totalWeight = completionChecks.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = completionChecks.reduce(
    (sum, item) => sum + item.ratio * item.weight,
    0,
  );

  return Math.max(
    0,
    Math.min(100, Math.round((completedWeight / totalWeight) * 100)),
  );
}

export function crewExperienceYears(
  experiences: CompletionExperience[],
  currentDate = new Date(),
) {
  return crewExperienceYearsFromDateRanges(
    experiences.map(normalizeCompletionExperience),
    currentDate,
  );
}

export function crewExperienceBreakdown(
  experiences: CompletionExperience[],
  currentDate = new Date(),
) {
  return crewExperienceBreakdownFromDateRanges(
    experiences.map(normalizeCompletionExperience),
    currentDate,
  );
}

export function countExperienceReferences(
  experiences: CompletionExperience[],
  references: CompletionReference[],
) {
  return countLinkedExperienceReferences(experiences, references);
}

export function isPremiumCrewProfile(completionPercent: number) {
  return completionPercent > premiumProfileCompletionThreshold;
}

function currentPosition(profile: CompletionProfile) {
  return text(profile.current_position) || stringArray(profile.current_positions)[0] || "";
}

function normalizeCompletionExperience(
  experience: CompletionExperience,
): CompletionExperience {
  const rawDescription = text(experience.description);
  if (!rawDescription.startsWith(experienceMetadataPrefix)) {
    return experience;
  }

  const lineBreak = rawDescription.indexOf("\n");
  const metadataText = rawDescription
    .slice(
      experienceMetadataPrefix.length,
      lineBreak === -1 ? undefined : lineBreak,
    )
    .trim();
  const description = lineBreak === -1 ? "" : rawDescription.slice(lineBreak + 1);

  try {
    const metadata = JSON.parse(metadataText) as Record<string, unknown>;
    return {
      ...experience,
      yacht_type: text(experience.yacht_type) || text(metadata.yacht_type),
      yacht_program:
        text(experience.yacht_program) || text(metadata.yacht_program),
      yacht_size: text(experience.yacht_size) || text(metadata.yacht_size),
      location: text(experience.location) || text(metadata.location),
      description,
    };
  } catch {
    return { ...experience, description };
  }
}

function experienceCompletionRatio(experience: CompletionExperience) {
  const isOtherWork = text(experience.yacht_type) === otherWorkExperienceMarker;
  const fields = [
    text(experience.yacht_name),
    text(experience.position),
    text(experience.start_date),
    text(experience.end_date),
    text(experience.location),
    isOtherWork ? "other-work" : text(experience.yacht_type),
    isOtherWork ? "other-work" : text(experience.yacht_program),
    isOtherWork ? "other-work" : text(experience.yacht_size),
  ];
  const fieldScore = filledRatio(fields) * 0.5;
  const dutiesScore = textCompletionRatio(experience.description, 160) * 0.5;
  return fieldScore + dutiesScore;
}

function filledRatio(values: unknown[]) {
  if (values.length === 0) return 0;
  const filled = values.filter((value) => {
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    return Boolean(text(value));
  }).length;
  return filled / values.length;
}

function textCompletionRatio(value: unknown, fullLength: number) {
  return Math.min(text(value).length / fullLength, 1);
}

function languageEntries(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const entry = item as Record<string, unknown>;
    return Boolean(text(entry.name) && text(entry.level));
  });
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
