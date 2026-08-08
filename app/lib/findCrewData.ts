import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { cache } from "react";
import {
  loadCandidateExperienceRows,
  maskedPersonName,
  personInitials,
  publicCandidateLanguageEntries,
  redactCandidateProfileText,
  safeCandidateCount,
  safeCandidateMeasurement,
  type CandidateExperienceRow,
} from "./crewCandidateDataServer";
import {
  calculateCrewProfileCompletion,
  countExperienceReferences,
  crewExperienceYears,
  isPremiumCrewProfile,
} from "./crewProfileCompletion";
import {
  crewDiscoveryNotesPrefix,
  parseCrewDiscoverySettings,
  type CrewDiscoverySettings,
} from "./crewDiscovery";
import { canUseCrewWorkspace } from "./marketplaceCapabilities";
import {
  getPublicCrewDiscoverySettings,
  normalizePublicCrewId,
  publicStructuredProfileField,
  publicStructuredStringArray,
  safeOwnedPublicMediaUrl,
  selectOwnedPublicCrewGallerySources,
} from "./publicCrewSafety";
import { resolveSupabaseUrl } from "./supabaseConfig";

export type DiscoverableCrewPreview = {
  crewId: string;
  displayName: string;
  initials: string;
  profilePhotoUrl: string;
  currentPosition: string;
  seekingPositions: string[];
  location: string;
  nationality: string;
  availabilityStatus: string;
  preferredLocations: string[];
  employmentTypes: string[];
  personalSkills: string[];
  experienceYears: number;
  premiumProfile: boolean;
  memberSince: string;
};

export type DiscoverableCrewProfile = DiscoverableCrewPreview & {
  fullName: string;
  bio: string;
  gender: string;
  heightCm: number | null;
  weightKg: number | null;
  smoker: string;
  visibleTattoos: string;
  professionalSummary: string;
  skills: string[];
  personalCharacteristics: string[];
  characteristics: string[];
  workPreferences: string[];
  languages: Array<{ name: string; level: string }>;
  galleryPhotos: string[];
  referenceCount: number;
  documentCount: number;
  publicCrewId: string;
  portalAvailable: boolean;
  discovery: CrewDiscoverySettings;
};

export type DiscoverableCrewPage = {
  profiles: DiscoverableCrewPreview[];
  nextCursor: string | null;
  hasMore: boolean;
};

type CrewProfileRow = Record<string, unknown> & {
  id?: string;
  user_id?: string;
  public_crew_id?: string;
  notes?: string;
  _cursor_updated_at?: string;
  _cursor_id?: string;
  _experiences?: unknown;
  _experience_years?: unknown;
};

export type EligiblePublicCrewContext = {
  crewId: string;
  profile: CrewProfileRow;
  account: User;
  discovery: CrewDiscoverySettings;
  serviceClient: SupabaseClient;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicCrewPageSize = 48;
const crewProfileSelect =
  "id,user_id,public_crew_id,status,full_name,email,phone,profile_photo_url,current_position,current_positions,seeking_positions,location,nationality,gender,date_of_birth,height_cm,weight_kg,smoker,visible_tattoos,bio,languages,personal_skills,personal_characteristics,work_preferences,notes,created_at,updated_at";

export async function listDiscoverableCrew(): Promise<
  DiscoverableCrewPreview[]
> {
  return (await listDiscoverableCrewPage()).profiles;
}

export async function listDiscoverableCrewPage(
  cursor = "",
): Promise<DiscoverableCrewPage> {
  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("find_crew_service_unavailable");
  }

  const decodedCursor = cursor ? decodePublicCrewCursor(cursor) : null;
  if (cursor && !decodedCursor) {
    throw new Error("find_crew_cursor_invalid");
  }

  const { data, error } = await serviceClient.rpc(
    "bluedeck_public_crew_page",
    {
      p_before_updated_at: decodedCursor?.updatedAt || null,
      p_before_id: decodedCursor?.id || null,
      p_limit: publicCrewPageSize,
    },
  );
  if (error) {
    console.error(
      "Find Crew directory page could not be loaded",
      safeErrorMessage(error),
    );
    throw new Error("find_crew_profiles_unavailable");
  }

  if (!isRecord(data) || !Array.isArray(data.rows) || typeof data.has_more !== "boolean") {
    throw new Error("find_crew_profiles_invalid");
  }
  const rows = data.rows as CrewProfileRow[];
  if (
    rows.length > publicCrewPageSize ||
    (data.has_more && rows.length !== publicCrewPageSize)
  ) {
    throw new Error("find_crew_profiles_invalid");
  }

  const profiles = rows
    .map((row) =>
      toDiscoverableCrewPreview(
        row,
        Array.isArray(row._experiences)
          ? (row._experiences as CandidateExperienceRow[])
          : [],
      ),
    )
    .filter((profile): profile is DiscoverableCrewPreview => Boolean(profile));
  const uniqueProfiles = uniqueCrewIdProfiles(profiles);
  const nextCursor = data.has_more
    ? encodePublicCrewCursor(rows.at(-1))
    : null;
  if (
    profiles.length !== rows.length ||
    uniqueProfiles.length !== profiles.length ||
    (data.has_more && !nextCursor)
  ) {
    throw new Error("find_crew_profiles_invalid");
  }

  return {
    profiles: uniqueProfiles,
    nextCursor,
    hasMore: data.has_more,
  };
}

export const getDiscoverableCrew = cache(async function getDiscoverableCrew(
  crewId: string,
): Promise<DiscoverableCrewProfile | null> {
  return loadDiscoverableCrewProfile(crewId);
});

async function loadDiscoverableCrewProfile(
  crewId: string,
): Promise<DiscoverableCrewProfile | null> {
  const context = await loadEligiblePublicCrewContext(crewId);
  if (!context) return null;
  const {
    account,
    discovery,
    profile: row,
    serviceClient,
  } = context;

  const profileId = text(row.id);
  if (!isUuid(profileId)) return null;

  const [photoResult, documentResult, referenceResult, experienceResult] =
    await Promise.all([
      serviceClient
        .from("crew_portfolio_photos")
        .select("id,image_url,created_at")
        .eq("crew_profile_id", profileId)
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(100),
      serviceClient
        .from("crew_documents")
        .select("id", { count: "exact", head: true })
        .eq("crew_profile_id", profileId),
      serviceClient
        .from("crew_references")
        .select("id,vessel")
        .eq("crew_profile_id", profileId),
      loadCandidateExperienceRows(serviceClient, [profileId]),
    ]);

  const relatedError =
    photoResult.error ||
    documentResult.error ||
    referenceResult.error ||
    experienceResult.error;
  if (relatedError) {
    console.error(
      "Find Crew profile details could not be loaded",
      safeErrorMessage(relatedError),
    );
    throw new Error("find_crew_profile_details_unavailable");
  }

  const experiences = experienceResult.rows;
  const preview = toDiscoverableCrewPreview(row, experiences);
  if (!preview) return null;

  const profileIdentity = text(row.full_name).slice(0, 120);
  const rawGender =
    identitySafeProfileField(row.gender, profileIdentity, 60) ||
    identitySafeProfileField(
      account.user_metadata?.gender,
      profileIdentity,
      60,
    );
  const safeDiscovery = {
    ...discovery,
    availabilityStatus: identitySafeProfileField(
      discovery.availabilityStatus,
      profileIdentity,
      120,
    ),
    employmentTypes: identitySafeStringArray(
      discovery.employmentTypes,
      profileIdentity,
      30,
      120,
    ),
    preferredLocations: identitySafeStringArray(
      discovery.preferredLocations,
      profileIdentity,
      30,
      120,
    ),
  };
  const publicCrewId = normalizePublicCrewId(text(row.public_crew_id));
  const portalAvailable = Boolean(publicCrewId);
  const professionalSummary = redactCandidateProfileText(
    row.bio,
    profileIdentity || preview.displayName,
    2_000,
  );
  const gallerySources = selectOwnedPublicCrewGallerySources(
    photoResult.data || [],
    profileId,
    [profileId, row.user_id],
  );

  return {
    ...preview,
    fullName: preview.displayName,
    bio: professionalSummary,
    gender: rawGender,
    heightCm: safeCandidateMeasurement(row.height_cm, 80, 260),
    weightKg: safeCandidateMeasurement(row.weight_kg, 20, 400),
    smoker: identitySafeProfileField(row.smoker, profileIdentity, 60),
    visibleTattoos: identitySafeProfileField(
      row.visible_tattoos,
      profileIdentity,
      120,
    ),
    professionalSummary,
    skills: identitySafeStringArray(
      row.personal_skills,
      profileIdentity,
      30,
      120,
    ),
    personalCharacteristics: identitySafeStringArray(
      row.personal_characteristics,
      profileIdentity,
      30,
      120,
    ),
    characteristics: identitySafeStringArray(
      row.personal_characteristics,
      profileIdentity,
      30,
      120,
    ),
    workPreferences: identitySafeStringArray(
      row.work_preferences,
      profileIdentity,
      30,
      120,
    ),
    seekingPositions: identitySafeStringArray(
      row.seeking_positions,
      profileIdentity,
      30,
      120,
    ),
    employmentTypes: safeDiscovery.employmentTypes,
    preferredLocations: safeDiscovery.preferredLocations,
    languages: publicCandidateLanguageEntries(row.languages).map((item) => ({
      name: identitySafeProfileField(item.name, profileIdentity, 80),
      level: identitySafeProfileField(item.level, profileIdentity, 80),
    })),
    galleryPhotos: gallerySources.map((_source, slot) =>
      publicCrewMediaUrl(preview.crewId, "gallery", slot),
    ),
    referenceCount: countExperienceReferences(
      experiences,
      referenceResult.data || [],
    ),
    documentCount: safeCandidateCount(documentResult.count),
    publicCrewId: portalAvailable ? publicCrewId : "",
    portalAvailable,
    discovery: safeDiscovery,
  };
}

export async function isActiveDirectoryCrew(crewId: string) {
  return Boolean(await loadEligiblePublicCrewContext(crewId));
}

/**
 * Single public-crew privacy boundary used by the directory, CV, gallery,
 * metadata and media routes. Every call verifies the current profile state,
 * workspace entitlement and live Auth account. Crew and Captain directory
 * eligibility is automatic; discovery settings only provide optional public
 * availability and work-preference values.
 */
export async function loadEligiblePublicCrewContext(
  crewId: string,
): Promise<EligiblePublicCrewContext | null> {
  const cleanCrewId = normalizePublicCrewId(crewId);
  if (!cleanCrewId) return null;

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("find_crew_service_unavailable");
  }

  const profile = await loadActiveCrewProfile(serviceClient, cleanCrewId);
  if (!profile) return null;

  const discovery = getPublicCrewDiscoverySettings(profile.notes);

  const account = await loadEligibleCrewAccount(serviceClient, profile);
  if (!account) return null;

  return {
    crewId: cleanCrewId,
    profile,
    account,
    discovery,
    serviceClient,
  };
}

export async function loadActiveDirectoryCrewMediaSource(
  crewId: string,
  kind: "avatar" | "gallery",
  slot: number | null,
) {
  const cleanCrewId = normalizePublicCrewId(crewId);
  if (
    !cleanCrewId ||
    (kind === "avatar" && slot !== null) ||
    (kind === "gallery" &&
      (slot === null ||
        !Number.isSafeInteger(slot) ||
        slot < 0 ||
        slot > 3))
  ) {
    return "";
  }

  const mediaProfile = await loadActiveDirectoryMediaProfile(cleanCrewId);
  if (!mediaProfile) return "";
  if (kind === "avatar") return mediaProfile.avatarSource;

  const selected = await loadActiveDirectoryGallerySources(
    mediaProfile.profileId,
  );
  return slot === null ? "" : selected[slot] || "";
}

export async function loadActiveDirectoryCrewRecordMediaSource(
  crewId: string,
  kind: "experience" | "portfolio",
  mediaId: string,
) {
  const cleanCrewId = normalizePublicCrewId(crewId);
  if (!cleanCrewId || !isUuid(mediaId)) return "";

  const mediaProfile = await loadActiveDirectoryMediaProfile(cleanCrewId);
  if (!mediaProfile) return "";

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("find_crew_service_unavailable");
  }

  const table = kind === "experience" ? "crew_experiences" : "crew_portfolio_photos";
  const column = kind === "experience" ? "photo_url" : "image_url";
  const { data, error } = await serviceClient
    .from(table)
    .select(column)
    .eq("id", mediaId)
    .eq("crew_profile_id", mediaProfile.profileId)
    .maybeSingle();
  if (error || !data) return "";

  return safeOwnedPublicMediaUrl(
    (data as unknown as Record<string, unknown>)[column],
    [
    mediaProfile.profileId,
    mediaProfile.userId,
    ],
  );
}

async function loadActiveDirectoryMediaProfile(crewId: string) {
  const context = await loadEligiblePublicCrewContext(crewId);
  if (!context) return null;
  const row = context.profile;

  const profileId = text(row.id);
  if (!isUuid(profileId)) return null;
  return {
    profileId,
    userId: text(row.user_id),
    avatarSource: safeOwnedPublicMediaUrl(row.profile_photo_url, [
      profileId,
      row.user_id,
    ]),
  };
}

async function loadActiveDirectoryGallerySources(profileId: string) {
  if (!isUuid(profileId)) return [];
  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("find_crew_service_unavailable");
  }

  const { data, error } = await serviceClient
    .from("crew_portfolio_photos")
    .select("id,image_url,created_at")
    .eq("crew_profile_id", profileId)
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Find Crew media could not be loaded", error.message);
    throw new Error("find_crew_media_unavailable");
  }

  return selectOwnedPublicCrewGallerySources(data || [], profileId, [
    profileId,
  ]);
}

function createServiceClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  return createClient(resolveSupabaseUrl(supabaseUrl), supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function loadActiveCrewProfile(
  serviceClient: SupabaseClient,
  crewId: string,
) {
  const { data, error } = await serviceClient
    .from("crew_profiles")
    .select(crewProfileSelect)
    .eq("status", "active")
    .eq("public_crew_id", crewId)
    .limit(2);

  if (error) {
    console.error(
      "Find Crew profile could not be loaded",
      error.message,
    );
    throw new Error("find_crew_profile_unavailable");
  }

  const matches = (data || []) as CrewProfileRow[];
  return matches.length === 1 ? matches[0] : null;
}

async function loadEligibleCrewAccount(
  serviceClient: SupabaseClient,
  row: CrewProfileRow,
) {
  const userId = text(row.user_id);
  if (!isUuid(userId)) return null;

  const { data: entitlement, error: entitlementError } = await serviceClient
    .from("marketplace_entitlements")
    .select("account_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (entitlementError) {
    console.error(
      "Find Crew role could not be verified",
      entitlementError.message,
    );
    throw new Error("find_crew_roles_unavailable");
  }
  if (!canUseCrewWorkspace(entitlement?.account_role)) return null;

  const { data, error } = await serviceClient.auth.admin.getUserById(userId);
  if (error) {
    console.error("Find Crew account could not be verified", error.message);
    throw new Error("find_crew_accounts_unavailable");
  }

  return isConfirmedActiveUser(data.user) ? data.user : null;
}

function toDiscoverableCrewPreview(
  row: CrewProfileRow,
  experiences: CandidateExperienceRow[],
): DiscoverableCrewPreview | null {
  const crewId = normalizePublicCrewId(text(row.public_crew_id));
  if (!crewId) return null;

  const profileIdentity = text(row.full_name).slice(0, 120);
  const rawName =
    publicStructuredProfileField(row.full_name, 120) || "BlueDeck candidate";
  const currentPosition =
    identitySafeStringArray(
      row.current_positions,
      profileIdentity,
      1,
      120,
    )[0] ||
    identitySafeProfileField(
      row.current_position,
      profileIdentity,
      120,
    ) ||
    "Yacht crew";
  const notes = text(row.notes);
  const hasSavedDiscoverySettings = notes.startsWith(
    crewDiscoveryNotesPrefix,
  );
  const discovery = parseCrewDiscoverySettings(notes);
  const completionPercent = calculateCrewProfileCompletion({
    profile: row,
    experiences,
  });

  return {
    crewId,
    displayName: maskedPersonName(rawName),
    initials: personInitials(rawName),
    profilePhotoUrl: safeOwnedPublicMediaUrl(row.profile_photo_url, [
      row.id,
      row.user_id,
    ])
      ? publicCrewMediaUrl(crewId, "avatar")
      : "",
    currentPosition,
    seekingPositions: identitySafeStringArray(
      row.seeking_positions,
      profileIdentity,
      30,
      120,
    ),
    location: identitySafeProfileField(row.location, profileIdentity, 120),
    nationality: identitySafeProfileField(
      row.nationality,
      profileIdentity,
      80,
    ),
    availabilityStatus: hasSavedDiscoverySettings
      ? identitySafeProfileField(
          discovery.availabilityStatus,
          profileIdentity,
          120,
        )
      : "",
    preferredLocations: identitySafeStringArray(
      discovery.preferredLocations,
      profileIdentity,
      30,
      120,
    ),
    employmentTypes: identitySafeStringArray(
      discovery.employmentTypes,
      profileIdentity,
      30,
      120,
    ),
    personalSkills: identitySafeStringArray(
      row.personal_skills,
      profileIdentity,
      30,
      120,
    ),
    experienceYears:
      typeof row._experience_years === "number" &&
      Number.isSafeInteger(row._experience_years) &&
      row._experience_years > 0
        ? row._experience_years
        : crewExperienceYears(experiences),
    premiumProfile: isPremiumCrewProfile(completionPercent),
    memberSince: databaseTimestamp(row.created_at),
  };
}

function uniqueCrewIdProfiles(profiles: DiscoverableCrewPreview[]) {
  const counts = new Map<string, number>();
  for (const profile of profiles) {
    counts.set(profile.crewId, (counts.get(profile.crewId) || 0) + 1);
  }
  return profiles.filter((profile) => counts.get(profile.crewId) === 1);
}

function publicCrewMediaUrl(
  crewId: string,
  kind: "avatar" | "gallery",
  slot?: number,
) {
  const search = new URLSearchParams({ kind });
  if (kind === "gallery" && slot !== undefined) {
    search.set("slot", String(slot));
  }
  return `/api/find-crew/${encodeURIComponent(crewId)}/media?${search.toString()}`;
}

function isConfirmedActiveUser(value: {
  email_confirmed_at?: string | null;
  deleted_at?: string | null;
  banned_until?: string | null;
} | null) {
  if (!value?.email_confirmed_at || value.deleted_at) return false;
  if (!value.banned_until) return true;
  const bannedUntil = Date.parse(value.banned_until);
  return Number.isFinite(bannedUntil) && bannedUntil <= Date.now();
}

function databaseTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function identitySafeProfileField(
  value: unknown,
  identity: string,
  maxLength: number,
) {
  const structured = publicStructuredProfileField(value, maxLength);
  return structured
    ? redactCandidateProfileText(structured, identity, maxLength)
    : "";
}

function identitySafeStringArray(
  value: unknown,
  identity: string,
  limit: number,
  maxItemLength: number,
) {
  return Array.from(
    new Set(
      publicStructuredStringArray(value, limit, maxItemLength)
        .map((item) =>
          redactCandidateProfileText(item, identity, maxItemLength),
        )
        .filter(Boolean),
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 240);
  if (error && typeof error === "object" && "message" in error) {
    return text((error as { message?: unknown }).message).slice(0, 240);
  }
  return "Unknown database error";
}

function encodePublicCrewCursor(value: unknown) {
  if (!isRecord(value)) return null;
  const updatedAt = databaseTimestamp(value._cursor_updated_at);
  const id = text(value._cursor_id).toLowerCase();
  if (!updatedAt || !isUuid(id)) return null;
  try {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      publicCrewCursorKey(),
      initializationVector,
    );
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify([updatedAt, id]), "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      initializationVector.toString("base64url"),
      encrypted.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
    ].join(".");
  } catch {
    return null;
  }
}

function decodePublicCrewCursor(value: string) {
  if (!/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{1,192}\.[A-Za-z0-9_-]{22}$/.test(value)) {
    return null;
  }
  try {
    const [, encodedInitializationVector, encodedCiphertext, encodedTag] =
      value.split(".");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      publicCrewCursorKey(),
      Buffer.from(encodedInitializationVector, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    const decoded = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encodedCiphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    ) as unknown;
    if (!Array.isArray(decoded) || decoded.length !== 2) return null;
    const updatedAt = databaseTimestamp(decoded[0]);
    const id = text(decoded[1]).toLowerCase();
    return updatedAt && isUuid(id) ? { updatedAt, id } : null;
  } catch {
    return null;
  }
}

function publicCrewCursorKey() {
  if (!supabaseServiceRoleKey) {
    throw new Error("find_crew_service_unavailable");
  }
  return createHash("sha256")
    .update("bluedeck-find-crew-cursor\0", "utf8")
    .update(supabaseServiceRoleKey, "utf8")
    .digest();
}
