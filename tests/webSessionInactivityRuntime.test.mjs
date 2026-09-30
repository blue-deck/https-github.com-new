import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as inactivity from "../app/lib/webSessionInactivity.ts";

const startedAt = 1_800_000_000_000;
const sessionId = "11111111-1111-4111-8111-111111111111";
const replacementSessionId = "22222222-2222-4222-8222-222222222222";
const authKey = "sb-test-auth-token";
const source = await readFile(
  new URL("../app/components/WebSessionInactivityGuard.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function session(id = sessionId) {
  return {
    access_token: `header.${Buffer.from(JSON.stringify({ session_id: id })).toString("base64url")}.signature`,
    refresh_token: `refresh-${id}`,
    user: { id: "33333333-3333-4333-8333-333333333333" },
  };
}

// Execute the actual guard with a deterministic browser clock and auth adapter.
// The adapter simulates local credential cleanup even when revocation is offline.
function browser({ lastActivityAt = startedAt, now = startedAt } = {}) {
  const storage = new Map();
  const timers = new Map();
  const listeners = new Map();
  const redirects = [];
  const terminations = [];
  const maskStates = [];
  let authSession = session();
  let authCallback;
  let nextTimer = 1;
  let cleanup;
  storage.set(authKey, JSON.stringify(authSession));
  storage.set(
    inactivity.WEB_SESSION_ACTIVITY_STORAGE_KEY,
    JSON.stringify(inactivity.createWebSessionActivityRecord(sessionId, lastActivityAt)),
  );

  const eventTarget = (prefix) => ({
    addEventListener(name, callback) {
      listeners.set(`${prefix}:${name}`, callback);
    },
    removeEventListener(name) {
      listeners.delete(`${prefix}:${name}`);
    },
  });
  const window = {
    ...eventTarget("window"),
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    setTimeout(callback, delay = 0) {
      const id = nextTimer++;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    location: {
      pathname: "/profile",
      search: "?tab=experience",
      replace: (href) => redirects.push(href),
      reload: () => redirects.push("reload"),
    },
  };
  const document = { ...eventTarget("document"), visibilityState: "visible" };
  const persisted = () => {
    const value = storage.get(authKey);
    const storedSession = value ? JSON.parse(value) : null;
    return {
      hasStoredSession: Boolean(value),
      accessToken: storedSession?.access_token ?? "",
      refreshToken: storedSession?.refresh_token ?? "",
    };
  };
  async function terminate(_access, _refresh, expectedId) {
    const stored = persisted();
    const storedId = inactivity.resolveWebSessionId(stored.accessToken);
    if (storedId && storedId !== expectedId) return false;
    terminations.push(expectedId);
    storage.delete(authKey);
    authSession = null;
    return true;
  }
  const supabaseModule = {
    supabaseAuthStorageKey: authKey,
    readPersistedSupabaseBrowserSession: persisted,
    requestSupabaseBrowserSessionRevocation: () => undefined,
    terminatePersistedSupabaseBrowserSession: terminate,
    supabase: {
      auth: {
        onAuthStateChange(callback) {
          authCallback = callback;
          return { data: { subscription: { unsubscribe() {} } } };
        },
        getSession: async () => ({ data: { session: authSession } }),
      },
    },
  };
  const modules = {
    react: {
      useEffect(effect) { cleanup = effect(); },
      useState() { return [false, (value) => maskStates.push(value)]; },
    },
    "react/jsx-runtime": { jsx: () => null },
    "../lib/clientStorageSecurity": { clearLegacySensitiveClientStorage() {} },
    "../lib/webSessionInactivity": inactivity,
    "../lib/supabase": supabaseModule,
    "../lib/webBrowserSession": {
      async endWebBrowserSession(reason, options) {
        storage.set(
          inactivity.WEB_SESSION_LOGOUT_STORAGE_KEY,
          JSON.stringify(inactivity.createWebSessionLogoutMarker(options.expectedSessionId, reason, now)),
        );
        return terminate(options.accessToken, options.refreshToken, options.expectedSessionId);
      },
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unmocked import: ${name}`);
      return modules[name];
    },
    window,
    document,
    Date: class extends Date { static now() { return now; } },
    CustomEvent: class {},
  });
  exports.WebSessionInactivityGuard();
  authCallback("INITIAL_SESSION", authSession);

  async function settle() {
    for (let turn = 0; turn < 8; turn++) await Promise.resolve();
  }
  return {
    redirects,
    terminations,
    maskStates,
    storage,
    async advance(milliseconds) {
      const until = now + milliseconds;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
        await settle();
      }
      now = until;
      await settle();
    },
    jump(milliseconds) { now += milliseconds; },
    event(target, name, event = {}) {
      listeners.get(`${target}:${name}`)?.(event);
    },
    storageEvent(key, value) {
      const newValue = value === null ? null : JSON.stringify(value);
      if (newValue === null) storage.delete(key);
      else storage.set(key, newValue);
      listeners.get("window:storage")?.({ key, newValue });
    },
    replaceSession(id) {
      authSession = session(id);
      storage.set(authKey, JSON.stringify(authSession));
      authCallback("SIGNED_IN", authSession);
    },
    cleanup() { cleanup?.(); },
  };
}

test("an active page silently expires at the two-hour boundary even if revocation is offline", async () => {
  const tab = browser();
  await tab.advance(inactivity.WEB_SESSION_IDLE_TIMEOUT_MS - 1);
  assert.equal(tab.storage.has(authKey), true);
  assert.deepEqual(tab.redirects, []);
  await tab.advance(1);
  assert.deepEqual(tab.maskStates, [true]);
  await tab.advance(100);
  assert.deepEqual(tab.redirects, ["/"]);
  assert.equal(tab.storage.has(authKey), false);
  assert.deepEqual(tab.terminations, [sessionId]);
  tab.cleanup();
});

test("a suspended tab returning after two hours cannot revive the session by interacting", async () => {
  const tab = browser();
  tab.jump(inactivity.WEB_SESSION_IDLE_TIMEOUT_MS + 30_000);
  tab.event("document", "pointerdown", { isTrusted: true });
  const activity = JSON.parse(tab.storage.get(inactivity.WEB_SESSION_ACTIVITY_STORAGE_KEY));
  assert.equal(activity.lastActivityAt, startedAt);
  await tab.advance(100);
  assert.deepEqual(tab.redirects, ["/"]);
  assert.equal(tab.storage.has(authKey), false);
  tab.cleanup();
});

test("reopening an already idle persisted session silently returns home", async () => {
  const tab = browser({ now: startedAt + inactivity.WEB_SESSION_IDLE_TIMEOUT_MS + 1 });
  await tab.advance(100);
  assert.deepEqual(tab.redirects, ["/"]);
  assert.equal(tab.storage.has(authKey), false);
  tab.cleanup();
});

test("a concurrent pre-deadline activity cancels a stale tab's pending idle logout", async () => {
  const tab = browser();
  await tab.advance(inactivity.WEB_SESSION_IDLE_TIMEOUT_MS);
  tab.storageEvent(
    inactivity.WEB_SESSION_ACTIVITY_STORAGE_KEY,
    inactivity.createWebSessionActivityRecord(sessionId, startedAt + inactivity.WEB_SESSION_IDLE_TIMEOUT_MS - 1),
  );
  await tab.advance(100);
  assert.deepEqual(tab.redirects, []);
  assert.equal(tab.storage.has(authKey), true);
  assert.equal(tab.maskStates.at(-1), false);
  tab.cleanup();
});

test("cross-tab idle logout goes home but never clears a newer session", async () => {
  const expiredTab = browser();
  expiredTab.storageEvent(
    inactivity.WEB_SESSION_LOGOUT_STORAGE_KEY,
    inactivity.createWebSessionLogoutMarker(sessionId, "idle", startedAt),
  );
  await expiredTab.advance(150);
  assert.deepEqual(expiredTab.redirects, ["/"]);
  assert.equal(expiredTab.storage.has(authKey), false);
  expiredTab.cleanup();

  const activeTab = browser();
  activeTab.storageEvent(
    inactivity.WEB_SESSION_LOGOUT_STORAGE_KEY,
    inactivity.createWebSessionLogoutMarker(sessionId, "idle", startedAt),
  );
  activeTab.replaceSession(replacementSessionId);
  await activeTab.advance(150);
  assert.deepEqual(activeTab.redirects, []);
  assert.deepEqual(activeTab.terminations, []);
  assert.equal(
    inactivity.resolveWebSessionId(JSON.parse(activeTab.storage.get(authKey)).access_token),
    replacementSessionId,
  );
  activeTab.cleanup();
});
