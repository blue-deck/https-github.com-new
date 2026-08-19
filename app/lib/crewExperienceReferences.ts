export type CrewExperienceReferenceTarget = {
  id?: unknown;
};

export type CrewExperienceReference = {
  crew_experience_id?: unknown;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function referenceMatchesExperience(
  reference: CrewExperienceReference,
  experience: CrewExperienceReferenceTarget,
) {
  const experienceId = normalizedExperienceId(experience.id);
  return (
    experienceId.length > 0 &&
    normalizedExperienceId(reference.crew_experience_id) === experienceId
  );
}

export function referencesForExperience<
  Reference extends CrewExperienceReference,
>(
  experience: CrewExperienceReferenceTarget,
  references: readonly Reference[],
) {
  return references.filter((reference) =>
    referenceMatchesExperience(reference, experience),
  );
}

export function countExperienceReferences(
  experiences: readonly CrewExperienceReferenceTarget[],
  references: readonly CrewExperienceReference[],
) {
  const experienceIds = linkedExperienceIds(experiences);

  if (experienceIds.size === 0) return 0;

  return references.filter((reference) =>
    experienceIds.has(
      normalizedExperienceId(reference.crew_experience_id),
    ),
  ).length;
}

export function unlinkedExperienceReferences<
  Reference extends CrewExperienceReference,
>(
  experiences: readonly CrewExperienceReferenceTarget[],
  references: readonly Reference[],
) {
  const experienceIds = linkedExperienceIds(experiences);
  return references.filter(
    (reference) =>
      !experienceIds.has(
        normalizedExperienceId(reference.crew_experience_id),
      ),
  );
}

function linkedExperienceIds(
  experiences: readonly CrewExperienceReferenceTarget[],
) {
  return new Set(
    experiences
      .map((experience) => normalizedExperienceId(experience.id))
      .filter(Boolean),
  );
}

function normalizedExperienceId(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return uuidPattern.test(normalized) ? normalized : "";
}
