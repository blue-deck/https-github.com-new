import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  parseCrewDiscoverySettings,
  type CrewDiscoverySettings,
} from "./crewDiscovery";
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
  public_crew_id?: string;
  notes?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function listDiscoverableCrew(): Promise<DiscoverableCrewProfile[]> {
  const serviceClient = createServiceClient();
  if (!serviceClient) return [];

  const { data, error } = await serviceClient
    .from("crew_profiles")
    .select(
      "id,public_crew_id,full_name,profile_photo_url,current_position,current_positions,seeking_positions,location,nationality,bio,languages,personal_skills,personal_characteristics,work_preferences,notes,created_at",
    )
    .not("public_crew_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(250);

  if (error) {
    console.error("Find Crew profiles could not be loaded", error.message);
    return [];
  }

  const visibleRows = ((data || []) as CrewProfileRow[]).filter((row) => {
    const settings = parseCrewDiscoverySettings(text(row.notes));
    return settings.discoverable && settings.contactVisibility !== "hidden";
  });

  const profileIds = visibleRows
    .map((row) => text(row.id))
    .filter(Boolean);
  const experienceStarts = new Map<string, string[]>();

  if (profileIds.length > 0) {
    const { data: experienceRows } = await serviceClient
      .from("crew_experiences")
      .select("crew_profile_id,start_date")
      .in("crew_profile_id", profileIds);

    for (const experience of experienceRows || []) {
      const profileId = text(experience.crew_profile_id);
      const startDate = text(experience.start_date);
      if (!profileId || !startDate) continue;
      experienceStarts.set(profileId, [...(experienceStarts.get(profileId) || []), startDate]);
    }
  }

  return visibleRows
    .map((row) => toDiscoverableCrew(row, experienceStarts.get(text(row.id)) || []))
    .filter((profile): profile is DiscoverableCrewProfile => Boolean(profile))
    .sort(sortDiscoverableCrew);
}

export async function getDiscoverableCrew(
  crewId: string,
): Promise<DiscoverableCrewProfile | null> {
  const cleanCrewId = decodeURIComponent(crewId).trim().toUpperCase();
  if (!cleanCrewId) return null;

  const profiles = await listDiscoverableCrew();
  return profiles.find((profile) => profile.crewId === cleanCrewId) || null;
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

function toDiscoverableCrew(
  row: CrewProfileRow,
  experienceStarts: string[],
): DiscoverableCrewProfile | null {
  const crewId = text(row.public_crew_id).toUpperCase();
  if (!crewId) return null;

  const currentPosition =
    stringArray(row.current_positions)[0] ||
    text(row.current_position) ||
    "Yacht Crew";

  return {
    crewId,
    fullName: text(row.full_name) || "BlueDeck Crew Member",
    profilePhotoUrl: safePublicUrl(text(row.profile_photo_url)),
    currentPosition,
    seekingPositions: stringArray(row.seeking_positions),
    location: text(row.location),
    nationality: text(row.nationality),
    bio: text(row.bio),
    languages: languageArray(row.languages),
    personalSkills: stringArray(row.personal_skills).slice(0, 8),
    personalCharacteristics: stringArray(row.personal_characteristics).slice(0, 8),
    workPreferences: stringArray(row.work_preferences).slice(0, 8),
    experienceYears: calculateExperienceYears(experienceStarts),
    discovery: parseCrewDiscoverySettings(text(row.notes)),
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
      const name = text(record.name);
      if (!name) return null;
      return { name, level: text(record.level) };
    })
    .filter((item): item is { name: string; level: string } => Boolean(item))
    .slice(0, 8);
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safePublicUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
