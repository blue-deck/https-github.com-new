import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { currentLegalAcceptance } from "../app/lib/legalPolicies.ts";

const nativeRequire = createRequire(import.meta.url);
const compiled = new Map();
const origin = "https://www.bluedeck.app";
const intentId = "33333333-3333-4333-8333-333333333333";
const userId = "11111111-1111-4111-8111-111111111111";
const input = {
  email: " New.Crew@Example.Invalid ", password: "Test-Password123!", fullName: " New Crew ",
  role: "crew", position: "Deckhand", captchaToken: "test-captcha", legalAcceptance: currentLegalAcceptance(),
};

// Exercise the actual route and validation helpers. Supabase transport and
// the minimum public-response delay are the only external boundaries replaced.
function harness(options = {}) {
  const events = [];
  const cache = new Map();
  const authClient = { auth: { async signUp(credentials) {
    events.push({ name: "signUp", credentials });
    if (options.terminated) throw new Error("Simulated request termination after Auth commit");
    return { data: { user: options.duplicate ? { id: "obfuscated", identities: [] } : { id: userId, identities: [{}] } },
      error: options.authError ?? null };
  } } };
  let provisioningAttempts = 0;
  const serviceClient = {
    async rpc(name, parameters) {
      events.push({ name, parameters });
      if (name === "bluedeck_prepare_signup_account") {
        if (options.prepareThrows) throw new Error("Database unavailable");
        return options.preparation ?? { data: intentId, error: null };
      }
      assert.equal(name, "bluedeck_provision_signup_account");
      provisioningAttempts += 1;
      if (options.lostResponse && provisioningAttempts === 1) return { data: null, error: { code: "", message: "Network interrupted" } };
      return { data: true, error: null };
    },
    get auth() { throw new Error("Auth account deletion is forbidden"); },
  };
  const env = {
    NODE_ENV: "production", VERCEL: "1", NEXT_PUBLIC_SITE_URL: origin,
    NEXT_PUBLIC_SUPABASE_URL: "https://onftggrmmpvvwgxxzywo.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service",
    TURNSTILE_SITE_KEY: "0xAAAAAAAAAAAAAAAAAAAAAA", TURNSTILE_SECRET_KEY: "0xBBBBBBBBBBBBBBBBBBBBBB",
  };
  function load(file) {
    if (cache.has(file.href)) return cache.get(file.href).exports;
    const loaded = { exports: {} };
    cache.set(file.href, loaded);
    if (!compiled.has(file.href)) compiled.set(file.href, ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    const requireLocal = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/server") return { NextResponse: { json: Response.json } };
      if (specifier === "@supabase/supabase-js") return { createClient(_url, key) {
        return key === "service" ? serviceClient : authClient;
      } };
      if (specifier.startsWith(".")) return load(new URL(`${specifier}.ts`, file));
      return nativeRequire(specifier);
    };
    new Function("require", "module", "exports", "process", "console", "setTimeout", compiled.get(file.href))(
      requireLocal, loaded, loaded.exports, { env }, { error() {} }, (callback) => { callback(); return 0; },
    );
    return loaded.exports;
  }
  return { ...load(new URL("../app/api/auth/signup/route.ts", import.meta.url)), events };
}

function request(value = input, originHeader = origin) {
  return new Request(`${origin}/api/auth/signup`, {
    method: "POST", headers: { origin: originHeader, "sec-fetch-site": "same-origin",
      "content-type": "application/json", "x-vercel-forwarded-for": "203.0.113.1" },
    body: JSON.stringify(value),
  });
}

test("all signup roles are stored by the service before Auth receives only their nonce", async () => {
  for (const [role, position] of [["crew", "Deckhand"], ["captain", "Captain"], ["owner", "Owner"], ["management", "Yacht Manager"]]) {
    const api = harness();
    const response = await api.POST(request({ ...input, role, position }));
    assert.equal(response.status, 200);
    assert.deepEqual(api.events.map(({ name }) => name), ["bluedeck_prepare_signup_account", "signUp", "bluedeck_provision_signup_account"]);
    assert.deepEqual(api.events[0].parameters, {
      p_email: "new.crew@example.invalid", p_full_name: "New Crew", p_account_role: role, p_position: position,
    });
    const auth = api.events[1].credentials;
    assert.equal(auth.options.data.bluedeck_signup_intent, intentId);
    assert.equal(auth.options.captchaToken, input.captchaToken);
    assert.deepEqual(auth.options.data.bluedeck_legal_acceptance, currentLegalAcceptance());
    const body = await response.json();
    assert.equal(body.userId, null);
    assert.equal(body.needsEmailConfirmation, true);
    assert.equal(JSON.stringify(body).includes(intentId), false);
  }
});

test("invalid requests fail before preparing any privileged signup intent", async () => {
  for (const value of [
    { ...input, role: "admin" }, { ...input, position: "Unknown Position" },
    { ...input, captchaToken: "" }, { ...input, legalAcceptance: null },
    { ...input, password: "weak" }, { ...input, bluedeck_signup_intent: intentId },
  ]) {
    const api = harness();
    assert.equal((await api.POST(request(value))).status, 400);
    assert.deepEqual(api.events, []);
  }
  const api = harness();
  assert.equal((await api.POST(request(input, "https://attacker.invalid"))).status, 403);
  assert.deepEqual(api.events, []);
});

test("unavailable or malformed preparation never creates a partial Auth account", async () => {
  for (const options of [
    { preparation: { data: null, error: { code: "PGRST002" } } },
    { preparation: { data: null, error: null } },
    { preparation: { data: "not-a-uuid", error: null } },
    { prepareThrows: true },
  ]) {
    const api = harness(options);
    const response = await api.POST(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "service_unavailable");
    assert.deepEqual(api.events.map(({ name }) => name), ["bluedeck_prepare_signup_account"]);
  }
});

test("terminating the route after Auth commit leaves the stored role reference with Auth", async () => {
  const api = harness({ terminated: true });
  await assert.rejects(api.POST(request({ ...input, role: "captain", position: "Captain" })), /request termination/);
  assert.equal(api.events[0].parameters.p_account_role, "captain");
  assert.equal(api.events[1].credentials.options.data.bluedeck_signup_intent, intentId);
  assert.equal(api.events.length, 2);
});

test("CAPTCHA rejection is still enforced by Auth and never finalizes provisioning", async () => {
  const api = harness({ authError: { code: "captcha_failed", status: 400 } });
  const response = await api.POST(request());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "captcha_failed");
  assert.deepEqual(api.events.map(({ name }) => name), ["bluedeck_prepare_signup_account", "signUp"]);
});

test("duplicate signups remain indistinguishable and do not mutate existing accounts", async () => {
  const api = harness({ duplicate: true });
  const response = await api.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { userId: null, emailConfirmed: false, needsEmailConfirmation: true });
  assert.deepEqual(api.events.map(({ name }) => name), ["bluedeck_prepare_signup_account", "signUp"]);
});

test("a lost finalize response retries without deleting the atomically prepared account", async () => {
  const api = harness({ lostResponse: true });
  assert.equal((await api.POST(request())).status, 200);
  assert.deepEqual(api.events.map(({ name }) => name), ["bluedeck_prepare_signup_account", "signUp",
    "bluedeck_provision_signup_account", "bluedeck_provision_signup_account"]);
});
