export const crewDiscoveryNotesPrefix = "__BLUDECK_FIND_CREW__";

export const crewAvailabilityStatuses = [
  "Available",
  "In 1 week",
  "In 1 month",
  "Open to offers",
  "Not available",
] as const;

export const crewEmploymentTypes = [
  "Permanent",
  "Seasonal",
  "Rotational",
  "Temporary",
  "Delivery",
] as const;

export const crewPreferredLocations = [
  "Mediterranean",
  "Caribbean",
  "United States",
  "Middle East",
  "Northern Europe",
  "Worldwide",
] as const;

export type CrewDiscoverySettings = {
  discoverable: boolean;
  availabilityStatus: string;
  preferredLocations: string[];
  employmentTypes: string[];
  contactVisibility: "request_only" | "hidden";
};

export const defaultCrewDiscoverySettings: CrewDiscoverySettings = {
  discoverable: false,
  availabilityStatus: "Open to offers",
  preferredLocations: [],
  employmentTypes: [],
  contactVisibility: "request_only",
};

export function parseCrewDiscoverySettings(notes?: string | null): CrewDiscoverySettings {
  const { settings } = splitCrewDiscoveryNotes(notes);
  return settings;
}

export function writeCrewDiscoverySettings(
  notes: string | null | undefined,
  nextSettings: CrewDiscoverySettings,
) {
  const { remainder } = splitCrewDiscoveryNotes(notes);
  const normalized = normalizeCrewDiscoverySettings(nextSettings);
  const encoded = `${crewDiscoveryNotesPrefix}${JSON.stringify(normalized)}`;
  return remainder ? `${encoded}\n${remainder}` : encoded;
}

export function stripCrewDiscoverySettings(notes?: string | null) {
  return splitCrewDiscoveryNotes(notes).remainder;
}

function splitCrewDiscoveryNotes(notes?: string | null): {
  settings: CrewDiscoverySettings;
  remainder: string;
} {
  const value = typeof notes === "string" ? notes.trim() : "";
  if (!value.startsWith(crewDiscoveryNotesPrefix)) {
    return {
      settings: { ...defaultCrewDiscoverySettings },
      remainder: value,
    };
  }

  const firstLineBreak = value.indexOf("\n");
  const encoded =
    firstLineBreak === -1
      ? value.slice(crewDiscoveryNotesPrefix.length)
      : value.slice(crewDiscoveryNotesPrefix.length, firstLineBreak);
  const remainder = firstLineBreak === -1 ? "" : value.slice(firstLineBreak + 1).trim();

  try {
    return {
      settings: normalizeCrewDiscoverySettings(
        JSON.parse(encoded) as Partial<CrewDiscoverySettings>,
      ),
      remainder,
    };
  } catch {
    return {
      settings: { ...defaultCrewDiscoverySettings },
      remainder,
    };
  }
}

function normalizeCrewDiscoverySettings(
  value?: Partial<CrewDiscoverySettings> | null,
): CrewDiscoverySettings {
  const availabilityStatus = normalizeAvailabilityStatus(
    value?.availabilityStatus,
  );

  return {
    discoverable: value?.discoverable === true,
    availabilityStatus,
    preferredLocations: cleanAllowedList(value?.preferredLocations, crewPreferredLocations),
    employmentTypes: cleanAllowedList(value?.employmentTypes, crewEmploymentTypes),
    contactVisibility: value?.contactVisibility === "hidden" ? "hidden" : "request_only",
  };
}

function normalizeAvailabilityStatus(value: unknown) {
  if (
    crewAvailabilityStatuses.includes(
      value as (typeof crewAvailabilityStatuses)[number],
    )
  ) {
    return String(value);
  }

  const legacyStatuses: Record<string, (typeof crewAvailabilityStatuses)[number]> = {
    "Available now": "Available",
    "Available soon": "In 1 week",
    "Currently employed": "Not available",
  };

  return typeof value === "string" && legacyStatuses[value]
    ? legacyStatuses[value]
    : defaultCrewDiscoverySettings.availabilityStatus;
}

function cleanAllowedList(
  value: unknown,
  allowed: readonly string[],
) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => allowed.includes(item)),
    ),
  ).slice(0, 8);
}
