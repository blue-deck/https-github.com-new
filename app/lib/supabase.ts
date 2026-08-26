import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "./supabaseConfig";
import { resolveWebSessionId } from "./webSessionInactivity";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const resolvedSupabaseAnonKey = supabaseAnonKey;

type BlueDeckGlobal = typeof globalThis & {
  __bluedeckSupabase?: SupabaseClient;
};

const globalForSupabase = globalThis as BlueDeckGlobal;
const resolvedSupabaseUrl = resolveSupabaseUrl(supabaseUrl);

// This is the same key that supabase-js derives by default. Making it explicit
// lets an offline idle-timeout fail closed without changing existing sessions.
export const supabaseAuthStorageKey = `sb-${new URL(resolvedSupabaseUrl).hostname.split(".")[0]}-auth-token`;
export const supabaseAuthStorageLockName = `lock:${supabaseAuthStorageKey}`;

export const supabase =
  globalForSupabase.__bluedeckSupabase ||
  createClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: supabaseAuthStorageKey,
    },
  });

if (typeof window !== "undefined") {
  globalForSupabase.__bluedeckSupabase = supabase;
}

export async function clearPersistedSupabaseBrowserSession(
  expectedAccessToken = "",
  expectedSessionId = "",
) {
  if (typeof window === "undefined") return false;

  return withSupabaseAuthStorageLock(() => {
    try {
      const storedValue = window.localStorage.getItem(supabaseAuthStorageKey);
      if (!storedValue) return true;

      let storedAccessToken = "";
      try {
        const parsed = JSON.parse(storedValue) as { access_token?: unknown };
        storedAccessToken =
          typeof parsed.access_token === "string" ? parsed.access_token : "";
      } catch {
        // Never delete an unrecognised value while a concurrent auth flow may
        // be replacing it with a valid, newer session.
        return false;
      }

      const normalizedExpectedSessionId = expectedSessionId.toLowerCase();
      const storedSessionId = resolveWebSessionId(storedAccessToken);
      const matchesExpectedSession = Boolean(
        normalizedExpectedSessionId &&
          storedSessionId === normalizedExpectedSessionId,
      );
      const matchesExpectedAccessToken = Boolean(
        expectedAccessToken && storedAccessToken === expectedAccessToken,
      );
      if (
        (normalizedExpectedSessionId || expectedAccessToken) &&
        !matchesExpectedSession &&
        !matchesExpectedAccessToken
      ) {
        return false;
      }

      window.localStorage.removeItem(supabaseAuthStorageKey);
      window.localStorage.removeItem(`${supabaseAuthStorageKey}-code-verifier`);
      window.localStorage.removeItem(`${supabaseAuthStorageKey}-user`);
      return true;
    } catch {
      // Storage can be unavailable in privacy modes. Supabase already falls
      // back to in-memory storage there, which the login navigation discards.
      return false;
    }
  });
}

export type PersistedSupabaseBrowserSession = {
  accessToken: string;
  hasStoredSession: boolean;
  refreshToken: string;
};

export function readPersistedSupabaseBrowserSession(): PersistedSupabaseBrowserSession {
  if (typeof window === "undefined") {
    return { accessToken: "", hasStoredSession: false, refreshToken: "" };
  }

  try {
    const value = window.localStorage.getItem(supabaseAuthStorageKey);
    if (!value || value.length > 1_000_000) {
      return { accessToken: "", hasStoredSession: false, refreshToken: "" };
    }

    const parsed = JSON.parse(value) as {
      access_token?: unknown;
      refresh_token?: unknown;
    };
    return {
      accessToken: isPlausibleAccessToken(parsed?.access_token)
        ? parsed.access_token
        : "",
      hasStoredSession: true,
      refreshToken: isPlausibleRefreshToken(parsed?.refresh_token)
        ? parsed.refresh_token
        : "",
    };
  } catch {
    return { accessToken: "", hasStoredSession: true, refreshToken: "" };
  }
}

/**
 * Captures the browser credentials, starts same-origin revocation, and removes
 * persistence only while holding Supabase's own auth-storage lock. The server
 * can consume a refresh token even after the one-hour access JWT has expired,
 * while `keepalive` lets the request survive navigation to /login.
 */
export async function terminatePersistedSupabaseBrowserSession(
  accessToken = "",
  refreshToken = "",
  expectedSessionId = "",
) {
  if (typeof window === "undefined") return false;

  const persistedSession = readPersistedSupabaseBrowserSession();
  const providedAccessToken = isPlausibleAccessToken(accessToken)
    ? accessToken
    : "";
  const targetSessionId =
    expectedSessionId.toLowerCase() || resolveWebSessionId(providedAccessToken);
  const persistedSessionId = resolveWebSessionId(
    persistedSession.accessToken,
  );
  const persistedMatchesTarget = Boolean(
    !targetSessionId || persistedSessionId === targetSessionId,
  );
  const safeAccessToken =
    providedAccessToken ||
    (persistedMatchesTarget ? persistedSession.accessToken : "");
  const safeRefreshToken = isPlausibleRefreshToken(refreshToken)
    ? refreshToken
    : persistedMatchesTarget
      ? persistedSession.refreshToken
      : "";

  // Revocation is intentionally started before waiting for the storage lock;
  // it is same-origin, best-effort, and never blocks the local security step.
  requestSupabaseBrowserSessionRevocation(safeAccessToken, safeRefreshToken);
  const cleared = await clearPersistedSupabaseBrowserSession(
    safeAccessToken,
    targetSessionId || resolveWebSessionId(safeAccessToken),
  );
  if (cleared) {
    void supabase.auth.stopAutoRefresh().catch(() => undefined);
  }
  return cleared;
}

async function withSupabaseAuthStorageLock(operation: () => boolean) {
  if (typeof window === "undefined") return false;

  const lockManager = window.navigator?.locks;
  if (!lockManager) {
    // Supabase uses the same no-lock fallback on older browsers. Yield once so
    // a paired storage event from another tab can become visible before CAS.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    return operation();
  }

  const controller = new AbortController();
  const deadlineId = window.setTimeout(() => controller.abort(), 6_000);
  try {
    return await lockManager.request(
      supabaseAuthStorageLockName,
      { mode: "exclusive", signal: controller.signal },
      (lock) => {
        window.clearTimeout(deadlineId);
        return lock ? operation() : false;
      },
    );
  } catch {
    // A busy or unavailable lock must preserve storage. The tombstone remains
    // in place and the login page can safely retry after navigation/reload.
    return false;
  } finally {
    window.clearTimeout(deadlineId);
  }
}

export function requestSupabaseBrowserSessionRevocation(
  accessToken = "",
  refreshToken = "",
) {
  if (typeof window === "undefined") return;

  const safeAccessToken = isPlausibleAccessToken(accessToken)
    ? accessToken
    : "";
  const safeRefreshToken = isPlausibleRefreshToken(refreshToken)
    ? refreshToken
    : "";
  if (!safeAccessToken && !safeRefreshToken) return;

  const controller = new AbortController();
  const deadlineId = window.setTimeout(() => controller.abort(), 12_000);

  void fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken: safeAccessToken,
      refreshToken: safeRefreshToken,
    }),
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
    signal: controller.signal,
  })
    .catch(() => {
      // Local termination has already completed. Revocation is best-effort
      // when the browser is offline or the auth service cannot be reached.
    })
    .finally(() => window.clearTimeout(deadlineId));
}

function isPlausibleAccessToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 32_768 &&
    value.split(".").length === 3
  );
}

function isPlausibleRefreshToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 32_768;
}
