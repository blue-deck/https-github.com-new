import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const origin = "https://www.bluedeck.app";
const postId = "33333333-3333-4333-8333-333333333333";
const compiled = new Map();
function harness(options = {}) {
  let row = options.empty ? null : {
    id: postId, slug: "sample-article", status: "published", version: 1,
    created_at: "2026-11-01T09:00:00Z", updated_at: "2026-11-01T09:00:00Z",
    published_at: "2026-11-01T09:00:00Z", published_updated_at: "2026-11-01T09:00:00Z",
  };
  let writes = 0;
  const invalidations = [];
  const client = { from(table) {
    assert.equal(table, "blog_posts");
    const state = { filters: [], operation: "select", payload: null };
    const builder = {
      select() { return builder; }, order() { return builder; }, limit() { return builder; },
      abortSignal() { return builder; }, retry() { return builder; },
      eq(key, value) { state.filters.push((item) => item[key] === value); return builder; },
      neq(key, value) { state.filters.push((item) => item[key] !== value); return builder; },
      insert(value) { state.operation = "insert"; state.payload = value; return builder; },
      update(value) { state.operation = "update"; state.payload = value; return builder; },
      delete() { state.operation = "delete"; return builder; },
      single() { return Promise.resolve(execute(true)); },
      maybeSingle() { return Promise.resolve(execute(true)); },
      then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject); },
    };
    function execute(single) {
      if (state.operation === "insert") {
        if (row) return { error: { code: "23505" }, data: null };
        row = { ...state.payload, id: postId, version: 1, status: "draft", published: null,
          created_at: "2026-11-07T10:00:00Z", updated_at: "2026-11-07T10:00:00Z" };
        writes++;
        return { data: structuredClone(row), error: null };
      }
      if (options.concurrentWrite && state.operation === "update") row.version++;
      if (!row || !state.filters.every((condition) => condition(row))) return { data: single ? null : [], error: null };
      if (state.operation === "update") { Object.assign(row, structuredClone(state.payload)); row.version++; row.updated_at = "2026-11-07T10:00:00Z"; writes++; }
      const data = structuredClone(row);
      if (state.operation === "delete") { row = null; writes++; }
      return { data: single ? data : [data], error: null };
    }
    return builder;
  } };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    if (!compiled.has(filename)) compiled.set(filename, ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText);
    const require = (specifier) => {
      if (specifier === "server-only") return {};
      if (specifier === "next/server") return { NextResponse: { json: Response.json } };
      if (specifier === "next/cache") return { revalidatePath(value) { if (options.cacheError) throw Error("cache unavailable"); invalidations.push(value); } };
      if (specifier === "react") return { cache: (fn) => fn };
      if (specifier === "@supabase/supabase-js") return { createClient: () => client };
      if (specifier.endsWith("contactInboxServer")) return { contactInboxClients: async () => options.authError ?? { adminUser: { id: "owner" }, serviceClient: client } };
      if (specifier.endsWith("employerAccessServer")) return { isUuid: (value) => /^[0-9a-f-]{36}$/.test(value), isRecord: (value) => !!value && typeof value === "object" && !Array.isArray(value) };
      if (specifier.endsWith("requestRateLimitServer")) return { consumeRequestRateLimit: () => ({ allowed: true }) };
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`));
      return nativeRequire(specifier);
    };
    new Function("require", "module", "exports", compiled.get(filename))(require, loaded, loaded.exports);
    return loaded.exports;
  }
  const model = load(path.join(root, "app/lib/blog.ts"));
  const document = { ...model.createEmptyBlogDocument(), slug: "sample-article", coverImage: "/media/guides/yacht-career-v1.webp",
    content: { tr: { ...model.createEmptyBlogTranslation(), title: "Örnek yazı", description: "Kısa açıklama", imageAlt: "Denizde yat",
      sections: [{ id: "introduction", title: "Başlangıç", paragraphs: ["İlk paragraf."] }] } } };
  if (row) { row.draft = structuredClone(document); row.published = structuredClone(document); }
  const server = load(path.join(root, "app/lib/blogServer.ts"));
  const routes = load(path.join(root, "app/api/admin/blog/route.ts"));
  const item = load(path.join(root, "app/api/admin/blog/[id]/route.ts"));
  function request(method, body, settings = {}) {
    return new Request(`${origin}/api/admin/blog/${postId}`, { method, headers: {
      origin: settings.origin ?? origin, "content-type": "application/json", "sec-fetch-site": "same-origin",
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  async function update(body, settings) { return item.PATCH(request("PATCH", body, settings), { params: Promise.resolve({ id: postId }) }); }
  return { model, server, routes, item, request, update, document, row: () => row, writes: () => writes, invalidations };
}

test("draft edits preserve the live publication until an explicit publish", async () => {
  const h = harness();
  const updated = structuredClone(h.document); updated.content.tr.title = "Yeni başlık";
  const response = await h.update({ version: 1, action: "save", document: updated });
  assert.equal(response.status, 200);
  assert.equal(h.row().draft.content.tr.title, "Yeni başlık");
  assert.equal(h.row().published.content.tr.title, "Örnek yazı");
  assert.equal(h.row().published_updated_at, "2026-11-01T09:00:00Z");
  assert.equal(h.row().status, "published");
  assert.equal(h.row().version, 2);
  assert.deepEqual(h.invalidations, []);
  assert.equal((await h.update({ version: 2, action: "publish" })).status, 200);
  assert.equal(h.row().published.content.tr.title, "Yeni başlık");
  assert.equal(h.row().published_at, "2026-11-01T09:00:00Z");
  assert.ok(h.invalidations.includes("/blog/sample-article"));
});

test("incomplete drafts can be saved but cannot replace a live publication", async () => {
  const h = harness();
  const incomplete = structuredClone(h.document); incomplete.content.tr.sections = [];
  assert.equal((await h.update({ version: 1, action: "save", document: incomplete })).status, 200);
  assert.equal((await h.update({ version: 2, action: "publish" })).status, 400);
  assert.equal(h.row().published.content.tr.sections.length, 1);
});

test("stale and concurrently superseded edits are rejected atomically", async () => {
  const h = harness();
  assert.equal((await h.update({ version: 99, action: "save", document: h.document })).status, 409);
  assert.equal(h.writes(), 0);
  const racing = harness({ concurrentWrite: true });
  assert.equal((await racing.update({ version: 1, action: "save", document: racing.document })).status, 409);
  assert.equal(racing.writes(), 0);
});

test("published articles cannot be deleted; unpublish allows deliberate removal", async () => {
  const h = harness();
  const context = { params: Promise.resolve({ id: postId }) };
  assert.equal((await h.item.DELETE(h.request("DELETE", { version: 1 }), context)).status, 409);
  assert.equal((await h.update({ version: 1, action: "unpublish" })).status, 200);
  assert.equal(h.row().status, "draft");
  assert.equal((await h.item.DELETE(h.request("DELETE", { version: 2 }), context)).status, 200);
  assert.equal(h.row(), null);
});

test("archived articles restore as drafts without silently publishing", async () => {
  const h = harness();
  assert.equal((await h.update({ version: 1, action: "archive" })).status, 200);
  assert.equal(h.row().status, "archived");
  assert.equal((await h.update({ version: 2, action: "publish" })).status, 409);
  assert.equal((await h.update({ version: 2, action: "restore" })).status, 200);
  assert.equal(h.row().status, "draft");
});

test("owner authorization and same-origin checks run before database changes", async () => {
  for (const status of [401, 403, 503]) {
    const h = harness({ authError: { status, error: "Denied" } });
    assert.equal((await h.routes.GET(h.request("GET"))).status, status);
    assert.equal((await h.update({ version: 1, action: "publish" })).status, status);
    assert.equal(h.writes(), 0);
  }
  const h = harness();
  assert.equal((await h.update({ version: 1, action: "publish" }, { origin: "https://attacker.example" })).status, 403);
  assert.equal(h.writes(), 0);
});

test("new articles start as drafts and duplicate URLs return a conflict", async () => {
  const h = harness({ empty: true });
  assert.equal((await h.routes.POST(h.request("POST", { document: h.document }))).status, 201);
  assert.equal(h.row().status, "draft");
  assert.equal(h.row().published, null);
  assert.equal((await h.routes.POST(h.request("POST", { document: h.document }))).status, 409);
});

test("published URL stability, media hosts and internal CTA links are enforced", async () => {
  const h = harness();
  for (const patch of [{ slug: "different-url" }, { coverImage: "https://attacker.example/image.webp" }, { coverImage: "//attacker.example/image.webp" }]) {
    assert.equal((await h.update({ version: 1, action: "save", document: { ...h.document, ...patch } })).status, 400);
  }
  for (const ctaHref of ["javascript:alert(1)", "//attacker.example", "/%2fattacker.example"]) {
    const document = structuredClone(h.document); document.content.tr.ctaHref = ctaHref;
    assert.equal(h.model.validateBlogDocument(document).ok, false);
  }
  assert.equal(h.writes(), 0);
});

test("failed optional cache refresh does not misreport an already committed publication", async () => {
  const h = harness({ cacheError: true });
  assert.equal((await h.update({ version: 1, action: "publish" })).status, 200);
  assert.equal(h.row().version, 2);
});


test("public row projection never includes unpublished edits or draft timestamps", async () => {
  const h = harness();
  const updated = structuredClone(h.document); updated.content.tr.title = "Private draft title";
  await h.update({ version: 1, action: "save", document: updated });
  const publicPost = h.server.blogPostFromRow(h.row(), true);
  assert.equal(publicPost.published.content.tr.title, "Örnek yazı");
  assert.equal(publicPost.draft.content.tr.title, "Örnek yazı");
  assert.equal(publicPost.updatedAt, "2026-11-01T09:00:00Z");
  assert.doesNotMatch(JSON.stringify(publicPost), /Private draft title/);
});
