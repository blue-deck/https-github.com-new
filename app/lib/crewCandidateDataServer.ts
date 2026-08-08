import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompletionExperience } from "./crewProfileCompletion";
import {
  cleanText,
  isRecord,
  isUuid,
} from "./employerAccessServer";
import {
  publicStructuredProfileField,
  redactPublicContactDetails,
} from "./publicCrewSafety";

export type CandidateExperienceRow = CompletionExperience & {
  id?: unknown;
  crew_profile_id?: unknown;
  created_at?: unknown;
};

const experienceProfileBatchSize = 100;
const experiencePageSize = 500;
const richExperienceSelect =
  "id,crew_profile_id,yacht_name,yacht_type,yacht_program,yacht_size,location,position,start_date,end_date,description,created_at";
const fallbackExperienceSelect =
  "id,crew_profile_id,yacht_name,position,start_date,end_date,description,created_at";

export async function loadCandidateExperienceRows(
  serviceClient: SupabaseClient,
  profileIds: string[],
): Promise<{ rows: CandidateExperienceRow[]; error: unknown | null }> {
  const uniqueProfileIds = Array.from(new Set(profileIds.filter(isUuid)));
  const rows: CandidateExperienceRow[] = [];

  for (
    let profileIndex = 0;
    profileIndex < uniqueProfileIds.length;
    profileIndex += experienceProfileBatchSize
  ) {
    const profileBatch = uniqueProfileIds.slice(
      profileIndex,
      profileIndex + experienceProfileBatchSize,
    );
    let useFallbackSelect = false;

    for (let offset = 0; ; offset += experiencePageSize) {
      let response = await candidateExperiencePage(
        serviceClient,
        profileBatch,
        offset,
        useFallbackSelect,
      );

      if (
        response.error &&
        !useFallbackSelect &&
        isLegacyExperienceSchemaError(response.error)
      ) {
        useFallbackSelect = true;
        response = await candidateExperiencePage(
          serviceClient,
          profileBatch,
          offset,
          true,
        );
      }

      if (response.error) return { rows: [], error: response.error };

      const page = (response.data || []) as CandidateExperienceRow[];
      rows.push(...page);
      if (page.length < experiencePageSize) break;
    }
  }

  return { rows, error: null };
}

export function maskedPersonName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const visibleParts = parts.length > 1 ? [parts[0], parts.at(-1) || ""] : parts;
  const masked = visibleParts
    .map((part) => `${Array.from(part)[0]?.toLocaleUpperCase() || "B"}••••`)
    .join(" ");
  return masked || "B•••• C••••";
}

export function personInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const visibleParts = parts.length > 1 ? [parts[0], parts.at(-1) || ""] : parts;
  return (
    visibleParts
      .map((part) => Array.from(part)[0]?.toLocaleUpperCase() || "")
      .join("") || "BD"
  );
}

export function safeCandidateMeasurement(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    return null;
  }
  return Math.round(value);
}

export function safeCandidateCount(value: number | null) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 0;
}

export function publicCandidateLanguageEntries(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = publicStructuredProfileField(item.name, 80);
      const level = publicStructuredProfileField(item.level, 80);
      return name ? { name, level: level || "Intermediate" } : null;
    })
    .filter((item): item is { name: string; level: string } => Boolean(item));
}

export function redactCandidateProfileText(
  value: unknown,
  identity: string,
  maxLength = 2_000,
) {
  let redacted = redactPublicContactDetails(value, maxLength);
  const identityParts = identity.trim().split(/\s+/).filter(Boolean);
  if (!redacted || identityParts.length === 0) return redacted;

  const identityCandidates = Array.from(
    new Set([
      ...(identityParts.length > 1
        ? [
            identityParts.join(" "),
            `${identityParts[0]} ${identityParts.at(-1) || ""}`.trim(),
          ]
        : []),
      ...identityParts.filter((part) => Array.from(part).length >= 3),
    ]),
  ).sort((first, second) => second.length - first.length);

  for (const candidate of identityCandidates) {
    const flexibleIdentity = candidate
      .split(/\s+/)
      .map(escapeRegularExpression)
      .join("\\s+");
    const identityPattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${flexibleIdentity}(?=$|[^\\p{L}\\p{N}])`,
      "giu",
    );
    redacted = redacted.replace(
      identityPattern,
      (_match, prefix: string) => `${prefix}Identity withheld`,
    );
  }

  return redacted.slice(0, Math.max(0, Math.min(maxLength, 10_000))).trim();
}

function candidateExperiencePage(
  serviceClient: SupabaseClient,
  profileIds: string[],
  offset: number,
  fallback: boolean,
) {
  return serviceClient
    .from("crew_experiences")
    .select(fallback ? fallbackExperienceSelect : richExperienceSelect)
    .in("crew_profile_id", profileIds)
    .order("created_at", { ascending: false })
    .range(offset, offset + experiencePageSize - 1);
}

function isLegacyExperienceSchemaError(error: unknown) {
  if (!isRecord(error)) return false;
  const message = cleanText(error.message).toLowerCase();
  return (
    message.includes("schema cache") ||
    (message.includes("column") &&
      /yacht_type|yacht_program|yacht_size|location/.test(message))
  );
}

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
