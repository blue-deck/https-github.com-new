import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const compiled = new Map();
const origin = "https://www.bluedeck.app";
const ownerId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-09-27T11:00:00.123456+00:00";
const messageRow = (number, status = "unread") => ({
  id: `33333333-3333-4333-8333-${String(number).padStart(12, "0")}`,
  created_at: timestamp, updated_at: timestamp, name: "Test sender",
  email: "sender@example.com", topic: "general", message: "Private message",
  language: "en", status,
});

// Exercise the actual route, owner restriction, active-session validation, and
// current admin metadata lookup. Only external Supabase/Next I/O is replaced.
function harness(options = {}) {
  const rows = (options.rows ?? [messageRow(1)]).map((row) => ({ ...row }));
  const queries = [];
  const authCalls = [];
  const user = { id: ownerId, email: "uymaxsinan@gmail.com", app_metadata: { bluedeck_admin: true } };
  const authClient = { auth: {
    async getUser() {
      authCalls.push("getUser");
      if (options.authNeverResolves) return new Promise(() => {});
      return { data: { user }, error: options.invalidToken ? { message: "invalid" } : null };
    },
    async getClaims() {
      authCalls.push("getClaims");
      return { data: { claims: { sub: ownerId, session_id: sessionId,
        amr: [{ method: options.recoveryToken ? "recovery" : "password" }] } }, error: null };
    },
  } };
  const serviceClient = {
    auth: { admin: { async getUserById() {
      authCalls.push("getUserById");
      return { data: { user: {
        ...user, email: options.email ?? user.email,
        app_metadata: { bluedeck_admin: options.admin !== false },
      } }, error: options.adminError ? { message: "private provider details" } : null };
    } } },
    async rpc(name) {
      authCalls.push(name);
      if (name === "bluedeck_account_is_ready") return { data: options.provisioned !== false, error: null };
      if (name === "bluedeck_bearer_session_is_live") {
        return { data: options.liveSession !== false, error: options.sessionError ? { message: "private" } : null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
    from(table) {
      assert.equal(table, "contact_messages");
      const state = { table, filters: [], orders: [], limit: Infinity, head: false, update: null, cursor: null };
      queries.push(state);
      const builder = {
        select(columns, settings = {}) { state.columns = columns; state.head = Boolean(settings.head); return builder; },
        order(column, settings) { state.orders.push([column, settings]); return builder; },
        limit(value) { state.limit = value; return builder; },
        eq(column, value) { state.filters.push([column, value]); return builder; },
        update(value) { state.update = value; return builder; },
        abortSignal(value) { state.signal = value; return builder; },
        retry(value) { state.retry = value; return builder; },
        or(value) { state.cursor = value; return builder; },
        maybeSingle() { return Promise.resolve(execute(true)); },
        then(resolve, reject) { return Promise.resolve().then(() => execute(false)).then(resolve, reject); },
      };
      function execute(single) {
        if (options.databaseError || (state.head && options.countError)) {
          return { data: null, count: null, error: { message: "Private SQL details" } };
        }
        let selected = rows.filter((row) => state.filters.every(([key, value]) => row[key] === value));
        if (state.cursor) {
          const match = state.cursor.match(/^created_at\.lt\.(.+),and\(created_at\.eq\.(.+),id\.lt\.([0-9a-f-]+)\)$/);
          assert.ok(match, "pagination expression uses only validated timestamp and UUID");
          assert.equal(match[1], match[2]);
          selected = selected.filter((row) => row.created_at < match[1] || (row.created_at === match[1] && row.id < match[3]));
        }
        if (state.head) return { data: null, count: selected.length, error: null };
        selected.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
        selected = selected.slice(0, state.limit);
        if (state.update && selected[0]) {
          assert.deepEqual(Object.keys(state.update), ["status"]);
          selected[0].status = state.update.status;
          selected[0].updated_at = "2026-09-27T11:01:00.654321+00:00";
        }
        return { data: single ? selected[0] ? { ...selected[0] } : null : selected.map((row) => ({ ...row })), error: null };
      }
      return builder;
    },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    if (!compiled.has(filename)) compiled.set(filename, ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText);
    const require = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/server") return { NextResponse: { json: Response.json } };
      if (specifier === "@supabase/supabase-js") return {
        createClient(_url, key) { return key === "test-service-role" ? serviceClient : authClient; },
      };
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      return nativeRequire(specifier);
    };
    new Function("require", "module", "exports", "process", "console", "setTimeout", "clearTimeout", compiled.get(filename))(
      require, loadedModule, loadedModule.exports,
      { env: { NEXT_PUBLIC_SITE_URL: origin, NEXT_PUBLIC_SUPABASE_URL: "https://onftggrmmpvvwgxxzywo.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon", SUPABASE_SERVICE_ROLE_KEY: "test-service-role" } },
      { error() {} },
      options.authNeverResolves ? (callback, delay) => {
        assert.equal(delay, 12_000);
        return setTimeout(callback, 1);
      } : setTimeout,
      clearTimeout,
    );
    return loadedModule.exports;
  }
  return { ...load(path.join(root, "app/api/admin/contact-messages/route.ts")), rows, queries, authCalls };
}

function request({ method = "GET", query = "", body, headers = {}, omit = [] } = {}) {
  const requestHeaders = new Headers({ authorization: "Bearer owner-session", origin,
    "sec-fetch-site": "same-origin", "content-type": "application/json", ...headers });
  for (const key of omit) requestHeaders.delete(key);
  const req = new Request(`${origin}/api/admin/contact-messages${query}`, {
    method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body),
  });
  req.nextUrl = new URL(req.url);
  return req;
}

function privateResponse(response) {
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.match(response.headers.get("vary"), /Authorization/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
}

test("only the named active admin can load the inbox; fresh metadata and live sessions are enforced", async () => {
  for (const [options, expected] of [
    [{ admin: false }, 403], [{ email: "another-admin@example.com" }, 403],
    [{ liveSession: false }, 401], [{ invalidToken: true }, 401],
    [{ recoveryToken: true }, 401], [{ provisioned: false }, 403],
    [{ sessionError: true }, 503], [{ adminError: true }, 503],
  ]) {
    const app = harness(options);
    const response = await app.GET(request());
    assert.equal(response.status, expected);
    privateResponse(response);
    assert.equal(app.queries.length, 0);
    assert.equal((await response.json()).ok, false);
  }
  const app = harness({ email: "UYMAXSINAN@GMAIL.COM" });
  assert.equal((await app.GET(request())).status, 200);
  assert.deepEqual(app.authCalls, ["getUser", "getClaims", "bluedeck_account_is_ready", "bluedeck_bearer_session_is_live", "getUserById"]);
});

test("missing bearer credentials deny both operations without accessing the database", async () => {
  const app = harness();
  for (const method of ["GET", "PATCH"]) {
    const response = await app[method](request({ method, omit: ["authorization"] }));
    assert.equal(response.status, 401);
    privateResponse(response);
  }
  assert.equal(app.queries.length, 0);
});

test("cursor pagination retains timestamp microseconds and resolves ties without duplicating messages", async () => {
  const app = harness({ rows: Array.from({ length: 51 }, (_, index) => messageRow(index + 1)) });
  const firstResponse = await app.GET(request());
  privateResponse(firstResponse);
  const first = await firstResponse.json();
  assert.equal(first.messages.length, 50);
  assert.deepEqual(first.counts, { all: 51, unread: 51, read: 0, archived: 0 });
  assert.equal(first.hasMore, true);
  assert.equal(first.messages[0].id, messageRow(51).id);
  const decoded = JSON.parse(Buffer.from(first.nextCursor, "base64url").toString());
  assert.equal(decoded.createdAt, timestamp);
  const second = await (await app.GET(request({ query: `?cursor=${first.nextCursor}` }))).json();
  assert.equal(second.messages.length, 1);
  assert.equal(second.messages[0].id, messageRow(1).id);
  assert.equal(second.hasMore, false);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.messages, ...second.messages].map((row) => row.id)).size, 51);
  assert.deepEqual(app.queries[0].orders, [["created_at", { ascending: false }], ["id", { ascending: false }]]);
});

test("status filters retain global counts, including archived messages", async () => {
  const app = harness({ rows: [messageRow(1), messageRow(2, "read"), messageRow(3, "archived")] });
  for (const status of ["unread", "read", "archived", "all"]) {
    const result = await (await app.GET(request({ query: `?status=${status}` }))).json();
    assert.equal(result.messages.length, status === "all" ? 3 : 1);
    if (status !== "all") assert.equal(result.messages[0].status, status);
    assert.deepEqual(result.counts, { all: 3, unread: 1, read: 1, archived: 1 });
  }
});

test("invalid cursors, dates, duplicate or unexpected filters are rejected before querying", async () => {
  const invalidDate = Buffer.from(JSON.stringify({ id: messageRow(1).id, createdAt: "2026-02-31T12:00:00Z" })).toString("base64url");
  const injected = Buffer.from(JSON.stringify({ id: "1),status.eq.unread", createdAt: timestamp })).toString("base64url");
  const app = harness();
  for (const query of ["?status=deleted", "?status=all&status=read", "?offset=1", "?cursor=", "?cursor=%%%%", `?cursor=${invalidDate}`, `?cursor=${injected}`]) {
    assert.equal((await app.GET(request({ query }))).status, 400);
  }
  assert.equal(app.queries.length, 0);
});

test("PATCH changes only status with an exact timestamp guard and returns the updated revision", async () => {
  const app = harness();
  const response = await app.PATCH(request({ method: "PATCH", body: {
    id: messageRow(1).id, status: "read", updatedAt: timestamp,
  } }));
  privateResponse(response);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.message.status, "read");
  assert.equal(saved.message.message, "Private message");
  assert.notEqual(saved.message.updatedAt, timestamp);
  assert.deepEqual(app.queries[0].filters, [["id", messageRow(1).id], ["updated_at", timestamp]]);
  assert.ok(app.queries[0].signal instanceof AbortSignal);
  assert.equal(app.queries[0].retry, false);
});

test("concurrent updates using the same revision produce one success and one conflict", async () => {
  const app = harness();
  const responses = await Promise.all(["read", "archived"].map((status) => app.PATCH(request({ method: "PATCH", body: {
    id: messageRow(1).id, status, updatedAt: timestamp,
  } }))));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(app.rows[0].status, "read");
});

test("PATCH rejects cross-origin requests, invalid fields and oversized bodies", async () => {
  const app = harness();
  const body = { id: messageRow(1).id, status: "read", updatedAt: timestamp };
  for (const headers of [{ origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }]) {
    assert.equal((await app.PATCH(request({ method: "PATCH", headers, body }))).status, 403);
  }
  assert.equal((await app.PATCH(request({ method: "PATCH", omit: ["origin"], body }))).status, 403);
  for (const invalid of [{ ...body, id: "not-a-uuid" }, { ...body, status: "deleted" },
    { ...body, updatedAt: "2026-02-31T12:00:00Z" }, { ...body, message: "overwrite" }, { id: body.id }]) {
    assert.equal((await app.PATCH(request({ method: "PATCH", body: invalid }))).status, 400);
  }
  assert.equal((await app.PATCH(request({ method: "PATCH", body: { ...body, extra: "x".repeat(3000) } }))).status, 413);
  assert.equal((await app.PATCH(request({ method: "PATCH", body, headers: { "content-type": "text/plain" } }))).status, 415);
  assert.equal(app.queries.length, 0);
});

test("database errors, invalid rows and missing messages fail closed without leaking private details", async () => {
  for (const options of [{ databaseError: true }, { countError: true }, { rows: [{ ...messageRow(1), language: "invalid" }] }]) {
    const response = await harness(options).GET(request());
    assert.equal(response.status, 503);
    privateResponse(response);
    const text = await response.text();
    assert.doesNotMatch(text, /Private|sender@example|SQL/);
  }
  const app = harness({ rows: [] });
  const response = await app.PATCH(request({ method: "PATCH", body: { id: messageRow(1).id, status: "archived", updatedAt: timestamp } }));
  assert.equal(response.status, 409);
  assert.equal(typeof app.DELETE, "undefined");
});

test("repeated inbox reads receive a private rate-limit response with a retry delay", async () => {
  const app = harness();
  for (let index = 0; index < 180; index += 1) assert.equal((await app.GET(request())).status, 200);
  const queryCount = app.queries.length;
  const response = await app.GET(request());
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) > 0);
  privateResponse(response);
  assert.equal(app.queries.length, queryCount);
});

test("an unresponsive authentication service times out without starting an inbox query", async () => {
  const app = harness({ authNeverResolves: true });
  const response = await app.GET(request());
  assert.equal(response.status, 503);
  privateResponse(response);
  assert.equal(app.queries.length, 0);
});
