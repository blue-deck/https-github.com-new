import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildIdleLoginHref,
  createWebSessionActivityRecord,
  createWebSessionLogoutMarker,
  hasWebSessionIdleTimeoutElapsed,
  isVerifiedIdleLogoutTransition,
  parseWebSessionActivity,
  parseWebSessionIdleLock,
  parseWebSessionLogoutMarker,
  remainingWebSessionIdleTime,
  resolveWebSessionId,
  resolveWebSessionLogoutTarget,
  safeIdleReturnPath,
  selectReplacementWebSessionLogoutMarker,
  webSessionIdleLockApplies,
  WEB_SESSION_IDLE_TIMEOUT_MS,
} from "../app/lib/webSessionInactivity.ts";
import { revokeSupabaseSessionWithRefresh } from "../app/lib/supabaseSessionRevocation.ts";

const root = new URL("../", import.meta.url);
const sessionId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function jwt(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("uses an exact two-hour web and PWA inactivity boundary", () => {
  assert.equal(WEB_SESSION_IDLE_TIMEOUT_MS, 7_200_000);

  const startedAt = 1_800_000_000_000;
  const activity = createWebSessionActivityRecord(sessionId, startedAt);

  assert.equal(
    remainingWebSessionIdleTime(
      activity,
      sessionId,
      startedAt + WEB_SESSION_IDLE_TIMEOUT_MS - 1,
    ),
    1,
  );
  assert.equal(
    hasWebSessionIdleTimeoutElapsed(
      activity,
      sessionId,
      startedAt + WEB_SESSION_IDLE_TIMEOUT_MS - 1,
    ),
    false,
  );
  assert.equal(
    hasWebSessionIdleTimeoutElapsed(
      activity,
      sessionId,
      startedAt + WEB_SESSION_IDLE_TIMEOUT_MS,
    ),
    true,
  );
});

test("binds activity to the Supabase session id instead of a device mode", () => {
  assert.equal(resolveWebSessionId(jwt({ session_id: sessionId }), userId), sessionId);
  assert.equal(resolveWebSessionId("malformed", userId), userId);
  assert.equal(resolveWebSessionId("malformed", "not-a-user-id"), "");

  const activity = createWebSessionActivityRecord(sessionId, 1_000);
  assert.equal(remainingWebSessionIdleTime(activity, userId, 1_100), null);
});

test("rejects malformed, oversized, and implausibly future storage records", () => {
  const now = 1_800_000_000_000;
  const valid = JSON.stringify(
    createWebSessionActivityRecord(sessionId, now - 1_000),
  );

  assert.deepEqual(parseWebSessionActivity(valid, now), {
    version: 1,
    sessionId,
    lastActivityAt: now - 1_000,
  });

  for (const value of [
    null,
    "not-json",
    "x".repeat(1_025),
    JSON.stringify({ version: 2, sessionId, lastActivityAt: now }),
    JSON.stringify({ version: 1, sessionId: "invalid", lastActivityAt: now }),
    JSON.stringify({ version: 1, sessionId, lastActivityAt: now + 300_001 }),
  ]) {
    assert.equal(parseWebSessionActivity(value, now), null);
  }

  assert.equal(
    parseWebSessionIdleLock(
      JSON.stringify({
        version: 1,
        sessionId,
        lockedAt: now,
        lastActivityAt: now - WEB_SESSION_IDLE_TIMEOUT_MS,
      }),
      now,
    )?.sessionId,
    sessionId,
  );
});

test("a concurrent pre-deadline activity invalidates a stale tab's idle lock", () => {
  const lockedAt = 1_800_000_000_000;
  const lastActivityAt = lockedAt - WEB_SESSION_IDLE_TIMEOUT_MS;
  const idleLock = {
    version: 1,
    sessionId,
    lockedAt,
    lastActivityAt,
  };

  assert.equal(
    webSessionIdleLockApplies(
      idleLock,
      createWebSessionActivityRecord(sessionId, lastActivityAt),
      sessionId,
    ),
    true,
  );
  assert.equal(
    webSessionIdleLockApplies(
      idleLock,
      createWebSessionActivityRecord(sessionId, lockedAt - 1),
      sessionId,
    ),
    false,
  );
  assert.equal(webSessionIdleLockApplies(idleLock, null, userId), false);
});

test("validates session-bound cross-tab logout markers", () => {
  const loggedOutAt = 1_800_000_000_000;
  const marker = createWebSessionLogoutMarker(
    sessionId,
    "manual",
    loggedOutAt,
  );

  assert.deepEqual(
    parseWebSessionLogoutMarker(JSON.stringify(marker), loggedOutAt),
    marker,
  );
  assert.equal(
    parseWebSessionLogoutMarker(
      JSON.stringify({ ...marker, reason: "global" }),
      loggedOutAt,
    ),
    null,
  );
  assert.equal(
    parseWebSessionLogoutMarker(
      JSON.stringify({ ...marker, sessionId: null }),
      loggedOutAt,
    ),
    null,
  );

  const idleLock = {
    version: 1,
    sessionId,
    lockedAt: loggedOutAt,
    lastActivityAt: loggedOutAt - WEB_SESSION_IDLE_TIMEOUT_MS,
  };
  assert.equal(
    isVerifiedIdleLogoutTransition(
      idleLock,
      { ...marker, reason: "idle" },
      createWebSessionActivityRecord(
        sessionId,
        loggedOutAt - WEB_SESSION_IDLE_TIMEOUT_MS,
      ),
    ),
    true,
  );
  assert.equal(
    isVerifiedIdleLogoutTransition(idleLock, marker, null),
    false,
  );
});

test("never lets an old tab target a newer persisted session", () => {
  const newerSessionId = "55555555-5555-4555-8555-555555555555";

  assert.equal(
    resolveWebSessionLogoutTarget(sessionId, sessionId, newerSessionId, true),
    "current-preserve",
  );
  assert.equal(
    resolveWebSessionLogoutTarget(sessionId, sessionId, sessionId, true),
    "persisted",
  );
  assert.equal(
    resolveWebSessionLogoutTarget(sessionId, sessionId, "", false),
    "current",
  );
  assert.equal(
    resolveWebSessionLogoutTarget(sessionId, newerSessionId, newerSessionId, true),
    "none",
  );
});

test("chains a newer applicable logout marker instead of swallowing it", () => {
  const loggedOutAt = 1_800_000_000_000;
  const completedMarker = createWebSessionLogoutMarker(
    sessionId,
    "idle",
    loggedOutAt,
  );
  const newerSessionId = "55555555-5555-4555-8555-555555555555";
  const newerMarker = createWebSessionLogoutMarker(
    newerSessionId,
    "manual",
    loggedOutAt + 1,
  );

  assert.deepEqual(
    selectReplacementWebSessionLogoutMarker(
      completedMarker,
      [newerMarker],
      newerSessionId,
      "",
      false,
    ),
    newerMarker,
  );
  assert.equal(
    selectReplacementWebSessionLogoutMarker(
      completedMarker,
      [completedMarker],
      newerSessionId,
      "",
      false,
    ),
    null,
  );
  assert.equal(
    selectReplacementWebSessionLogoutMarker(
      completedMarker,
      [newerMarker],
      sessionId,
      "",
      false,
    ),
    null,
  );

  const overwrittenMarker = createWebSessionLogoutMarker(
    sessionId,
    "manual",
    loggedOutAt + 2,
  );
  assert.deepEqual(
    selectReplacementWebSessionLogoutMarker(
      completedMarker,
      [newerMarker, overwrittenMarker],
      newerSessionId,
      "",
      false,
    ),
    newerMarker,
  );

  assert.deepEqual(
    selectReplacementWebSessionLogoutMarker(
      completedMarker,
      [newerMarker, overwrittenMarker],
      sessionId,
      newerSessionId,
      true,
    ),
    newerMarker,
  );
  assert.equal(
    selectReplacementWebSessionLogoutMarker(
      newerMarker,
      [overwrittenMarker],
      sessionId,
      newerSessionId,
      true,
    ),
    null,
  );
});

test("gives a slow refresh and its follow-up revoke independent deadlines", async () => {
  const refreshedToken = "new-header.new-payload.new-signature";
  const signals = [];
  const requests = [];
  const fetcher = async (input, init = {}) => {
    const url = String(input);
    requests.push({ url, authorization: init.headers?.Authorization });
    signals.push(init.signal);

    if (url.includes("grant_type=refresh_token")) {
      await new Promise((resolve) => setTimeout(resolve, 70));
      assert.equal(init.signal?.aborted, false);
      return Response.json({ access_token: refreshedToken });
    }

    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.equal(init.signal?.aborted, false);
    return new Response(null, { status: 204 });
  };

  await revokeSupabaseSessionWithRefresh({
    accessToken: "old-header.old-payload.old-signature",
    anonKey: "public-anon-key",
    fetcher,
    refreshToken: "refresh-token",
    stepDeadlineMs: 100,
    supabaseUrl: "https://example.supabase.co",
  });

  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /grant_type=refresh_token/);
  assert.match(requests[1].url, /logout\?scope=local/);
  assert.equal(requests[1].authorization, `Bearer ${refreshedToken}`);
  assert.notEqual(signals[0], signals[1]);
});

test("preserves safe return routes but never returns to auth or recovery pages", () => {
  assert.equal(
    safeIdleReturnPath("/yachts/abc", "?tab=crew"),
    "/yachts/abc?tab=crew",
  );

  for (const path of [
    "/login",
    "/signup",
    "/auth/confirm",
    "/forgot-password",
    "/reset-password",
    "//attacker.example",
    "/bad\\path",
  ]) {
    assert.equal(safeIdleReturnPath(path), "/dashboard");
  }

  const href = buildIdleLoginHref("/portal/applications", "?view=open");
  const url = new URL(href, "https://www.bluedeck.app");
  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("reason"), "inactive");
  assert.equal(url.searchParams.get("next"), "/portal/applications?view=open");
});

test("global guard covers browser and installed PWA lifecycle edges", async () => {
  const [
    layout,
    guard,
    browserSession,
    supabaseClient,
    logoutRoute,
    revocationHelper,
    login,
    topBar,
    publicChrome,
    authConfig,
  ] =
    await Promise.all([
      source("app/layout.tsx"),
      source("app/components/WebSessionInactivityGuard.tsx"),
      source("app/lib/webBrowserSession.ts"),
      source("app/lib/supabase.ts"),
      source("app/api/auth/logout/route.ts"),
      source("app/lib/supabaseSessionRevocation.ts"),
      source("app/login/page.tsx"),
      source("app/components/BlueDeckTopBar.tsx"),
      source("app/components/PublicSiteChrome.tsx"),
      source("supabase/config.toml"),
    ]);

  assert.match(layout, /<WebSessionInactivityGuard\s*\/>/);
  assert.match(guard, /event\.isTrusted/);
  assert.match(guard, /"pointerdown"/);
  assert.match(guard, /"keydown"/);
  assert.match(guard, /"touchstart"/);
  assert.match(guard, /"scroll"/);
  assert.match(guard, /"visibilitychange"/);
  assert.match(guard, /"pageshow"/);
  assert.match(guard, /"pagehide"/);
  assert.match(guard, /"focus"/);
  assert.match(guard, /"storage"/);
  assert.doesNotMatch(guard, /display-mode|navigator\.standalone|mousemove/);
  assert.match(guard, /terminatePersistedSupabaseBrowserSession/);
  assert.match(guard, /WEB_SESSION_LOGOUT_STORAGE_KEY/);
  assert.match(guard, /WEB_SESSION_LOGOUT_EVENT/);
  assert.match(guard, /enforcePersistedLogoutMarker/);

  assert.match(supabaseClient, /storageKey: supabaseAuthStorageKey/);
  assert.match(supabaseClient, /`lock:\$\{supabaseAuthStorageKey\}`/);
  assert.match(supabaseClient, /lockManager\.request\(/);
  assert.match(supabaseClient, /expectedSessionId/);
  assert.match(supabaseClient, /fetch\("\/api\/auth\/logout"/);
  assert.match(supabaseClient, /keepalive: true/);
  assert.match(supabaseClient, /refreshToken/);
  assert.match(browserSession, /endWebBrowserSession/);
  assert.match(browserSession, /await terminatePersistedSupabaseBrowserSession/);
  assert.match(browserSession, /WEB_SESSION_LOGOUT_STORAGE_KEY/);
  assert.match(browserSession, /WEB_SESSION_LOGOUT_EVENT/);
  assert.match(logoutRoute, /isTrustedSameOriginMutation/);
  assert.match(logoutRoute, /readLimitedJsonObjectDetailed/);
  assert.match(logoutRoute, /revokeSupabaseSessionWithRefresh/);
  assert.match(revocationHelper, /grant_type=refresh_token/);
  assert.match(revocationHelper, /logout\?scope=local/);
  assert.match(login, /login\.notice\.inactiveSession/);
  assert.match(login, /isVerifiedIdleLogoutTransition/);
  assert.match(topBar, /endWebBrowserSession\("manual"\)/);
  assert.match(publicChrome, /endWebBrowserSession\("manual"\)/);
  assert.doesNotMatch(publicChrome, /await import\([^)]*webBrowserSession/);
  assert.doesNotMatch(
    authConfig,
    /^inactivity_timeout\s*=\s*"2h"/m,
  );
});
