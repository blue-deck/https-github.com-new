import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Exercise the real authentication boundary; only Next's build marker is omitted.
const modules = new Map();
function loadModule(file) {
  if (modules.has(file.href)) return modules.get(file.href).exports;
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  modules.set(file.href, loaded);
  const requireLocal = (specifier) => {
    if (specifier === "server-only") return {};
    assert.ok(specifier.startsWith("."));
    return loadModule(new URL(`${specifier}.ts`, file));
  };
  new Function("require", "module", "exports", compiled)(requireLocal, loaded, loaded.exports);
  return loaded.exports;
}

const { authenticateActiveBearer } = loadModule(
  new URL("../app/lib/activeBearerServer.ts", import.meta.url),
);
const { completeSignupProvisioning } = loadModule(
  new URL("../app/lib/signupProvisioningServer.ts", import.meta.url),
);

function clients({
  readiness = { data: true, error: null },
  recovery = { data: false, error: null },
  live = true,
  amr = [{ method: "password", timestamp: 1 }],
  userId = "11111111-1111-4111-8111-111111111111",
} = {}) {
  const calls = [];
  const user = { id: userId };
  return {
    calls,
    input: {
      token: "test-token",
      authClient: {
        auth: {
          getUser: async () => ({ data: { user }, error: null }),
          getClaims: async () => ({
            data: { claims: {
              sub: userId,
              session_id: "22222222-2222-4222-8222-222222222222",
              amr,
            } },
            error: null,
          }),
        },
      },
      serviceClient: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          if (name === "bluedeck_account_is_ready") return readiness;
          if (name === "bluedeck_recover_signup_account") return recovery;
          return { data: live, error: null };
        },
      },
    },
  };
}

test("confirmed ready accounts require a live session and support UUID v7", async () => {
  const { input, calls } = clients({ userId: "019a3f73-1234-7123-8123-123456789abc" });
  const result = await authenticateActiveBearer(input);
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map(({ name }) => name), [
    "bluedeck_account_is_ready",
    "bluedeck_bearer_session_is_live",
  ]);
});

test("a database outage is retryable rather than blaming account setup", async () => {
  const cause = { code: "PGRST002", message: "Database connection unavailable" };
  const { input, calls } = clients({ readiness: { data: null, error: cause } });
  const result = await authenticateActiveBearer(input);
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.reason, "session_check_unavailable");
  assert.equal(result.cause, cause);
  assert.equal(calls.length, 1);
});

test("an incomplete account remains blocked when safe recovery is not possible", async () => {
  const { input, calls } = clients({ readiness: { data: false, error: null } });
  const result = await authenticateActiveBearer(input);
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.reason, "account_not_ready");
  assert.equal(calls.length, 2);
});

test("a pending signup is recovered for the verified user and session before access", async () => {
  const { input, calls } = clients({
    readiness: { data: false, error: null },
    recovery: { data: true, error: null },
  });
  const result = await authenticateActiveBearer(input);
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map(({ name }) => name), [
    "bluedeck_account_is_ready", "bluedeck_recover_signup_account", "bluedeck_bearer_session_is_live",
  ]);
  assert.deepEqual(calls[1].args, {
    p_user_id: "11111111-1111-4111-8111-111111111111",
    p_session_id: "22222222-2222-4222-8222-222222222222",
  });
});

test("signup or recovery proof sessions never invoke account recovery", async () => {
  for (const amr of [[{ method: "recovery" }], [{ method: "email/signup" }], []]) {
    const { input, calls } = clients({ amr, readiness: { data: false, error: null } });
    const result = await authenticateActiveBearer(input);
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.equal(calls.length, 0);
  }
});

test("successful recovery still requires a live session", async () => {
  const { input } = clients({
    readiness: { data: false, error: null },
    recovery: { data: true, error: null },
    live: false,
  });
  const result = await authenticateActiveBearer(input);
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("recovery failures remain retryable without granting access", async () => {
  for (const recovery of [{ data: null, error: { code: "PGRST002" } }, { data: null, error: null }]) {
    const { input, calls } = clients({ readiness: { data: false, error: null }, recovery });
    const result = await authenticateActiveBearer(input);
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(calls.length, 2);
  }
});

const signupIdentity = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "crew@example.invalid", fullName: "Test Crew", role: "crew", position: "Deckhand",
};

test("lost provisioning response retries safely without deleting the committed Auth account", async () => {
  const calls = [];
  const serviceClient = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return calls.length === 1
        ? { data: null, error: { code: "", message: "Connection closed after commit" } }
        : { data: true, error: null };
    },
    get auth() { throw new Error("Auth account deletion is forbidden"); },
  };
  const result = await completeSignupProvisioning(serviceClient, signupIdentity);
  assert.equal(result.ready, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
});

test("persistent provisioning failure leaves an account available for verified recovery", async () => {
  let calls = 0;
  const result = await completeSignupProvisioning({
    rpc: async () => { calls += 1; throw new Error("Network unavailable"); },
    get auth() { throw new Error("Auth account deletion is forbidden"); },
  }, signupIdentity);
  assert.equal(result.ready, false);
  assert.equal(calls, 2);
});

test("explicit provisioning rejection does not retry or delete an existing account", async () => {
  let calls = 0;
  const result = await completeSignupProvisioning({
    rpc: async () => { calls += 1; return { data: false, error: null }; },
    get auth() { throw new Error("Auth account deletion is forbidden"); },
  }, signupIdentity);
  assert.equal(result.ready, false);
  assert.equal(calls, 1);
});

test("malformed readiness RPC results fail closed as service errors", async () => {
  for (const data of [null, undefined, "true", {}, []]) {
    const { input } = clients({ readiness: { data, error: null } });
    const result = await authenticateActiveBearer(input);
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.reason, "session_check_unavailable");
  }
});
