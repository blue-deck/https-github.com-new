import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { isMarketplaceAccountRole, marketplaceCapabilitiesForRole } from "../app/lib/marketplaceCapabilities.ts";

const compiled = ts.transpileModule(readFileSync(
  new URL("../app/api/account/capabilities/route.ts", import.meta.url), "utf8",
), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(options = {}) {
  const writes = [];
  const logs = [];
  const client = {
    from(table) {
      assert.equal(table, "crew_profiles");
      return { select() { return this; }, eq() { return this; }, maybeSingle: async () => options.crewRead || {
        data: { id: "saved-profile", current_position: null, current_positions: [] }, error: null,
      } };
    },
    rpc: async () => ({ data: false, error: null }),
  };
  const dependencies = {
    "next/server": { NextResponse: { json: Response.json } },
    "../../../lib/employerAccessServer": {
      authenticatedEmployerClients: async () => ({ user: {
        id: "11111111-1111-4111-8111-111111111111", email: "crew@example.invalid",
        app_metadata: options.appMetadata ?? { bluedeck_signup_position: "Deckhand" }, user_metadata: { full_name: "Test Crew" },
      }, serviceClient: client }),
      cleanText: (value) => typeof value === "string" ? value.trim() : "",
    },
    "../../../lib/baseProfiles": { saveBaseProfileById: async () => options.baseResult || { data: [{ id: "base" }], error: null } },
    "../../../lib/crewProfiles": { saveCrewProfileByUserId: async (_client, _userId, payload) => {
      writes.push(payload);
      return options.crewWrite || { data: { id: "saved-profile" }, error: null };
    } },
    "../../../lib/marketplaceCapabilities": { isMarketplaceAccountRole, marketplaceCapabilitiesForRole },
    "../../../lib/marketplaceEntitlementsServer": { loadOrEnsureMarketplaceEntitlement: async () => ({
      ok: true, entitlement: { ...marketplaceCapabilitiesForRole("crew"), postingStatus: "enabled" },
    }) },
    "../../../lib/yachtOperations": {
      yachtPositionTitles: ["Deckhand"], getDefaultPositionForAccountType: () => "",
    },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "console", compiled)(
    (specifier) => { assert.ok(specifier in dependencies, specifier); return dependencies[specifier]; },
    loaded, loaded.exports, { error: (...args) => logs.push(args) },
  );
  return { ...loaded.exports, writes, logs };
}

test("default signup position repair preserves the database-owned public crew ID", async () => {
  const api = harness();
  const response = await api.GET(new Request("https://www.bluedeck.app/api/account/capabilities"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).canUseCrewWorkspace, true);
  assert.equal(api.writes.length, 1);
  assert.equal(api.writes[0].current_position, "Deckhand");
  assert.equal(Object.hasOwn(api.writes[0], "public_crew_id"), false);
});

test("missing crew profiles are created with a database-generated public identifier", async () => {
  const api = harness({ crewRead: { data: null, error: null } });
  const response = await api.GET(new Request("https://www.bluedeck.app/api/account/capabilities"));
  assert.equal(response.status, 200);
  assert.equal(api.writes.length, 1);
  assert.equal(Object.hasOwn(api.writes[0], "public_crew_id"), false);
});

test("legacy Crew accounts without a saved or trusted position still receive a real profile", async () => {
  const api = harness({ appMetadata: {}, crewRead: { data: null, error: null } });
  const response = await api.GET(new Request("https://www.bluedeck.app/api/account/capabilities"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.canUseCrewWorkspace, true);
  assert.equal(body.position, "");
  assert.equal(api.writes.length, 1);
  assert.deepEqual(api.writes[0].current_positions, []);
  assert.equal(Object.hasOwn(api.writes[0], "current_position"), false);
  assert.equal(Object.hasOwn(api.writes[0], "public_crew_id"), false);
});

test("existing Crew profiles with no position are preserved when no trusted position exists", async () => {
  const api = harness({ appMetadata: {} });
  const response = await api.GET(new Request("https://www.bluedeck.app/api/account/capabilities"));
  assert.equal(response.status, 200);
  assert.deepEqual(api.writes, []);
});

test("profile read/write failures never report a ready dashboard", async () => {
  for (const options of [
    { baseResult: { data: null, error: { code: "23514", message: "Unavailable" } } },
    { baseResult: { data: [], error: null } },
    { crewRead: { data: null, error: { code: "PGRST002", message: "Unavailable" } } },
    { crewWrite: { data: null, error: { code: "42501", message: "Unavailable" } } },
    { crewWrite: { data: null, error: null } },
  ]) {
    const api = harness(options);
    const response = await api.GET(new Request("https://www.bluedeck.app/api/account/capabilities"));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).ok, false);
    assert.match(response.headers.get("cache-control"), /private.*no-store/);
    assert.equal(api.logs.length, 1);
  }
});

test("saved career positions are retained without a profile rewrite", async () => {
  const api = harness({ crewRead: { data: { id: "saved-profile", current_position: "Chief Stewardess", current_positions: ["Chief Stewardess"] }, error: null } });
  const response = await api.GET(new Request("https://www.bluedeck.app/api/account/capabilities"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).position, "Chief Stewardess");
  assert.deepEqual(api.writes, []);
});
