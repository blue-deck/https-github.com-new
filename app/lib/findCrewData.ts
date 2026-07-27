import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type CrewDiscoverySettings } from "./crewDiscovery";
import { canUseCrewWorkspace } from "./marketplaceCapabilities";
import {
  getPublicCrewDiscoverySettings,
  normalizePublicCrewId,
  publicStringArray,
  redactPublicContactDetails,
  safePublicMediaUrl,
} from "./publicCrewSafety";
import { resolveSupabaseUrl } from "./supabaseConfig";

export type DiscoverableCrewProfile = {
  crewId: string;
  fullName: string;
  profilePhotoUrl: string;
  currentPosition: string;
  seekingPositions: string[];
  location: string;
  nationality: string;
  bio: string;
  languages: Array<{ name: string; level: string }>;
  personalSkills: string[];
  personalCharacteristics: string[];
  workPreferences: string[];
  experienceYears: number;
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
const discoverableCrewSelect =
  "id,user_id,public_crew_id,full_name,profile_photo_url,current_position,current_positions,seeking_positions,location,nationality,bio,languages,personal_skills,personal_characteristics,work_preferences,notes";

export async function listDiscoverableCrew(): Promise<DiscoverableCrewProfile[]> {
  const serviceClient = createServiceClient();
  if (!serviceClient) return [];

  const { data, error } = await serviceClient
    .from("crew_profiles")
    .select(discoverableCrewSelect)
    .not("public_crew_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(250);

  if (error) {
    console.error("Find Crew profiles could not be loaded", error.message);
    return [];
  }

  const eligibleRows = await filterCrewWorkspaceProfiles(
    serviceClient,
    (data || []) as CrewProfileRow[],
  );
  const visibleRows = eligibleRows
    .map((row) => ({
      row,
      settings: getPublicCrewDiscoverySettings(row.notes),
    }))
    .filter(
      (
        entry,
      ): entry is {
        row: CrewProfileRow;
        settings: CrewDiscoverySettings;
      } => Boolean(entry.settings),
    );

  const profileIds = visibleRows
    .map(({ row }) => text(row.id))
    .filter(Boolean);
  const experienceStarts = new Map<string, string[]>();

  if (profileIds.length > 0) {
    const { data: experienceRows } = await serviceClient
      .from("crew_experiences")
      .select("crew_profile_id,start_date")
      .in("crew_profile_id", profileIds)
      .limit(5_000);

    for (const experience of experienceRows || []) {
      const profileId = text(experience.crew_profile_id);
      const startDate = text(experience.start_date);
      if (!profileId || !startDate) continue;
      experienceStarts.set(profileId, [...(experienceStarts.get(profileId) || []), startDate]);
    }
  }

  return visibleRows
    .map(({ row, settings }) =>
      toDiscoverableCrew(
        row,
        experienceStarts.get(text(row.id)) || [],
        settings,
      ),
    )
    .filter((profile): profile is DiscoverableCrewProfile => Boolean(profile))
    .sort(sortDiscoverableCrew);
}

export async function getDiscoverableCrew(
  crewId: string,
): Promise<DiscoverableCrewProfile | null> {
  const cleanCrewId = normalizePublicCrewId(crewId);
  if (!cleanCrewId) return null;

  const serviceClient = createServiceClient();
  if (!serviceClient) return null;

  const { data, error } = await serviceClient
    .from("crew_profiles")
    .select(discoverableCrewSelect)
    .eq("public_crew_id", cleanCrewId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as CrewProfileRow;
  const [eligibleRow] = await filterCrewWorkspaceProfiles(serviceClient, [row]);
  if (!eligibleRow) return null;

  const settings = getPublicCrewDiscoverySettings(row.notes);
  const profileId = text(row.id);
  if (!settings || !profileId) return null;

  const { data: experienceRows, error: experienceError } = await serviceClient
    .from("crew_experiences")
    .select("start_date")
    .eq("crew_profile_id", profileId)
    .limit(100);

  if (experienceError) return null;

  return toDiscoverableCrew(
    row,
    (experienceRows || []).map((experience) => text(experience.start_date)),
    settings,
  );
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

async function filterCrewWorkspaceProfiles(
  serviceClient: SupabaseClient,
  rows: CrewProfileRow[],
) {
  const userIds = Array.from(
    new Set(rows.map((row) => text(row.user_id)).filter(Boolean)),
  );
  if (userIds.length === 0) return [];

  const { data, error } = await serviceClient
    .from("marketplace_entitlements")
    .select("user_id,account_role")
    .in("user_id", userIds);

  if (error) {
    console.error("Find Crew roles could not be verified", error.message);
    return [];
  }

  const eligibleUserIds = new Set(
    (data || [])
      .filter((entitlement) =>
        canUseCrewWorkspace(entitlement.account_role),
      )
      .map((entitlement) => text(entitlement.user_id))
      .filter(Boolean),
  );

  return rows.filter((row) => eligibleUserIds.has(text(row.user_id)));
}

function toDiscoverableCrew(
  row: CrewProfileRow,
  experienceStarts: string[],
  discovery: CrewDiscoverySettings,
): DiscoverableCrewProfile | null {
  const crewId = text(row.public_crew_id).toUpperCase();
  if (!crewId) return null;

  const currentPosition =
    publicStringArray(row.current_positions, 1, 120)[0] ||
    redactPublicContactDetails(row.current_position, 120) ||
    "Yacht Crew";

  return {
    crewId,
    fullName:
      redactPublicContactDetails(row.full_name, 120) ||
      "BlueDeck Crew Member",
    profilePhotoUrl: safePublicMediaUrl(row.profile_photo_url),
    currentPosition,
    seekingPositions: publicStringArray(row.seeking_positions, 18, 120),
    location: redactPublicContactDetails(row.location, 160),
    nationality: redactPublicContactDetails(row.nationality, 80),
    bio: redactPublicContactDetails(row.bio, 2_000),
    languages: languageArray(row.languages),
    personalSkills: publicStringArray(row.personal_skills, 8, 120),
    personalCharacteristics: publicStringArray(
      row.personal_characteristics,
      8,
      120,
    ),
    workPreferences: publicStringArray(row.work_preferences, 8, 120),
    experienceYears: calculateExperienceYears(experienceStarts),
    discovery,
  };
}

function sortDiscoverableCrew(
  first: DiscoverableCrewProfile,
  second: DiscoverableCrewProfile,
) {
  const availabilityPriority = (status: string) => {
    if (status === "Available now") return 0;
    if (status === "Available soon") return 1;
    if (status === "Open to offers") return 2;
    return 3;
  };

  const availabilityDifference =
    availabilityPriority(first.discovery.availabilityStatus) -
    availabilityPriority(second.discovery.availabilityStatus);
  if (availabilityDifference !== 0) return availabilityDifference;
  return second.experienceYears - first.experienceYears;
}

function calculateExperienceYears(startDates: string[]) {
  const years = startDates
    .map((date) => Number(date.slice(0, 4)))
    .filter((year) => Number.isInteger(year) && year > 1950);
  if (years.length === 0) return 0;
  return Math.max(new Date().getFullYear() - Math.min(...years), 1);
}

function languageArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const name = redactPublicContactDetails(record.name, 80);
      if (!name) return null;
      return {
        name,
        level: redactPublicContactDetails(record.level, 80),
      };
    })
    .filter((item): item is { name: string; level: string } => Boolean(item))
    .slice(0, 8);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
