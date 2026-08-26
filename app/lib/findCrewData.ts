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
  crewExperienceBreakdown,
  crewExperienceYears,
  isPremiumCrewProfile,
} from "./crewProfileCompletion";
import {
  isCrewVisibleInDirectory,
  parseCrewDiscoverySettings,
  type CrewDiscoverySettings,
} from "./crewDiscovery";
import {
  crewExperienceMatchesFilters,
  crewSearchFingerprintInput,
  defaultCrewSearchFilters,
  normalizeCrewSearchFilters,
  type CrewSearchFacets,
  type CrewSearchFilters,
} from "./crewSearch";
import { nationalityValueMatchesCountry } from "./countries";
import { canUseCrewWorkspace } from "./marketplaceCapabilities";
import {
  getPublicCrewDiscoverySettings,
  normalizePublicCrewId,
  publicCrewMediaUrl,
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
  yachtExperienceYears: number;
  otherExperienceYears: number;
  premiumProfile: boolean;
  memberSince: string;
};

export type DiscoverableCrewProfile = DiscoverableCrewPreview & {
  hasTeamCouple: boolean;
  fullName: string;
  bio: string;
  gender: string;
  maritalStatus: string;
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
  total: number;
  facets: CrewSearchFacets;
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

type CrewSearchRecord = {
  profileId: string;
  userId: string;
  preview: DiscoverableCrewPreview;
  characteristics: string[];
  workPreferences: string[];
  languages: Array<{ name: string; level: string }>;
  maritalStatus: string;
  gender: string;
  smoker: string;
  visibleTattoos: string;
  referenceCount: number;
  documentCount: number;
  galleryCount: number;
  hasTeamCouple: boolean;
  searchText: string;
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
const publicCrewPageSize = 24;
const publicCrewScanPageSize = 48;
const maximumPublicCrewScanRows = 2_400;
const relatedProfileBatchSize = 100;
const relatedPageSize = 500;
const teamCoupleUserBatchSize = 50;
const maximumTeamCoupleRelationshipsPerBatch = 1_000;
const teamCoupleQueryConcurrency = 4;
const crewSearchCacheLifetimeMs = 15_000;
let crewSearchRecordsCache: {
  expiresAt: number;
  promise: Promise<CrewSearchRecord[]>;
} | null = null;
const crewProfileSelect =
  "id,user_id,public_crew_id,status,full_name,email,phone,profile_photo_url,current_position,current_positions,seeking_positions,location,nationality,gender,marital_status,date_of_birth,height_cm,weight_kg,smoker,visible_tattoos,bio,languages,personal_skills,personal_characteristics,work_preferences,notes,created_at,updated_at";

export async function listDiscoverableCrew(): Promise<
  DiscoverableCrewPreview[]
> {
  return (await listDiscoverableCrewPage()).profiles;
}

export async function listDiscoverableCrewPage(
  cursor = "",
  requestedFilters: CrewSearchFilters = defaultCrewSearchFilters,
): Promise<DiscoverableCrewPage> {
  const filters = normalizeCrewSearchFilters(requestedFilters);
  const filterFingerprint = crewSearchFingerprint(filters);
  const decodedCursor = cursor
    ? decodePublicCrewCursor(cursor, filterFingerprint)
    : null;
  if (cursor && !decodedCursor) {
    throw new Error("find_crew_cursor_invalid");
  }

  const safeRecords = await cachedCrewSearchRecords();

  const filtered = safeRecords
    .filter((record) => crewSearchRecordMatches(record, filters))
    .sort(compareCrewSearchRecords);
  const remaining = decodedCursor
    ? filtered.filter((record) => isRecordAfterCrewCursor(record, decodedCursor))
    : filtered;
  const selected = remaining.slice(0, publicCrewPageSize);
  const hasMore = remaining.length > publicCrewPageSize;
  const nextCursor = hasMore
    ? encodePublicCrewCursor(selected.at(-1), filterFingerprint)
    : null;
  if (hasMore && !nextCursor) {
    throw new Error("find_crew_profiles_invalid");
  }

  return {
    profiles: selected.map((record) => record.preview),
    nextCursor,
    hasMore,
    total: filtered.length,
    facets: crewSearchFacets(safeRecords),
  };
}

async function cachedCrewSearchRecords() {
  const now = Date.now();
  if (crewSearchRecordsCache && crewSearchRecordsCache.expiresAt > now) {
    return crewSearchRecordsCache.promise;
  }

  const promise = loadCrewSearchRecords();
  const cacheEntry = {
    expiresAt: now + crewSearchCacheLifetimeMs,
    promise,
  };
  crewSearchRecordsCache = cacheEntry;
  try {
    return await promise;
  } catch (error) {
    if (crewSearchRecordsCache === cacheEntry) crewSearchRecordsCache = null;
    throw error;
  }
}

async function loadCrewSearchRecords() {
  const serviceClient = createServiceClient();
  if (!serviceClient) {
    throw new Error("find_crew_service_unavailable");
  }
  const rows = await loadAllDiscoverableCrewRows(serviceClient);
  const related = await loadCrewSearchRelatedData(serviceClient, rows);
  const records = rows.map((row) => toCrewSearchRecord(row, related));
  if (records.some((record) => !record)) {
    throw new Error("find_crew_profiles_invalid");
  }
  const safeRecords = records as CrewSearchRecord[];
  const uniqueCrewIds = new Set(
    safeRecords.map((record) => record.preview.crewId),
  );
  if (uniqueCrewIds.size !== safeRecords.length) {
    throw new Error("find_crew_profiles_invalid");
  }
  return safeRecords;
}

type CrewSearchRelatedData = {
  experiencesByProfile: Map<string, CandidateExperienceRow[]>;
  referencesByProfile: Map<string, Array<{ crew_experience_id?: unknown }>>;
  documentCounts: Map<string, number>;
  photosByProfile: Map<string, Record<string, unknown>[]>;
  maritalStatuses: Map<string, string>;
  teamCoupleUserIds: Set<string>;
};

async function loadAllDiscoverableCrewRows(serviceClient: SupabaseClient) {
  const rows: CrewProfileRow[] = [];
  const seenCursors = new Set<string>();
  let scannedRowCount = 0;
  let beforeUpdatedAt: string | null = null;
  let beforeId: string | null = null;

  for (;;) {
    const { data, error } = await serviceClient.rpc(
      "bluedeck_public_crew_page",
      {
        p_before_updated_at: beforeUpdatedAt,
        p_before_id: beforeId,
        p_limit: publicCrewScanPageSize,
      },
    );
    if (error) {
      console.error(
        "Find Crew directory page could not be loaded",
        safeErrorMessage(error),
      );
      throw new Error("find_crew_profiles_unavailable");
    }
    if (
      !isRecord(data) ||
      !Array.isArray(data.rows) ||
      typeof data.has_more !== "boolean"
    ) {
      throw new Error("find_crew_profiles_invalid");
    }

    const pageRows = data.rows as CrewProfileRow[];
    if (
      pageRows.length > publicCrewScanPageSize ||
      (data.has_more && pageRows.length !== publicCrewScanPageSize) ||
      scannedRowCount + pageRows.length > maximumPublicCrewScanRows
    ) {
      throw new Error(
        scannedRowCount + pageRows.length > maximumPublicCrewScanRows
          ? "find_crew_directory_capacity_exceeded"
          : "find_crew_profiles_invalid",
      );
    }
    scannedRowCount += pageRows.length;
    rows.push(
      ...pageRows.filter((row) =>
        isCrewVisibleInDirectory(parseCrewDiscoverySettings(text(row.notes))),
      ),
    );
    if (!data.has_more) return rows;

    const last = pageRows.at(-1);
    const nextUpdatedAt = last
      ? databaseTimestamp(last._cursor_updated_at)
      : "";
    const nextId = last ? text(last._cursor_id).toLowerCase() : "";
    const cursorKey = `${nextUpdatedAt}:${nextId}`;
    if (
      !nextUpdatedAt ||
      !isUuid(nextId) ||
      seenCursors.has(cursorKey)
    ) {
      throw new Error("find_crew_profiles_invalid");
    }
    seenCursors.add(cursorKey);
    beforeUpdatedAt = nextUpdatedAt;
    beforeId = nextId;
  }
}

async function loadCrewSearchRelatedData(
  serviceClient: SupabaseClient,
  rows: CrewProfileRow[],
): Promise<CrewSearchRelatedData> {
  const profileIds = rows.map((row) => text(row.id)).filter(isUuid);
  const userIds = rows.map((row) => text(row.user_id)).filter(isUuid);
  if (profileIds.length !== rows.length || userIds.length !== rows.length) {
    throw new Error("find_crew_profiles_invalid");
  }

  const [
    experienceResult,
    documentRows,
    referenceRows,
    photoRows,
    maritalStatuses,
    teamCoupleUserIds,
  ] =
    await Promise.all([
      loadCandidateExperienceRows(serviceClient, profileIds),
      loadCrewRelatedRows(
        serviceClient,
        "crew_documents",
        "id,crew_profile_id,created_at",
        profileIds,
        true,
      ),
      loadCrewRelatedRows(
        serviceClient,
        "crew_references",
        "id,crew_profile_id,crew_experience_id,created_at",
        profileIds,
        true,
      ),
      loadCrewRelatedRows(
        serviceClient,
        "crew_portfolio_photos",
        "id,crew_profile_id,image_url,created_at",
        profileIds,
        false,
      ),
      loadCrewMaritalStatuses(serviceClient, profileIds),
      loadAcceptedTeamCoupleUserIds(serviceClient, userIds),
    ]);
  if (experienceResult.error) {
    console.error(
      "Find Crew experience filters could not be loaded",
      safeErrorMessage(experienceResult.error),
    );
    throw new Error("find_crew_profiles_unavailable");
  }

  const experiencesByProfile = groupRelatedRows<CandidateExperienceRow>(
    experienceResult.rows,
  );
  const referencesByProfile = groupRelatedRows<ArrayElement<typeof referenceRows>>(
    referenceRows,
  );
  const photosByProfile = groupRelatedRows<ArrayElement<typeof photoRows>>(
    photoRows,
  );
  const documentCounts = new Map<string, number>();
  for (const row of documentRows) {
    const profileId = text(row.crew_profile_id);
    if (isUuid(profileId)) {
      documentCounts.set(profileId, (documentCounts.get(profileId) || 0) + 1);
    }
  }

  return {
    experiencesByProfile,
    referencesByProfile,
    documentCounts,
    photosByProfile,
    maritalStatuses,
    teamCoupleUserIds,
  };
}

async function loadAcceptedTeamCoupleUserIds(
  serviceClient: SupabaseClient,
  userIds: string[],
) {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.some((userId) => !isUuid(userId))) {
    throw new Error("find_crew_profiles_invalid");
  }

  const batches: string[][] = [];
  for (
    let userIndex = 0;
    userIndex < uniqueUserIds.length;
    userIndex += teamCoupleUserBatchSize
  ) {
    batches.push(
      uniqueUserIds.slice(userIndex, userIndex + teamCoupleUserBatchSize),
    );
  }

  const acceptedUserIds = new Set<string>();
  for (
    let batchIndex = 0;
    batchIndex < batches.length;
    batchIndex += teamCoupleQueryConcurrency
  ) {
    const results = await Promise.all(
      batches
        .slice(batchIndex, batchIndex + teamCoupleQueryConcurrency)
        .map((batch) => {
          const userList = batch.join(",");
          return serviceClient
            .from("crew_team_relationships")
            .select("requester_user_id,recipient_user_id", { count: "exact" })
            .eq("status", "accepted")
            .or(
              `requester_user_id.in.(${userList}),recipient_user_id.in.(${userList})`,
            )
            .limit(maximumTeamCoupleRelationshipsPerBatch);
        }),
    );

    for (const result of results) {
      if (
        result.error ||
        typeof result.count !== "number" ||
        result.count > maximumTeamCoupleRelationshipsPerBatch
      ) {
        console.error(
          "Find Crew Team/Couple relationships could not be loaded",
          result.error
            ? safeErrorMessage(result.error)
            : "team_couple_relationship_capacity_exceeded",
        );
        throw new Error("find_crew_profiles_unavailable");
      }

      for (const row of result.data || []) {
        const requesterUserId = text(row.requester_user_id);
        const recipientUserId = text(row.recipient_user_id);
        if (!isUuid(requesterUserId) || !isUuid(recipientUserId)) {
          throw new Error("find_crew_profiles_invalid");
        }
        acceptedUserIds.add(requesterUserId);
        acceptedUserIds.add(recipientUserId);
      }
    }
  }

  return acceptedUserIds;
}

async function loadCrewMaritalStatuses(
  serviceClient: SupabaseClient,
  profileIds: string[],
) {
  const statuses = new Map<string, string>();
  for (
    let profileIndex = 0;
    profileIndex < profileIds.length;
    profileIndex += relatedProfileBatchSize
  ) {
    const { data, error } = await serviceClient
      .from("crew_profiles")
      .select("id,marital_status")
      .in(
        "id",
        profileIds.slice(
          profileIndex,
          profileIndex + relatedProfileBatchSize,
        ),
      );
    if (error) {
      console.error(
        "Find Crew marital status filters could not be loaded",
        safeErrorMessage(error),
      );
      throw new Error("find_crew_profiles_unavailable");
    }
    for (const row of data || []) {
      const profileId = text(row.id);
      const maritalStatus = text(row.marital_status);
      if (isUuid(profileId) && maritalStatus) {
        statuses.set(profileId, maritalStatus);
      }
    }
  }
  return statuses;
}

type ArrayElement<Value> = Value extends Array<infer Item> ? Item : never;

async function loadCrewRelatedRows(
  serviceClient: SupabaseClient,
  table: "crew_documents" | "crew_references" | "crew_portfolio_photos",
  selection: string,
  profileIds: string[],
  publicOnly: boolean,
) {
  const rows: Record<string, unknown>[] = [];
  for (
    let profileIndex = 0;
    profileIndex < profileIds.length;
    profileIndex += relatedProfileBatchSize
  ) {
    const profileBatch = profileIds.slice(
      profileIndex,
      profileIndex + relatedProfileBatchSize,
    );
    for (let offset = 0; ; offset += relatedPageSize) {
      let query = serviceClient
        .from(table)
        .select(selection)
        .in("crew_profile_id", profileBatch)
        .order("created_at", { ascending: false })
        .range(offset, offset + relatedPageSize - 1);
      if (publicOnly) query = query.eq("show_on_cv", true);
      const { data, error } = await query;
      if (error) {
        console.error(
          "Find Crew public career records could not be loaded",
          safeErrorMessage(error),
        );
        throw new Error("find_crew_profiles_unavailable");
      }
      const page = (data || []) as unknown as Record<string, unknown>[];
      rows.push(...page);
      if (page.length < relatedPageSize) break;
    }
  }
  return rows;
}

function groupRelatedRows<Row extends Record<string, unknown>>(rows: Row[]) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const profileId = text(row.crew_profile_id);
    if (!isUuid(profileId)) continue;
    const profileRows = grouped.get(profileId) || [];
    profileRows.push(row);
    grouped.set(profileId, profileRows);
  }
  return grouped;
}

function toCrewSearchRecord(
  row: CrewProfileRow,
  related: CrewSearchRelatedData,
): CrewSearchRecord | null {
  const profileId = text(row.id);
  const userId = text(row.user_id);
  if (!isUuid(profileId) || !isUuid(userId)) return null;

  const experiences = related.experiencesByProfile.get(profileId) || [];
  const preview = toDiscoverableCrewPreview(row, experiences);
  if (!preview) return null;
  const profileIdentity = text(row.full_name).slice(0, 120);
  const maritalStatus = identitySafeProfileField(
    related.maritalStatuses.get(profileId),
    profileIdentity,
    16,
  );
  const gender = identitySafeProfileField(row.gender, profileIdentity, 60);
  const smoker = identitySafeProfileField(row.smoker, profileIdentity, 60);
  const visibleTattoos = identitySafeProfileField(
    row.visible_tattoos,
    profileIdentity,
    120,
  );
  const characteristics = identitySafeStringArray(
    row.personal_characteristics,
    profileIdentity,
    30,
    120,
  );
  const workPreferences = identitySafeStringArray(
    row.work_preferences,
    profileIdentity,
    30,
    120,
  );
  const languages = publicCandidateLanguageEntries(row.languages).map(
    (item) => ({
      name: identitySafeProfileField(item.name, profileIdentity, 80),
      level: identitySafeProfileField(item.level, profileIdentity, 80),
    }),
  );
  const references = related.referencesByProfile.get(profileId) || [];
  const referenceCount = countExperienceReferences(experiences, references);
  const documentCount = related.documentCounts.get(profileId) || 0;
  const galleryRows = related.photosByProfile.get(profileId) || [];
  const galleryCount = selectOwnedPublicCrewGallerySources(
    galleryRows,
    profileId,
    [profileId, userId],
  ).length;
  const searchText = normalizeCrewSearchText(
    [
      preview.displayName,
      preview.currentPosition,
      ...preview.seekingPositions,
      preview.location,
      ...preview.preferredLocations,
      preview.nationality,
      preview.availabilityStatus,
      ...preview.employmentTypes,
      ...preview.personalSkills,
      ...characteristics,
      ...workPreferences,
      ...languages.flatMap((item) => [item.name, item.level]),
    ].join(" "),
  );

  return {
    profileId,
    userId,
    preview,
    characteristics,
    workPreferences,
    languages,
    maritalStatus,
    gender,
    smoker,
    visibleTattoos,
    referenceCount,
    documentCount,
    galleryCount,
    hasTeamCouple: related.teamCoupleUserIds.has(userId),
    searchText,
  };
}

function crewSearchRecordMatches(
  record: CrewSearchRecord,
  filters: CrewSearchFilters,
) {
  const preview = record.preview;
  const terms = normalizeCrewSearchText(filters.query).split(" ").filter(Boolean);
  if (terms.some((term) => !record.searchText.includes(term))) return false;
  if (
    filters.position &&
    !hasExactCrewValue(
      [preview.currentPosition, ...preview.seekingPositions],
      filters.position,
    )
  ) {
    return false;
  }
  if (
    filters.availability &&
    !sameCrewValue(preview.availabilityStatus, filters.availability)
  ) {
    return false;
  }
  if (
    filters.nationality &&
    !nationalityValueMatchesCountry(
      preview.nationality,
      filters.nationality,
    )
  ) {
    return false;
  }
  if (
    filters.maritalStatus &&
    !sameCrewValue(record.maritalStatus, filters.maritalStatus)
  ) {
    return false;
  }
  if (filters.gender && !sameCrewValue(record.gender, filters.gender)) {
    return false;
  }
  if (filters.smoker && !sameCrewValue(record.smoker, filters.smoker)) {
    return false;
  }
  if (
    filters.visibleTattoos &&
    !sameCrewValue(record.visibleTattoos, filters.visibleTattoos)
  ) {
    return false;
  }
  if (!crewExperienceMatchesFilters(preview, filters)) {
    return false;
  }
  if (filters.premiumOnly && !preview.premiumProfile) return false;
  if (filters.hasPhoto && !preview.profilePhotoUrl) return false;
  if (filters.hasGallery && record.galleryCount === 0) return false;
  if (filters.hasTeamCouple && !record.hasTeamCouple) return false;
  return true;
}

function hasExactCrewValue(values: string[], expected: string) {
  return values.some((value) => sameCrewValue(value, expected));
}

function sameCrewValue(left: string, right: string) {
  return normalizeCrewSearchText(left) === normalizeCrewSearchText(right);
}

function normalizeCrewSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function crewSearchFacets(records: CrewSearchRecord[]): CrewSearchFacets {
  return {
    positions: sortedCrewFacet(
      records.flatMap((record) => [
        record.preview.currentPosition,
        ...record.preview.seekingPositions,
      ]),
    ),
    availabilities: sortedCrewFacet(
      records.map((record) => record.preview.availabilityStatus),
    ),
    employmentTypes: sortedCrewFacet(
      records.flatMap((record) => record.preview.employmentTypes),
    ),
    nationalities: sortedCrewFacet(
      records.map((record) => record.preview.nationality),
    ),
    maritalStatuses: sortedCrewFacet(
      records.map((record) => record.maritalStatus),
    ),
    skills: sortedCrewFacet(
      records.flatMap((record) => record.preview.personalSkills),
    ),
    characteristics: sortedCrewFacet(
      records.flatMap((record) => record.characteristics),
    ),
    workPreferences: sortedCrewFacet(
      records.flatMap((record) => record.workPreferences),
    ),
  };
}

function sortedCrewFacet(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "en-US"))
    .slice(0, 250);
}

function compareCrewSearchRecords(left: CrewSearchRecord, right: CrewSearchRecord) {
  const dateOrder =
    databaseTimestamp(right.preview.memberSince).localeCompare(
      databaseTimestamp(left.preview.memberSince),
    );
  return dateOrder || right.preview.crewId.localeCompare(left.preview.crewId);
}

function isRecordAfterCrewCursor(
  record: CrewSearchRecord,
  cursor: { memberSince: string; crewId: string },
) {
  const memberSince = databaseTimestamp(record.preview.memberSince);
  return (
    memberSince < cursor.memberSince ||
    (memberSince === cursor.memberSince &&
      record.preview.crewId.localeCompare(cursor.crewId) < 0)
  );
}

function crewSearchFingerprint(filters: CrewSearchFilters) {
  return createHash("sha256")
    .update(crewSearchFingerprintInput(filters), "utf8")
    .digest("base64url")
    .slice(0, 24);
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
  const userId = text(row.user_id);
  if (!isUuid(profileId) || !isUuid(userId)) return null;

  const [
    photoResult,
    documentResult,
    referenceResult,
    experienceResult,
    teamCoupleUserIds,
  ] = await Promise.all([
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
        .eq("crew_profile_id", profileId)
        .eq("show_on_cv", true),
      serviceClient
        .from("crew_references")
        .select("id,crew_experience_id")
        .eq("crew_profile_id", profileId)
        .eq("show_on_cv", true),
      loadCandidateExperienceRows(serviceClient, [profileId]),
      loadAcceptedTeamCoupleUserIds(serviceClient, [userId]),
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
    hasTeamCouple: teamCoupleUserIds.has(userId),
    fullName: preview.displayName,
    bio: professionalSummary,
    gender: rawGender,
    maritalStatus: identitySafeProfileField(
      row.marital_status,
      profileIdentity,
      16,
    ),
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
 * eligibility is automatic unless the member explicitly selects Not available;
 * other discovery settings provide optional public work-preference values.
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
  if (!isCrewVisibleInDirectory(discovery)) return null;

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
    mediaProfile.userId,
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

async function loadActiveDirectoryGallerySources(
  profileId: string,
  userId: string,
) {
  if (!isUuid(profileId) || !isUuid(userId)) return [];
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
    userId,
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
  const discovery = parseCrewDiscoverySettings(notes);
  const completionPercent = calculateCrewProfileCompletion({
    profile: row,
    experiences,
  });
  const experienceBreakdown = crewExperienceBreakdown(experiences);

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
    availabilityStatus: identitySafeProfileField(
      discovery.availabilityStatus,
      profileIdentity,
      120,
    ),
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
    yachtExperienceYears: experienceBreakdown.yachtYears,
    otherExperienceYears: experienceBreakdown.otherYears,
    premiumProfile: isPremiumCrewProfile(completionPercent),
    memberSince: databaseTimestamp(row.created_at),
  };
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

function encodePublicCrewCursor(
  record: CrewSearchRecord | undefined,
  filterFingerprint: string,
) {
  if (!record) return null;
  const memberSince = databaseTimestamp(record.preview.memberSince);
  const crewId = normalizePublicCrewId(record.preview.crewId);
  if (!memberSince || !crewId || !filterFingerprint) return null;
  try {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      publicCrewCursorKey(),
      initializationVector,
    );
    const encrypted = Buffer.concat([
      cipher.update(
        JSON.stringify([filterFingerprint, memberSince, crewId]),
        "utf8",
      ),
      cipher.final(),
    ]);
    return [
      "v2",
      initializationVector.toString("base64url"),
      encrypted.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
    ].join(".");
  } catch {
    return null;
  }
}

function decodePublicCrewCursor(
  value: string,
  expectedFilterFingerprint: string,
) {
  if (!/^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{1,256}\.[A-Za-z0-9_-]{22}$/.test(value)) {
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
    if (!Array.isArray(decoded) || decoded.length !== 3) return null;
    const filterFingerprint = text(decoded[0]);
    const memberSince = databaseTimestamp(decoded[1]);
    const crewId = normalizePublicCrewId(text(decoded[2]));
    return filterFingerprint === expectedFilterFingerprint &&
      memberSince &&
      crewId
      ? { memberSince, crewId }
      : null;
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
