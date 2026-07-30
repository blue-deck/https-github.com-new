import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
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

type CrewProfileRow = Record<string, unknown> & {
  id?: string;
  user_id?: string;
  public_crew_id?: string;
  notes?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const crewProfilePageSize = 500;
const authUserPageSize = 1_000;
const entitlementBatchSize = 100;
const directoryCacheSeconds = 300;
const crewProfileSelect =
  "id,user_id,public_crew_id,status,full_name,email,phone,profile_photo_url,current_position,current_positions,seeking_positions,location,nationality,gender,date_of_birth,height_cm,weight_kg,smoker,visible_tattoos,bio,languages,personal_skills,personal_characteristics,work_preferences,notes,created_at,updated_at";

const loadCachedCrewDirectory = unstable_cache(
  loadDiscoverableCrewList,
  ["find-crew-directory-v3"],
  {
    revalidate: directoryCacheSeconds,
    tags: ["find-crew-directory"],
  },
);

export async function listDiscoverableCrew(): Promise<
  DiscoverableCrewPreview[]
> {
  return loadCachedCrewDirectory();
}

async function loadDiscoverableCrewList(): Promise<
  DiscoverableCrewPreview[]
> {
  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("find_crew_service_unavailable");
  }

  const rows = await listActiveCrewProfileRows(serviceClient);
  const eligibleRows = await filterEligibleCrewProfiles(serviceClient, rows);
  const profileIds = eligibleRows.map((row) => text(row.id)).filter(isUuid);
  const experienceResult = await loadCandidateExperienceRows(
    serviceClient,
    profileIds,
  );

  if (experienceResult.error) {
    console.error(
      "Find Crew experience could not be loaded",
      safeErrorMessage(experienceResult.error),
    );
    throw new Error("find_crew_experience_unavailable");
  }

  const experiencesByProfile = groupExperiences(experienceResult.rows);
  const profiles = eligibleRows
    .map((row) =>
      toDiscoverableCrewPreview(
        row,
        experiencesByProfile.get(text(row.id)) || [],
      ),
    )
    .filter((profile): profile is DiscoverableCrewPreview => Boolean(profile));

  return mixCrewProfiles(uniqueCrewIdProfiles(profiles));
}

const loadCachedDiscoverableCrew = unstable_cache(
  loadDiscoverableCrewProfile,
  ["find-crew-profile-v3"],
  {
    revalidate: directoryCacheSeconds,
    tags: ["find-crew-directory"],
  },
);

const loadCachedDirectoryMediaProfile = unstable_cache(
  loadActiveDirectoryMediaProfile,
  ["find-crew-media-profile-v3"],
  {
    revalidate: directoryCacheSeconds,
    tags: ["find-crew-directory"],
  },
);

const loadCachedDirectoryGallerySources = unstable_cache(
  loadActiveDirectoryGallerySources,
  ["find-crew-media-gallery-v3"],
  {
    revalidate: directoryCacheSeconds,
    tags: ["find-crew-directory"],
  },
);

export const getDiscoverableCrew = cache(async function getDiscoverableCrew(
  crewId: string,
): Promise<DiscoverableCrewProfile | null> {
  return loadCachedDiscoverableCrew(crewId);
});

async function loadDiscoverableCrewProfile(
  crewId: string,
): Promise<DiscoverableCrewProfile | null> {
  const cleanCrewId = normalizePublicCrewId(crewId);
  if (!cleanCrewId) return null;

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("find_crew_service_unavailable");
  }

  const row = await loadActiveCrewProfile(serviceClient, cleanCrewId);
  if (!row) return null;

  const account = await loadEligibleCrewAccount(serviceClient, row);
  if (!account) return null;

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
  const discovery = parseCrewDiscoverySettings(text(row.notes));
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
  const portalAvailable = Boolean(
    publicCrewId && getPublicCrewDiscoverySettings(row.notes),
  );
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
  const cleanCrewId = normalizePublicCrewId(crewId);
  if (!cleanCrewId) return false;

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("find_crew_service_unavailable");
  }

  const row = await loadActiveCrewProfile(serviceClient, cleanCrewId);
  if (!row) return false;
  return Boolean(await loadEligibleCrewAccount(serviceClient, row));
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

  const mediaProfile = await loadCachedDirectoryMediaProfile(cleanCrewId);
  if (!mediaProfile) return "";
  if (kind === "avatar") return mediaProfile.avatarSource;

  const selected = await loadCachedDirectoryGallerySources(
    mediaProfile.profileId,
  );
  return slot === null ? "" : selected[slot] || "";
}

async function loadActiveDirectoryMediaProfile(crewId: string) {
  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("find_crew_service_unavailable");
  }

  const row = await loadActiveCrewProfile(serviceClient, crewId);
  if (!row || !(await loadEligibleCrewAccount(serviceClient, row))) return null;

  const profileId = text(row.id);
  if (!isUuid(profileId)) return null;
  return {
    profileId,
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

async function listActiveCrewProfileRows(serviceClient: SupabaseClient) {
  const rows: CrewProfileRow[] = [];

  for (let offset = 0; ; offset += crewProfilePageSize) {
    const { data, error } = await serviceClient
      .from("crew_profiles")
      .select(crewProfileSelect)
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(offset, offset + crewProfilePageSize - 1);

    if (error) {
      console.error("Find Crew profiles could not be loaded", error.message);
      throw new Error("find_crew_profiles_unavailable");
    }

    const page = (data || []) as CrewProfileRow[];
    rows.push(...page);
    if (page.length < crewProfilePageSize) return rows;
  }
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

async function filterEligibleCrewProfiles(
  serviceClient: SupabaseClient,
  rows: CrewProfileRow[],
) {
  const userIds = Array.from(
    new Set(rows.map((row) => text(row.user_id)).filter(isUuid)),
  );
  if (userIds.length === 0) return [];

  const entitledUserIds = await loadCrewWorkspaceUserIds(
    serviceClient,
    userIds,
  );
  const confirmedUserIds = await loadConfirmedActiveUserIds(
    serviceClient,
    Array.from(entitledUserIds),
  );

  return rows.filter((row) => confirmedUserIds.has(text(row.user_id)));
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

async function loadCrewWorkspaceUserIds(
  serviceClient: SupabaseClient,
  userIds: string[],
) {
  const eligibleUserIds = new Set<string>();

  for (
    let index = 0;
    index < userIds.length;
    index += entitlementBatchSize
  ) {
    const batch = userIds.slice(index, index + entitlementBatchSize);
    const { data, error } = await serviceClient
      .from("marketplace_entitlements")
      .select("user_id,account_role")
      .in("user_id", batch);

    if (error) {
      console.error("Find Crew roles could not be verified", error.message);
      throw new Error("find_crew_roles_unavailable");
    }

    for (const entitlement of data || []) {
      const userId = text(entitlement.user_id);
      if (userId && canUseCrewWorkspace(entitlement.account_role)) {
        eligibleUserIds.add(userId);
      }
    }
  }

  return eligibleUserIds;
}

async function loadConfirmedActiveUserIds(
  serviceClient: SupabaseClient,
  userIds: string[],
) {
  const targetUserIds = new Set(userIds);
  const eligibleUserIds = new Set<string>();
  if (targetUserIds.size === 0) return eligibleUserIds;

  for (let page = 1; ; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: authUserPageSize,
    });

    if (error) {
      console.error("Find Crew accounts could not be verified", error.message);
      throw new Error("find_crew_accounts_unavailable");
    }

    for (const user of data.users) {
      if (!targetUserIds.has(user.id)) continue;
      targetUserIds.delete(user.id);
      if (isConfirmedActiveUser(user)) eligibleUserIds.add(user.id);
    }

    if (
      targetUserIds.size === 0 ||
      data.users.length < authUserPageSize
    ) {
      return eligibleUserIds;
    }
  }
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
    experienceYears: crewExperienceYears(experiences),
    premiumProfile: isPremiumCrewProfile(completionPercent),
    memberSince: databaseTimestamp(row.created_at),
  };
}

function groupExperiences(rows: CandidateExperienceRow[]) {
  const experiencesByProfile = new Map<string, CandidateExperienceRow[]>();

  for (const experience of rows) {
    const profileId = text(experience.crew_profile_id);
    if (!isUuid(profileId)) continue;
    const current = experiencesByProfile.get(profileId) || [];
    current.push(experience);
    experiencesByProfile.set(profileId, current);
  }

  return experiencesByProfile;
}

function uniqueCrewIdProfiles(profiles: DiscoverableCrewPreview[]) {
  const counts = new Map<string, number>();
  for (const profile of profiles) {
    counts.set(profile.crewId, (counts.get(profile.crewId) || 0) + 1);
  }
  return profiles.filter((profile) => counts.get(profile.crewId) === 1);
}

function mixCrewProfiles(profiles: DiscoverableCrewPreview[]) {
  const dailySeed = new Date().toISOString().slice(0, 10);
  return [...profiles].sort((first, second) => {
    const firstRank = stableTextHash(`${dailySeed}:${first.crewId}`);
    const secondRank = stableTextHash(`${dailySeed}:${second.crewId}`);
    if (firstRank !== secondRank) return firstRank - secondRank;
    return first.crewId.localeCompare(second.crewId);
  });
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

function stableTextHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
