import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { isExpiredAuthSession } from "../app/lib/authSessionErrors.ts";

const root = new URL("../", import.meta.url);
const user = { id: "11111111-1111-4111-8111-111111111111", email: "crew@example.com", user_metadata: { full_name: "New Crew" }, app_metadata: {} };
const capabilities = { role: "crew", position: "", canUseCrewWorkspace: true, canManageYachts: false, canPostJobs: false, canApplyToJobs: true };

// Execute the actual page load/event functions. Their browser, network and
// state boundaries are injected so failed requests cannot be mistaken for
// successful empty records or a reduced account role.
function pageFunction(file, name, context) {
  const source = ts.createSourceFile(file, readFileSync(new URL(file, root), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    else ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(declaration, `${name} exists`);
  const code = ts.transpileModule(declaration.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(context), `${code}\nreturn ${name};`)(...Object.values(context));
}

function harness(options = {}) {
  const state = {};
  const queries = [];
  const redirects = [];
  let accessReady = false;
  const supabase = {
    auth: {
      getUser: async () => options.authResult || ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: { access_token: "test-session" } } }),
      updateUser: async () => ({ error: null }),
    },
    from(table) {
      const entry = { table, accessReady, mutation: false };
      queries.push(entry);
      return {
        select() { return this; }, eq() { return this; },
        insert() { entry.mutation = true; return this; },
        async maybeSingle() {
          if (options.query) return options.query(table, false);
          return { data: table === "profiles" ? { id: user.id, role: "crew", full_name: "New Crew" } : { id: "crew-profile", user_id: user.id, full_name: "New Crew" }, error: null };
        },
        async single() { return options.query?.(table, true) || { data: { id: "created-profile" }, error: null }; },
      };
    },
  };
  const context = {
    supabase,
    isExpiredAuthSession,
    async loadAccountCapabilities() {
      const result = options.capabilities ? await options.capabilities() : capabilities;
      accessReady = Boolean(result);
      return result;
    },
    window: { location: { hash: "", replace: (path) => redirects.push(path), set href(path) { redirects.push(path); } } },
    process: { env: {} },
    fetch: async () => Response.json({ ok: true }),
    cleanDisplayName: (profile) => profile?.full_name || "",
    dashboardPhotoFromMetadata: () => "",
    signCrewPortfolioReferences: async () => ["", ""],
    signCrewPortfolioReference: async () => "",
    normalizeCrewPortfolioStoragePath: () => null,
    resolveSupabaseUrl: () => "https://test.supabase.co",
    hydrateDeckAccess: async () => {},
    normalizeProfile: (profile) => profile,
    loadRelated: async () => {},
    writeCrewDiscoverySettings: () => "",
    defaultCrewDiscoverySettings: {},
    profile: { id: user.id },
    persistDashboardPhoto: async () => { throw new Error("new row violates row-level security policy"); },
    copy: { photoUpdateFailed: "Your photo could not be updated.", photoStorageUnavailable: "Photo storage is unavailable.", photoInvalidFile: "Choose a valid photo under 10 MB." },
  };
  for (const [setter, key] of Object.entries({
    setLoading: "loading", setLoadFailed: "loadFailed", setProfile: "profile", setSavedProfile: "savedProfile",
    setAccountCapabilities: "capabilities", setDeckInvites: "invites", setMyDecks: "decks", setPhotoUploading: "uploading", setPhotoError: "photoError",
  })) context[setter] = (value) => { state[key] = typeof value === "function" ? value(state[key]) : value; };
  return { state, queries, redirects, context };
}

test("dashboard retries unavailable account access and restores the complete crew workspace", async () => {
  let available = false;
  const fixture = harness({ capabilities: async () => available ? capabilities : null });
  const load = pageFunction("app/dashboard/page.tsx", "loadDashboard", fixture.context);
  await load();
  assert.equal(fixture.state.loadFailed, true);
  assert.equal(fixture.state.loading, false);
  assert.equal(fixture.state.profile, undefined);
  assert.equal(fixture.queries.length, 0);

  available = true;
  await load();
  assert.equal(fixture.state.loadFailed, false);
  assert.equal(fixture.state.loading, false);
  assert.equal(fixture.state.profile.id, user.id);
  assert.equal(fixture.state.capabilities.canUseCrewWorkspace, true);
  assert.ok(fixture.queries.every((query) => query.accessReady));
  assert.ok(fixture.queries.every((query) => !query.mutation));
});

test("dashboard read errors are retryable and never trigger client account creation", async () => {
  for (const table of ["profiles", "crew_profiles"]) {
    const fixture = harness({ query: async (name) => name === table
      ? { data: null, error: { message: "network unavailable" } }
      : { data: { id: user.id }, error: null } });
    await pageFunction("app/dashboard/page.tsx", "loadDashboard", fixture.context)();
    assert.equal(fixture.state.loadFailed, true);
    assert.equal(fixture.state.loading, false);
    assert.ok(fixture.queries.every((query) => !query.mutation));
  }
});

test("dashboard rejected upload leaves controls usable and does not expose raw database errors", async () => {
  const fixture = harness();
  await pageFunction("app/dashboard/page.tsx", "saveDashboardPhoto", fixture.context)({ name: "photo.png" });
  assert.equal(fixture.state.uploading, false);
  assert.equal(fixture.state.photoError, fixture.context.copy.photoUpdateFailed);
  assert.doesNotMatch(fixture.state.photoError, /row-level|security policy/);
});

test("profile account lookup failure stays retryable instead of redirecting away", async () => {
  const fixture = harness({ capabilities: async () => null });
  await pageFunction("app/profile/page.tsx", "loadProfile", fixture.context)();
  assert.equal(fixture.state.loadFailed, true);
  assert.equal(fixture.state.loading, false);
  assert.deepEqual(fixture.redirects, []);
  assert.equal(fixture.queries.length, 0);
});

test("a missing or unreadable profile cannot create a duplicate or expose a phantom editor", async () => {
  for (const missingProfile of [false, true]) {
    const fixture = harness({ query: async (_table, mutation) => ({
      data: null,
      error: missingProfile && !mutation ? null : { message: "new row violates row-level security policy" },
    }) });
    await pageFunction("app/profile/page.tsx", "loadProfile", fixture.context)();
    assert.equal(fixture.state.loadFailed, true);
    assert.equal(fixture.state.loading, false);
    assert.equal(fixture.state.profile, undefined);
    assert.equal(fixture.state.savedProfile, undefined);
    assert.equal(fixture.queries.some((query) => query.mutation), false);
  }
});

test("expired sessions return to login while auth network failures remain retryable", async () => {
  for (const [file, name] of [["app/dashboard/page.tsx", "loadDashboard"], ["app/profile/page.tsx", "loadProfile"]]) {
    for (const error of [
      { name: "AuthSessionMissingError", status: 400 },
      { name: "AuthApiError", status: 401 },
      { name: "AuthApiError", status: 400, code: "session_expired" },
    ]) {
      const fixture = harness({ authResult: { data: { user: null }, error } });
      await pageFunction(file, name, fixture.context)();
      assert.match(fixture.redirects[0], /^\/login/);
      assert.equal(fixture.state.loading, true);
      assert.equal(fixture.state.loadFailed, false);
      assert.equal(fixture.queries.length, 0);
    }
    const fixture = harness({ authResult: { data: { user: null }, error: { name: "AuthRetryableFetchError", status: 503 } } });
    await pageFunction(file, name, fixture.context)();
    assert.equal(fixture.redirects.length, 0);
    assert.equal(fixture.state.loading, false);
    assert.equal(fixture.state.loadFailed, true);
  }
});
