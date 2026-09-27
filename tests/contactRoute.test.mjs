import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const compiledModules = new Map();
const origin = "https://www.bluedeck.app";
const input = {
  name: "Jane Smith", email: "jane@example.com", topic: "general",
  message: "Please help with my account.", language: "en", captchaToken: "valid-token",
};

// Execute the actual route and all its local helpers. Only external I/O is
// replaced: Next's response constructor, Supabase RPC and network.
function harness(options = {}) {
  const env = {
    NODE_ENV: "production", VERCEL: "1", NEXT_PUBLIC_SITE_URL: origin,
    NEXT_PUBLIC_SUPABASE_URL: "https://onftggrmmpvvwgxxzywo.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-secret",
    TURNSTILE_SITE_KEY: "0xAAAAAAAAAAAAAAAAAAAAAA", TURNSTILE_SECRET_KEY: "0xBBBBBBBBBBBBBBBBBBBBBB",
    ...options.env,
  };
  const stored = [];
  const clients = [];
  const requests = [];
  const cache = new Map();
  const fetchMock = async (url, init) => {
    requests.push({ url, init });
    if (options.fetch) return options.fetch(url, init);
    return Response.json({ success: true, action: "contact", hostname: "www.bluedeck.app" });
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    if (!compiledModules.has(filename)) {
      compiledModules.set(filename, ts.transpileModule(readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
        },
      }).outputText);
    }
    const require = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/server") return { NextResponse: { json: Response.json } };
      if (specifier === "@supabase/supabase-js") return {
        createClient(url, key, configuration) {
          clients.push({ url, key, configuration });
          return {
            rpc(name, args) {
              const call = { name, args, retries: undefined, signal: undefined };
              stored.push(call);
              return {
                retry(enabled) { call.retries = enabled; return this; },
                abortSignal(signal) {
                  call.signal = signal;
                  return options.rpc
                    ? options.rpc(name, args)
                    : Promise.resolve({ data: "11111111-2222-4333-8444-555555555555", error: null });
                },
              };
            },
          };
        },
      };
      if (specifier.startsWith(".")) {
        return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      }
      return nativeRequire(specifier);
    };
    const execute = new Function(
      "require", "module", "exports", "process", "fetch",
      compiledModules.get(filename),
    );
    execute(require, loadedModule, loadedModule.exports, { env }, fetchMock);
    return loadedModule.exports;
  }
  const route = load(path.join(root, "app/api/contact/route.ts"));
  return { ...route, env, stored, clients, requests };
}

function request(value = input, options = {}) {
  const headers = new Headers({
    origin, "content-type": "application/json", "sec-fetch-site": "same-origin",
    "x-vercel-forwarded-for": "203.0.113.1",
    ...options.headers,
  });
  for (const header of options.omit || []) headers.delete(header);
  return new Request(`${origin}/api/contact`, {
    method: "POST", headers,
    body: options.raw ?? JSON.stringify(value),
    ...(options.duplex ? { duplex: "half" } : {}),
  });
}

async function expectError(response, status, code) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { ok: false, code });
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}

test("valid contact submission verifies CAPTCHA then stores only normalized message fields", async () => {
  const api = harness();
  const response = await api.POST(request({ ...input, name: " Çağrı Öztürk ", email: " jane+crew@example.com ", message: "<b>Help</b>\r\nBcc: other@example.com" }));
  assert.equal(api.runtime, "nodejs");
  assert.equal(api.maxDuration, 25);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(api.requests.length, 1);
  assert.equal(api.requests[0].url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.equal(api.requests[0].init.method, "POST");
  assert.equal(api.requests[0].init.redirect, "error");
  assert.equal(api.requests[0].init.cache, "no-store");
  assert.equal(api.requests[0].init.body.get("response"), input.captchaToken);
  assert.equal(api.requests[0].init.body.get("remoteip"), "203.0.113.1");
  assert.ok(api.requests[0].init.signal instanceof AbortSignal);
  assert.equal(api.stored.length, 1);
  assert.equal(api.stored[0].name, "submit_contact_message");
  assert.deepEqual(api.stored[0].args, {
    p_name: "Çağrı Öztürk", p_email: "jane+crew@example.com", p_topic: "general",
    p_message: "<b>Help</b>\nBcc: other@example.com", p_language: "en",
  });
  assert.equal(api.stored[0].retries, false);
  assert.ok(api.stored[0].signal instanceof AbortSignal);
  assert.deepEqual(api.clients, [{
    url: "https://onftggrmmpvvwgxxzywo.supabase.co", key: "test-service-role-secret",
    configuration: { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  }]);
});

test("cross-origin and missing-origin requests fail before parsing or external I/O", async () => {
  const api = harness();
  for (const options of [
    { headers: { origin: "https://attacker.example" } },
    { headers: { origin: "null" } },
    { headers: { "sec-fetch-site": "cross-site" } },
    { headers: { "sec-fetch-site": "same-site" } },
    { omit: ["origin"] },
  ]) {
    await expectError(await api.POST(request(input, options)), 403, "invalid_request");
  }
  assert.equal(api.requests.length, 0);
  assert.equal(api.stored.length, 0);
});

test("JSON object, content type and allow-listed fields are enforced", async () => {
  for (const [value, options, status] of [
    [input, { headers: { "content-type": "text/plain" } }, 415],
    [input, { omit: ["content-type"] }, 415],
    [input, { raw: "{" }, 400],
    [[], {}, 400],
    [null, {}, 400],
    [{ ...input, to: "other@example.com" }, {}, 400],
    [{ ...input, bcc: "other@example.com" }, {}, 400],
    [{ ...input, subject: "Spoofed" }, {}, 400],
    [{ ...input, email: "jane@example.com\r\nBcc: other@example.com" }, {}, 400],
    [{ ...input, topic: "unknown" }, {}, 400],
    [{ ...input, message: "x".repeat(2001) }, {}, 400],
  ]) {
    const api = harness();
    await expectError(await api.POST(request(value, options)), status, "invalid_request");
    assert.equal(api.requests.length, 0);
    assert.equal(api.stored.length, 0);
  }
});

test("16 KiB body boundary is enforced by actual streamed bytes, not declared size", async () => {
  const encoded = JSON.stringify(input);
  for (const [bytes, declared, status] of [
    [16 * 1024, "16384", 200],
    [16 * 1024 + 1, "10", 413],
    [16 * 1024 + 1, undefined, 413],
    [encoded.length, "16385", 413],
  ]) {
    const api = harness();
    const raw = encoded + " ".repeat(bytes - encoded.length);
    const headers = declared ? { "content-length": declared } : {};
    const response = await api.POST(request(input, { raw, headers }));
    assert.equal(response.status, status);
    assert.equal(api.stored.length, status === 200 ? 1 : 0);
  }
  const api = harness();
  const raw = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode(encoded));
    controller.enqueue(new Uint8Array(16 * 1024).fill(32));
    controller.close();
  } });
  await expectError(await api.POST(request(input, { raw, duplex: true })), 413, "invalid_request");
  assert.equal(api.requests.length, 0);
});

test("missing database or Turnstile config fails closed without claiming success", async () => {
  for (const env of [
    { NEXT_PUBLIC_SUPABASE_URL: "" }, { SUPABASE_SERVICE_ROLE_KEY: "" },
    { TURNSTILE_SITE_KEY: "" }, { TURNSTILE_SECRET_KEY: "" },
    { TURNSTILE_SECRET_KEY: "placeholder-secret-key-not-real" },
  ]) {
    const api = harness({ env });
    await expectError(await api.POST(request()), 503, "service_unavailable");
    assert.equal(api.requests.length, 0);
    assert.equal(api.stored.length, 0);
  }
});

test("missing, oversized or malformed CAPTCHA values are rejected before Siteverify", async () => {
  for (const captchaToken of [undefined, null, 42, {}, "", " ", "token\n", "x".repeat(2049)]) {
    const api = harness();
    await expectError(await api.POST(request({ ...input, captchaToken })), 400, "captcha_failed");
    assert.equal(api.requests.length, 0);
    assert.equal(api.stored.length, 0);
  }
  const api = harness();
  assert.equal((await api.POST(request({ ...input, captchaToken: "x".repeat(2048) }))).status, 200);
});

test("CAPTCHA action, hostname and strict boolean success must all match", async () => {
  for (const verification of [
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { success: "true", action: "contact", hostname: "www.bluedeck.app" },
    { success: true, action: "login", hostname: "www.bluedeck.app" },
    { success: true, action: "contact", hostname: "attacker.example" },
    { success: true, action: "contact" },
    { success: true, hostname: "www.bluedeck.app" },
  ]) {
    const api = harness({ fetch: async () => Response.json(verification) });
    await expectError(await api.POST(request()), 400, "captcha_failed");
    assert.equal(api.stored.length, 0);
  }
});

test("CAPTCHA network failures and malformed responses fail closed", async () => {
  for (const fetch of [
    async () => { throw new Error("network secret-details"); },
    async () => new Response("unavailable", { status: 503 }),
    async () => new Response("{bad-json"),
    async () => Response.json(null),
    async () => Response.json([]),
  ]) {
    const api = harness({ fetch });
    await expectError(await api.POST(request()), 503, "service_unavailable");
    assert.equal(api.stored.length, 0);
  }
});

test("replaying a single-use CAPTCHA never causes a second stored message", async () => {
  const seen = new Set();
  const api = harness({ fetch: async (_url, init) => {
    const token = init.body.get("response");
    if (seen.has(token)) return Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] });
    seen.add(token);
    return Response.json({ success: true, action: "contact", hostname: "www.bluedeck.app" });
  } });
  assert.equal((await api.POST(request())).status, 200);
  await expectError(await api.POST(request()), 400, "captcha_failed");
  assert.equal(api.stored.length, 1);
  assert.equal(api.requests.length, 2);
});

test("database errors, network failures and missing confirmation never claim success or expose private data", async () => {
  for (const rpc of [
    async () => { throw new Error("service-role-secret; Jane Smith jane@example.com"); },
    async () => ({ data: null, error: { code: "42P01", message: "internal schema details" } }),
    async () => ({ data: null, error: null }),
    async () => ({ data: {}, error: null }),
    async () => ({ data: "not-a-uuid", error: null }),
    async () => ({ data: null, error: { code: "P0001", message: "unrelated database failure" } }),
  ]) {
    const api = harness({ rpc });
    await expectError(await api.POST(request()), 503, "service_unavailable");
    assert.equal(api.stored.length, 1);
    assert.equal(api.stored[0].retries, false);
  }
});

test("durable database sender and global limits are returned as safe rate-limit responses", async () => {
  for (const [message, retryAfter] of [["contact_email_rate_limit", "3600"], ["contact_global_rate_limit", "86400"]]) {
    const api = harness({ rpc: async () => ({ data: null, error: { code: "P0001", message } }) });
    const response = await api.POST(request());
    await expectError(response, 429, "rate_limited");
    assert.equal(response.headers.get("retry-after"), retryAfter);
    assert.equal(api.stored.length, 1);
  }
});

test("IP attempts include failed requests, stop at the fifth attempt and include Retry-After", async () => {
  const api = harness({ fetch: async () => Response.json({ success: false }) });
  for (let attempt = 0; attempt < 5; attempt++) {
    await expectError(await api.POST(request()), 400, "captcha_failed");
  }
  const blocked = await api.POST(request());
  await expectError(blocked, 429, "rate_limited");
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.ok(Number(blocked.headers.get("retry-after")) <= 900);
  assert.equal(api.requests.length, 5);
  assert.equal(api.stored.length, 0);
});

test("untrusted forwarding headers cannot bypass an unknown-runtime IP bucket", async () => {
  const api = harness({ env: { VERCEL: undefined }, fetch: async () => Response.json({ success: false }) });
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await api.POST(request(input, {
      headers: { "x-forwarded-for": `203.0.113.${attempt + 1}`, "x-real-ip": `203.0.113.${attempt + 1}` },
    }));
    assert.equal(response.status, attempt < 5 ? 400 : 429);
  }
  assert.ok(api.requests.every(({ init }) => !init.body.has("remoteip")));
  assert.equal(api.stored.length, 0);
});
