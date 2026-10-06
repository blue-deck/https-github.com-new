import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/yachts/[id]/crew/page.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function loadFunction(name, context) {
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node.getText(parsed);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(declaration, `${name} must exist in the actual Contract Studio implementation`);
  const compiled = ts.transpileModule(declaration, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(context), `${compiled}\nreturn ${name};`)(...Object.values(context));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function harness({ draftId = "", updateFails = false, serializeFails = false, pdfGate } = {}) {
  const calls = [];
  const transitions = [];
  const context = {
    contractSendInFlightRef: { current: false },
    contractSaveInFlightRef: { current: false },
    contractDownloadInFlightRef: { current: false },
    crew: [{ id: "membership-1", crew_profile_id: "crew-1" }],
    selectedCrew: "membership-1",
    contractPreviewText: "Immutable agreement",
    contractPreviewDraft: { employerSignatureDataUrl: "signature" },
    contractDraftRecordId: draftId,
    yachtId: "yacht-1",
    setSendingContract: (value) => transitions.push(["sending", value]),
    setDownloadingContract: (value) => transitions.push(["downloading", value]),
    setContractNotice: (value) => transitions.push(["notice", value]),
    setContractDraftRecordId: (value) => transitions.push(["draft", value]),
    setContractStep: (value) => transitions.push(["step", value]),
    setContractArchiveRefreshKey: (update) => transitions.push(["refresh", update(3)]),
    setContractStudioView: (value) => transitions.push(["view", value]),
    downloadContractDraftPdf: async () => {
      if (pdfGate) await pdfGate.promise;
      return new Blob(["%PDF-1.4"]);
    },
    serializeAssignedContractPdfPayload: async (text, signature, blob) => {
      assert.equal(calls.length, 0, "PDF serialization must finish before any database write");
      assert.equal(text, "Immutable agreement");
      assert.equal(signature, "signature");
      assert.ok(blob instanceof Blob);
      if (serializeFails) throw new Error("Document too large");
      return "frozen-pdf-payload";
    },
    supabase: {
      from(table) {
        const call = { table, filters: [] };
        calls.push(call);
        const builder = {
          insert(value) { call.type = "insert"; call.value = value; return builder; },
          update(value) { call.type = "update"; call.value = value; return builder; },
          delete() { call.type = "delete"; return builder; },
          select() { return builder; },
          eq(key, value) { call.filters.push([key, value]); return builder; },
          async single() { return { data: { id: "draft-1" }, error: null }; },
          async maybeSingle() {
            return updateFails
              ? { data: null, error: { message: "offline" } }
              : { data: { id: "draft-1" }, error: null };
          },
          then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
        };
        return builder;
      },
    },
  };
  return { context, calls, transitions, run: loadFunction("assignContract", context) };
}

test("a PDF capture or size failure prevents all contract mutations and releases send state", async () => {
  const h = harness({ serializeFails: true });
  await h.run();
  assert.equal(h.calls.length, 0);
  assert.equal(h.context.contractSendInFlightRef.current, false);
  assert.deepEqual(h.transitions.at(-2), ["notice", { message: "Document too large", error: true }]);
  assert.deepEqual(h.transitions.at(-1), ["sending", false]);
});

test("double-clicking send captures one PDF and delivers one immutable record to the selected recipient", async () => {
  const gate = deferred();
  const h = harness({ pdfGate: gate });
  const first = h.run();
  await h.run();
  assert.equal(h.calls.length, 0);
  gate.resolve();
  await first;
  assert.deepEqual(h.calls.map((call) => call.type), ["insert", "update"]);
  assert.equal(h.calls[1].value.contract_text, "frozen-pdf-payload");
  assert.equal(h.calls[1].value.membership_id, "membership-1");
  assert.equal(h.calls[1].value.crew_profile_id, "crew-1");
  assert.deepEqual(h.calls[1].filters, [["id", "draft-1"], ["yacht_id", "yacht-1"], ["status", "studio_draft"]]);
  assert.ok(h.transitions.some(([key, value]) => key === "view" && value === "sent"));
  assert.ok(h.transitions.some(([key, value]) => key === "refresh" && value === 4));
});

test("sending an existing studio draft does not insert another record", async () => {
  const h = harness({ draftId: "existing-draft" });
  await h.run();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].type, "update");
  assert.ok(h.calls[0].filters.some(([key, value]) => key === "id" && value === "existing-draft"));
});

test("a failed send cleans only its new unsent draft and never reports success", async () => {
  const h = harness({ updateFails: true });
  await h.run();
  assert.deepEqual(h.calls.map((call) => call.type), ["insert", "update", "delete"]);
  assert.deepEqual(h.calls[2].filters, [["id", "draft-1"], ["yacht_id", "yacht-1"], ["status", "studio_draft"]]);
  assert.ok(!h.transitions.some(([key, value]) => key === "view" && value === "sent"));
  assert.equal(h.transitions.at(-2)[1].error, true);
  assert.equal(h.context.contractSendInFlightRef.current, false);
});

test("a failed send of an existing draft preserves the saved draft", async () => {
  const h = harness({ draftId: "existing-draft", updateFails: true });
  await h.run();
  assert.deepEqual(h.calls.map((call) => call.type), ["update"]);
});

test("saving or downloading a draft blocks concurrent send before generation or writes", async () => {
  for (const ref of ["contractSaveInFlightRef", "contractDownloadInFlightRef"]) {
    const h = harness();
    h.context[ref].current = true;
    await h.run();
    assert.equal(h.calls.length, 0);
    assert.equal(h.transitions.length, 0);
  }
});

test("download failure is visible, duplicate downloads are blocked, and retry remains available", async () => {
  const gate = deferred();
  const h = harness({ pdfGate: gate });
  const download = loadFunction("downloadContractDraft", h.context);
  const first = download();
  await download();
  assert.equal(h.transitions.filter(([key, value]) => key === "downloading" && value).length, 1);
  gate.reject(new Error("PDF generation failed"));
  await first;
  assert.equal(h.context.contractDownloadInFlightRef.current, false);
  assert.equal(h.transitions.at(-2)[1].error, true);
  assert.deepEqual(h.transitions.at(-1), ["downloading", false]);
});
