import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/contracts/page.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let declaration;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "signContract") declaration = node.getText(parsed);
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(declaration);
const compiled = ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

function harness(overrides = {}, result = { data: { id: "contract-a", status: "signed", signed_name: "Crew Member", signed_at: "2026-10-06T10:00:00Z" }, error: null }) {
  const calls = [];
  const accepted = [];
  const errors = [];
  const context = {
    pending: { current: false }, documentReady: true, signatureConsent: true,
    signatureName: "  Crew Member  ", contract: { id: "contract-a", status: "sent_for_signature" },
    setSigning() {}, setError: (error) => errors.push(error), onSigned: (data) => accepted.push(data),
    setSignatureName() {}, setSignatureConsent() {},
    supabase: { from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const query = {
        update(payload) { call.payload = payload; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        select() { return query; },
        async maybeSingle() { return await result; },
      };
      return query;
    } },
    ...overrides,
  };
  const run = new Function(...Object.keys(context), `${compiled}\nreturn signContract;`)(...Object.values(context));
  return { run, calls, accepted, errors, context };
}

test("crew acceptance requires an available document, explicit consent and a name", async () => {
  for (const override of [{ documentReady: false }, { signatureConsent: false }, { signatureName: " " }, { contract: { id: "contract-a", status: "signed" } }]) {
    const h = harness(override);
    await h.run();
    assert.equal(h.calls.length, 0);
    assert.equal(h.accepted.length, 0);
  }
});

test("acceptance targets only the selected unsigned record and preserves the server timestamp", async () => {
  const h = harness();
  await h.run();
  assert.deepEqual(h.calls[0], { table: "yacht_contracts", filters: [["id", "contract-a"], ["status", "sent_for_signature"]], payload: { status: "signed", signed_name: "Crew Member" } });
  assert.equal(h.accepted[0].signed_at, "2026-10-06T10:00:00Z");
  assert.equal(h.context.pending.current, false);
});

test("a rejected or unmatched acceptance never reports a signed contract", async () => {
  for (const result of [{ data: null, error: null }, { data: null, error: { message: "denied" } }, Promise.reject(new Error("offline"))]) {
    const h = harness({}, result);
    await h.run();
    assert.equal(h.accepted.length, 0);
    assert.match(h.errors.at(-1), /could not be confirmed/);
    assert.equal(h.context.pending.current, false);
  }
});

test("duplicate sign clicks produce only one pending acceptance", async () => {
  let resolve;
  const gate = new Promise((done) => { resolve = done; });
  const h = harness({}, gate);
  const first = h.run();
  await h.run();
  assert.equal(h.calls.length, 1);
  resolve({ data: { id: "contract-a", status: "signed" }, error: null });
  await first;
  assert.equal(h.accepted.length, 1);
});
