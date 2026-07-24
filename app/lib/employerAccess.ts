export const employerAccessMetadataKey = "bluedeck_employer_access";
export const platformAdminMetadataKey = "bluedeck_admin";
export const employerAccessEntryLimit = 6;
export const employerAccessNoteLimit = 240;

export const employerAccessStatuses = [
  "pending",
  "verified",
  "rejected",
  "suspended",
] as const;

export const employerRoles = ["owner", "captain", "management"] as const;

export type EmployerAccessStatus = (typeof employerAccessStatuses)[number];
export type EmployerRole = (typeof employerRoles)[number];

export type EmployerAccessEntry = {
  requestId: string;
  yachtId: string;
  yachtName: string;
  yachtModel: string;
  role: EmployerRole;
  status: EmployerAccessStatus;
  applicantNote: string;
  requestedAt: string;
  updatedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  reviewNote: string;
};

export type EmployerAccessMetadata = {
  version: 1;
  entries: EmployerAccessEntry[];
};

export type EmployerAccessYacht = {
  id: string;
  name: string;
  model: string;
  flag: string;
  access: EmployerAccessEntry | null;
};

export function readEmployerAccessMetadata(
  metadata?: Record<string, unknown> | null,
): EmployerAccessMetadata {
  const raw = metadata?.[employerAccessMetadataKey];
  if (!raw || typeof raw !== "object") {
    return { version: 1, entries: [] };
  }

  const rawEntries = (raw as Record<string, unknown>).entries;
  const entries: unknown[] = Array.isArray(rawEntries) ? rawEntries : [];

  return {
    version: 1,
    entries: entries
      .map(normalizeEmployerAccessEntry)
      .filter((entry): entry is EmployerAccessEntry => Boolean(entry))
      .slice(0, employerAccessEntryLimit),
  };
}

export function writeEmployerAccessMetadata(
  metadata: Record<string, unknown> | null | undefined,
  entries: EmployerAccessEntry[],
) {
  return {
    ...(metadata || {}),
    [employerAccessMetadataKey]: {
      version: 1,
      entries: entries
        .map(normalizeEmployerAccessEntry)
        .filter((entry): entry is EmployerAccessEntry => Boolean(entry))
        .slice(0, employerAccessEntryLimit),
    } satisfies EmployerAccessMetadata,
  };
}

export function upsertEmployerAccessEntry(
  entries: EmployerAccessEntry[],
  nextEntry: EmployerAccessEntry,
) {
  const nextEntries = entries.filter(
    (entry) =>
      entry.yachtId !== nextEntry.yachtId &&
      entry.requestId !== nextEntry.requestId,
  );
  return [nextEntry, ...nextEntries].slice(0, employerAccessEntryLimit);
}

export function hasVerifiedEmployerAccess(
  metadata: Record<string, unknown> | null | undefined,
  yachtId: string,
) {
  return readEmployerAccessMetadata(metadata).entries.some(
    (entry) => entry.yachtId === yachtId && entry.status === "verified",
  );
}

export function isPlatformAdmin(
  metadata?: Record<string, unknown> | null,
) {
  return metadata?.[platformAdminMetadataKey] === true;
}

export function isEmployerRole(value: unknown): value is EmployerRole {
  return employerRoles.includes(value as EmployerRole);
}

export function isEmployerAccessStatus(
  value: unknown,
): value is EmployerAccessStatus {
  return employerAccessStatuses.includes(value as EmployerAccessStatus);
}

function normalizeEmployerAccessEntry(
  value: unknown,
): EmployerAccessEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const requestId = text(record.requestId).slice(0, 80);
  const yachtId = text(record.yachtId).slice(0, 80);
  const role = record.role;
  const status = record.status;

  if (
    !requestId ||
    !yachtId ||
    !isEmployerRole(role) ||
    !isEmployerAccessStatus(status)
  ) {
    return null;
  }

  return {
    requestId,
    yachtId,
    yachtName: text(record.yachtName).slice(0, 100) || "BlueDeck yacht",
    yachtModel: text(record.yachtModel).slice(0, 100),
    role,
    status,
    applicantNote: text(record.applicantNote).slice(0, employerAccessNoteLimit),
    requestedAt: text(record.requestedAt).slice(0, 48),
    updatedAt: text(record.updatedAt).slice(0, 48),
    reviewedAt: text(record.reviewedAt).slice(0, 48),
    reviewedBy: text(record.reviewedBy).slice(0, 80),
    reviewNote: text(record.reviewNote).slice(0, employerAccessNoteLimit),
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
