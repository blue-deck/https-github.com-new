import "server-only";

import type { CrewDiscoverySettings } from "./crewDiscovery";
import { publicStringArray, redactPublicContactDetails } from "./publicCrewSafety";

type Row = Record<string, unknown>;

// Explicit CV fields only: account records, notes and private file paths never
// become part of the shareable CV. Contact fields are intentionally public here.
export function projectPublicCrewCvProfile(profile: Row, discovery: CrewDiscoverySettings) {
  return {
    full_name: redactPublicContactDetails(profile.full_name, 120) || "Crew Member",
    current_position: redactPublicContactDetails(profile.current_position, 120),
    current_positions: publicStringArray(profile.current_positions, 18, 120),
    location: redactPublicContactDetails(profile.location, 160),
    nationality: redactPublicContactDetails(profile.nationality, 80),
    date_of_birth: cvDateOfBirth(profile.date_of_birth),
    gender: redactPublicContactDetails(profile.gender, 80),
    marital_status: redactPublicContactDetails(profile.marital_status, 80),
    height_cm: cvMeasurement(profile.height_cm),
    weight_kg: cvMeasurement(profile.weight_kg),
    smoker: redactPublicContactDetails(profile.smoker, 80),
    visible_tattoos: redactPublicContactDetails(profile.visible_tattoos, 80),
    phone: cleanCvContactText(profile.phone, 80),
    email: cleanCvContactText(profile.email, 254),
    bio: redactPublicContactDetails(profile.bio, 2_000),
    languages: Array.isArray(profile.languages) ? profile.languages.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const entry = value as Row;
      const name = redactPublicContactDetails(entry.name, 80);
      return name ? [{ name, level: redactPublicContactDetails(entry.level, 80) || "Intermediate" }] : [];
    }) : [],
    personal_skills: publicStringArray(profile.personal_skills, 50, 120),
    personal_characteristics: publicStringArray(profile.personal_characteristics, 50, 120),
    work_preferences: publicStringArray(profile.work_preferences, 50, 120),
    employment_types: publicStringArray(discovery.employmentTypes, 18, 120),
    preferred_locations: publicStringArray(discovery.preferredLocations, 18, 120),
  };
}

export function cleanCvContactText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength) : "";
}

export function cvContactHref(kind: "phone" | "email", value: string) {
  if (kind === "phone") {
    if (!/^\+?[\d\s().-]+$/.test(value)) return undefined;
    const number = value.replace(/[^\d+]/g, "");
    return /^\+?\d{5,20}$/.test(number) ? `tel:${number}` : undefined;
  }
  return /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value)
    ? `mailto:${encodeURIComponent(value).replace(/%40/g, "@")}`
    : undefined;
}

function cvMeasurement(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 999 ? number : null;
}

function cvDateOfBirth(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}
