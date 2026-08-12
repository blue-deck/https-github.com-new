export const maximumTeamCoupleCrewIdLength = 64;

const maximumTeamCouplePeople = 50;
const maximumTeamCoupleVersion = 2_147_483_647;
const publicCrewIdPattern = /^[A-Z0-9_-]{1,64}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TeamCoupleAccountRole = "crew" | "captain";

export type TeamCouplePerson = {
  relationshipId: string;
  version: number;
  publicCrewId: string;
  fullName: string;
  currentPosition: string;
  accountRole: TeamCoupleAccountRole;
  isAvailable: boolean;
};

export type TeamCoupleRemoveAction = "cancel" | "decline" | "remove";

export type TeamCoupleInvitation = TeamCouplePerson & {
  invitedAt: string;
};

export type TeamCoupleDashboard = {
  ownCrewId: string;
  members: TeamCouplePerson[];
  incomingInvites: TeamCoupleInvitation[];
  outgoingInvites: TeamCoupleInvitation[];
};

export function normalizeTeamCoupleCrewId(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toUpperCase();
  return publicCrewIdPattern.test(normalized) ? normalized : "";
}

export function isTeamCoupleRelationshipId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value.trim());
}

export function isTeamCoupleVersion(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= maximumTeamCoupleVersion
  );
}

export function parseTeamCoupleDashboard(
  value: unknown,
): TeamCoupleDashboard | null {
  const candidate = unwrapSingleRow(value);
  if (!isRecord(candidate)) return null;

  const ownCrewId = normalizeTeamCoupleCrewId(candidate.ownCrewId);
  const members = parsePeople(candidate.members, false);
  const incomingInvites = parsePeople(candidate.incomingInvites, true);
  const outgoingInvites = parsePeople(candidate.outgoingInvites, true);

  if (!ownCrewId || !members || !incomingInvites || !outgoingInvites) {
    return null;
  }

  return {
    ownCrewId,
    members,
    incomingInvites,
    outgoingInvites,
  };
}

function parsePeople(value: unknown, invitation: false): TeamCouplePerson[] | null;
function parsePeople(
  value: unknown,
  invitation: true,
): TeamCoupleInvitation[] | null;
function parsePeople(
  value: unknown,
  invitation: boolean,
): TeamCouplePerson[] | TeamCoupleInvitation[] | null {
  if (!Array.isArray(value) || value.length > maximumTeamCouplePeople) {
    return null;
  }

  const people: Array<TeamCouplePerson | TeamCoupleInvitation> = [];
  for (const item of value) {
    if (!isRecord(item)) return null;

    const relationshipId = boundedText(item.relationshipId, 36).toLowerCase();
    const version = item.version;
    const publicCrewId = normalizeTeamCoupleCrewId(item.publicCrewId);
    const fullName = boundedText(item.fullName, 120);
    const currentPosition = boundedText(item.currentPosition, 120);
    const accountRole = item.accountRole;
    const isAvailable = item.isAvailable;

    if (
      !isTeamCoupleRelationshipId(relationshipId) ||
      !isTeamCoupleVersion(version) ||
      !publicCrewId ||
      !fullName ||
      (accountRole !== "crew" && accountRole !== "captain") ||
      typeof isAvailable !== "boolean"
    ) {
      return null;
    }

    const person: TeamCouplePerson = {
      relationshipId,
      version,
      publicCrewId,
      fullName,
      currentPosition,
      accountRole,
      isAvailable,
    };

    if (!invitation) {
      people.push(person);
      continue;
    }

    const invitedAt = isoTimestamp(item.invitedAt);
    if (!invitedAt) return null;
    people.push({ ...person, invitedAt });
  }

  return people;
}

function unwrapSingleRow(value: unknown) {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function boundedText(value: unknown, maximumLength: number) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return Array.from(normalized).length <= maximumLength ? normalized : "";
}

function isoTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 64) return "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
