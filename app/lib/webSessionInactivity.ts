export const WEB_SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1_000;
export const WEB_SESSION_ACTIVITY_WRITE_THROTTLE_MS = 15_000;
export const WEB_SESSION_ACTIVITY_STORAGE_KEY =
  "bluedeck.auth.web-session-activity.v1";
export const WEB_SESSION_IDLE_LOCK_STORAGE_KEY =
  "bluedeck.auth.web-session-idle-lock.v1";
export const WEB_SESSION_LOGOUT_STORAGE_KEY =
  "bluedeck.auth.web-session-logout.v1";
export const WEB_SESSION_LOGOUT_EVENT = "bluedeck:web-session-logout";

const clockSkewToleranceMs = 5 * 60 * 1_000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unsafeReturnPathPattern =
  /^\/(?:auth|forgot-password|login|reset-password|signup)(?:\/|$)/i;

export type WebSessionActivityRecord = {
  version: 1;
  sessionId: string;
  lastActivityAt: number;
};

export type WebSessionIdleLock = {
  version: 1;
  sessionId: string;
  lockedAt: number;
  lastActivityAt: number;
};

export type WebSessionLogoutMarker = {
  version: 1;
  sessionId: string;
  loggedOutAt: number;
  reason: "idle" | "manual";
};

export type WebSessionLogoutTarget =
  | "current"
  | "current-preserve"
  | "none"
  | "persisted";

export function resolveWebSessionId(accessToken: string, userId = "") {
  const jwtSessionId = readJwtSessionId(accessToken);
  if (jwtSessionId) return jwtSessionId;
  return isCanonicalUuid(userId) ? userId.toLowerCase() : "";
}

export function createWebSessionActivityRecord(
  sessionId: string,
  lastActivityAt: number,
): WebSessionActivityRecord {
  return {
    version: 1,
    sessionId: sessionId.toLowerCase(),
    lastActivityAt,
  };
}

export function createWebSessionIdleLock(
  sessionId: string,
  lockedAt: number,
  lastActivityAt: number,
): WebSessionIdleLock {
  return {
    version: 1,
    sessionId: sessionId.toLowerCase(),
    lockedAt,
    lastActivityAt,
  };
}

export function createWebSessionLogoutMarker(
  sessionId: string,
  reason: WebSessionLogoutMarker["reason"],
  loggedOutAt: number,
): WebSessionLogoutMarker {
  return {
    version: 1,
    sessionId: sessionId.toLowerCase(),
    loggedOutAt,
    reason,
  };
}

export function parseWebSessionActivity(
  value: string | null | undefined,
  now = Date.now(),
): WebSessionActivityRecord | null {
  const parsed = parseStoredObject(value);
  if (
    !parsed ||
    parsed.version !== 1 ||
    !isCanonicalUuid(parsed.sessionId) ||
    !isValidStoredTimestamp(parsed.lastActivityAt, now)
  ) {
    return null;
  }

  return createWebSessionActivityRecord(
    parsed.sessionId,
    parsed.lastActivityAt,
  );
}

export function parseWebSessionIdleLock(
  value: string | null | undefined,
  now = Date.now(),
): WebSessionIdleLock | null {
  const parsed = parseStoredObject(value);
  if (
    !parsed ||
    parsed.version !== 1 ||
    !isCanonicalUuid(parsed.sessionId) ||
    !isValidStoredTimestamp(parsed.lockedAt, now) ||
    !isValidStoredTimestamp(parsed.lastActivityAt, now) ||
    parsed.lastActivityAt > parsed.lockedAt
  ) {
    return null;
  }

  return createWebSessionIdleLock(
    parsed.sessionId,
    parsed.lockedAt,
    parsed.lastActivityAt,
  );
}

export function parseWebSessionLogoutMarker(
  value: string | null | undefined,
  now = Date.now(),
): WebSessionLogoutMarker | null {
  const parsed = parseStoredObject(value);
  if (
    !parsed ||
    parsed.version !== 1 ||
    !isCanonicalUuid(parsed.sessionId) ||
    (parsed.reason !== "idle" && parsed.reason !== "manual") ||
    !isValidStoredTimestamp(parsed.loggedOutAt, now)
  ) {
    return null;
  }

  return createWebSessionLogoutMarker(
    parsed.sessionId,
    parsed.reason,
    parsed.loggedOutAt,
  );
}

export function isVerifiedIdleLogoutTransition(
  idleLock: WebSessionIdleLock | null,
  logoutMarker: WebSessionLogoutMarker | null,
  activity: WebSessionActivityRecord | null,
  expectedSessionId = "",
) {
  if (
    !idleLock ||
    !logoutMarker ||
    logoutMarker.reason !== "idle" ||
    logoutMarker.sessionId !== idleLock.sessionId ||
    (expectedSessionId &&
      logoutMarker.sessionId !== expectedSessionId.toLowerCase())
  ) {
    return false;
  }

  return webSessionIdleLockApplies(
    idleLock,
    activity,
    logoutMarker.sessionId,
  );
}

export function resolveWebSessionLogoutTarget(
  markerSessionId: string,
  currentSessionId: string,
  persistedSessionId: string,
  hasPersistedSession: boolean,
): WebSessionLogoutTarget {
  const markerId = markerSessionId.toLowerCase();
  const currentId = currentSessionId.toLowerCase();
  const persistedId = persistedSessionId.toLowerCase();

  if (persistedId) {
    if (persistedId === markerId) return "persisted";
    return currentId === markerId ? "current-preserve" : "none";
  }

  if (hasPersistedSession) {
    return currentId === markerId ? "current-preserve" : "none";
  }

  return currentId === markerId ? "current" : "none";
}

export function selectReplacementWebSessionLogoutMarker(
  completedMarker: WebSessionLogoutMarker,
  candidates: ReadonlyArray<WebSessionLogoutMarker | null>,
  currentSessionId: string,
  persistedSessionId: string,
  hasPersistedSession: boolean,
) {
  let selected: WebSessionLogoutMarker | null = null;
  let selectedPriority = 0;
  const completedPriority = webSessionLogoutTargetPriority(
    resolveWebSessionLogoutTarget(
      completedMarker.sessionId,
      currentSessionId,
      persistedSessionId,
      hasPersistedSession,
    ),
  );
  for (const candidate of candidates) {
    if (!candidate) continue;

    const target = resolveWebSessionLogoutTarget(
      candidate.sessionId,
      currentSessionId,
      persistedSessionId,
      hasPersistedSession,
    );
    if (
      (candidate.sessionId === completedMarker.sessionId &&
        candidate.loggedOutAt === completedMarker.loggedOutAt &&
        candidate.reason === completedMarker.reason) ||
      target === "none"
    ) {
      continue;
    }

    // A persisted session is the browser's next source of truth, so its
    // tombstone must win over a stale in-memory session asking for reload.
    const priority = webSessionLogoutTargetPriority(target);
    if (priority <= completedPriority) continue;

    if (
      priority > selectedPriority ||
      (priority === selectedPriority &&
        (!selected || candidate.loggedOutAt > selected.loggedOutAt))
    ) {
      selected = candidate;
      selectedPriority = priority;
    }
  }

  return selected;
}

function webSessionLogoutTargetPriority(target: WebSessionLogoutTarget) {
  return target === "persisted"
    ? 3
    : target === "current"
      ? 2
      : target === "current-preserve"
        ? 1
        : 0;
}

export function remainingWebSessionIdleTime(
  activity: WebSessionActivityRecord,
  sessionId: string,
  now = Date.now(),
) {
  if (activity.sessionId !== sessionId.toLowerCase()) return null;

  const elapsed = Math.max(0, now - activity.lastActivityAt);
  return Math.max(0, WEB_SESSION_IDLE_TIMEOUT_MS - elapsed);
}

export function hasWebSessionIdleTimeoutElapsed(
  activity: WebSessionActivityRecord,
  sessionId: string,
  now = Date.now(),
) {
  return remainingWebSessionIdleTime(activity, sessionId, now) === 0;
}

export function webSessionIdleLockApplies(
  idleLock: WebSessionIdleLock,
  activity: WebSessionActivityRecord | null,
  sessionId: string,
) {
  const normalizedSessionId = sessionId.toLowerCase();
  if (
    idleLock.sessionId !== normalizedSessionId ||
    idleLock.lockedAt - idleLock.lastActivityAt <
      WEB_SESSION_IDLE_TIMEOUT_MS
  ) {
    return false;
  }

  return !(
    activity?.sessionId === normalizedSessionId &&
    activity.lastActivityAt > idleLock.lastActivityAt
  );
}

export function buildIdleLoginHref(pathname: string, search = "") {
  const params = new URLSearchParams({
    reason: "inactive",
    next: safeIdleReturnPath(pathname, search),
  });
  return `/login?${params.toString()}`;
}

export function safeIdleReturnPath(pathname: string, search = "") {
  if (
    !pathname ||
    pathname.length + search.length > 2_048 ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(pathname) ||
    (search && (!search.startsWith("?") || search.includes("#")))
  ) {
    return "/dashboard";
  }

  try {
    const origin = "https://www.bluedeck.app";
    const destination = new URL(`${pathname}${search}`, origin);
    if (
      destination.origin !== origin ||
      unsafeReturnPathPattern.test(destination.pathname)
    ) {
      return "/dashboard";
    }

    return `${destination.pathname}${destination.search}`;
  } catch {
    return "/dashboard";
  }
}

function readJwtSessionId(accessToken: string) {
  try {
    const encodedPayload = accessToken.split(".")[1];
    if (!encodedPayload || encodedPayload.length > 16_384) return "";

    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as {
      session_id?: unknown;
    };

    return isCanonicalUuid(payload.session_id)
      ? payload.session_id.toLowerCase()
      : "";
  } catch {
    return "";
  }
}

function parseStoredObject(value: string | null | undefined) {
  if (!value || value.length > 1_024) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isValidStoredTimestamp(value: unknown, now: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= now + clockSkewToleranceMs
  );
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}
