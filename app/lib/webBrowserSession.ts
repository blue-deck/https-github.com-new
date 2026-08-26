import { clearLegacySensitiveClientStorage } from "./clientStorageSecurity";
import {
  readPersistedSupabaseBrowserSession,
  requestSupabaseBrowserSessionRevocation,
  terminatePersistedSupabaseBrowserSession,
} from "./supabase";
import {
  createWebSessionLogoutMarker,
  parseWebSessionActivity,
  resolveWebSessionId,
  WEB_SESSION_ACTIVITY_STORAGE_KEY,
  WEB_SESSION_LOGOUT_EVENT,
  WEB_SESSION_LOGOUT_STORAGE_KEY,
  type WebSessionLogoutMarker,
} from "./webSessionInactivity";

/**
 * Terminates the current browser/PWA session and emits a session-bound marker
 * so every open BlueDeck tab follows it to the login screen. This deliberately
 * uses local scope; a future native-app session remains independent.
 */
export async function endWebBrowserSession(
  reason: WebSessionLogoutMarker["reason"],
  options: {
    accessToken?: string;
    refreshToken?: string;
    expectedSessionId?: string;
  } = {},
) {
  if (typeof window === "undefined") return false;

  const persistedSession = readPersistedSupabaseBrowserSession();
  const persistedSessionId = resolveWebSessionId(
    persistedSession.accessToken,
  );
  const expectedSessionId = options.expectedSessionId?.toLowerCase() || "";
  if (
    expectedSessionId &&
    persistedSessionId &&
    persistedSessionId !== expectedSessionId
  ) {
    clearLegacySensitiveClientStorage();
    requestSupabaseBrowserSessionRevocation(
      options.accessToken || "",
      options.refreshToken || "",
    );
    return false;
  }

  const accessToken = persistedSession.accessToken || options.accessToken || "";
  const refreshToken =
    persistedSession.refreshToken || options.refreshToken || "";
  let sessionId = resolveWebSessionId(accessToken);

  if (!sessionId) {
    try {
      sessionId =
        parseWebSessionActivity(
          window.localStorage.getItem(WEB_SESSION_ACTIVITY_STORAGE_KEY),
        )?.sessionId || "";
    } catch {
      sessionId = "";
    }
  }

  if (expectedSessionId && sessionId !== expectedSessionId) {
    clearLegacySensitiveClientStorage();
    requestSupabaseBrowserSessionRevocation(
      options.accessToken || "",
      options.refreshToken || "",
    );
    return false;
  }

  const marker = sessionId
    ? createWebSessionLogoutMarker(sessionId, reason, Date.now())
    : null;
  if (marker) {
    try {
      window.localStorage.setItem(
        WEB_SESSION_LOGOUT_STORAGE_KEY,
        JSON.stringify(marker),
      );
    } catch {
      // A privacy-mode tab can still end its own in-memory browser session.
    }
  }

  if (marker) {
    window.dispatchEvent(
      new CustomEvent(WEB_SESSION_LOGOUT_EVENT, { detail: marker }),
    );
  }
  clearLegacySensitiveClientStorage();
  return await terminatePersistedSupabaseBrowserSession(
    accessToken,
    refreshToken,
    sessionId,
  );
}
