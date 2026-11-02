import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const compiled = new Map();
const origin = "https://www.bluedeck.app";

// Run the actual login and account-authentication modules against controlled
// Supabase responses. Origin, body, CAPTCHA and rate-limit guards remain real.
function harness(options = {}) {
  const events = [];
  const cache = new Map();
  const user = { id: "11111111-1111-4111-8111-111111111111" };
  const authClient = { auth: {
    async signInWithPassword(credentials) {
      events.push("password");
      assert.equal(credentials.options.captchaToken, "test-captcha");
      return { data: { user, session: options.invalid ? null : { access_token: "access", refresh_token: "refresh" } },
        error: options.invalid ? { code: "invalid_credentials" } : null };
    },
    async getUser() { events.push("user"); return { data: { user }, error: null }; },
    async getClaims() { events.push("claims"); return { data: { claims: {
      sub: user.id, session_id: "22222222-2222-4222-8222-222222222222", amr: [{ method: "password" }],
    } }, error: null }; },
  } };
  const serviceClient = { async rpc(name) {
    events.push(name);
    if (name === "bluedeck_account_is_ready") return { data: options.ready !== false, error: null };
    if (name === "bluedeck_recover_signup_account") return { data: options.recover !== false,
      error: options.recoveryError ? { code: "PGRST002" } : null };
    assert.equal(name, "bluedeck_bearer_session_is_live");
    return { data: options.live !== false, error: null };
  } };
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
    new Function("require", "module", "exports", "process", "console", compiled.get(file.href))(
      requireLocal, loaded, loaded.exports, { env }, { error() {} },
    );
    return loaded.exports;
  }
  return { ...load(new URL("../app/api/auth/login/route.ts", import.meta.url)), events };
}

function loginRequest() {
  return new Request(`${origin}/api/auth/login`, {
    method: "POST", headers: { origin, "sec-fetch-site": "same-origin",
      "content-type": "application/json", "x-vercel-forwarded-for": "203.0.113.1" },
    body: JSON.stringify({ email: "crew@example.invalid", password: "test-password", captchaToken: "test-captcha" }),
  });
}

test("password login completes interrupted setup before returning browser tokens", async () => {
  const api = harness({ ready: false });
  const response = await api.POST(loginRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, accessToken: "access", refreshToken: "refresh" });
  assert.deepEqual(api.events, ["password", "user", "claims", "bluedeck_account_is_ready",
    "bluedeck_recover_signup_account", "bluedeck_bearer_session_is_live"]);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
});

test("login never returns tokens for failed setup or revoked sessions", async () => {
  for (const options of [{ ready: false, recover: false }, { ready: false, recoveryError: true }, { live: false }]) {
    const api = harness(options);
    const response = await api.POST(loginRequest());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: "Login failed.", code: "service_unavailable" });
  }
});

test("invalid credentials never reach privileged account provisioning", async () => {
  const api = harness({ invalid: true });
  const response = await api.POST(loginRequest());
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "invalid_credentials");
  assert.deepEqual(api.events, ["password"]);
});
