import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { getDocument, version as pdfjsVersion } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createEmptyImoCrewRow, createImoCrewListDraft } from "../app/lib/imoCrewList.ts";

const generatorUrl = new URL("../app/lib/imoCrewListPdf.ts", import.meta.url);
const layoutUrl = new URL("../app/lib/imoCrewListLayout.ts", import.meta.url);
// The production bundler resolves extensionless imports; this test runs the same
// generator in Node without changing app imports or adding a test-time bundler.
const compiled = ts.transpileModule(await readFile(generatorUrl, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replaceAll('"./imoCrewListLayout"', JSON.stringify(layoutUrl.href))
  .replaceAll('import("jspdf")', `import(${JSON.stringify(import.meta.resolve("jspdf"))})`);
const { createImoCrewListPdf } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function makeDraft(crewCount = 0) {
  const draft = createImoCrewListDraft("pdf-test-yacht", { name: "M/Y Ege Işığı", flag: "Malta" }, []);
  Object.assign(draft.voyage, {
    imoNumber: "1234567",
    callSign: "9H-TEST",
    voyageNumber: "VOYAGE-2027-04",
    portOfArrivalDeparture: "Valletta",
    arrivalDepartureDate: "2027-04-20",
    lastPort: "Athens",
    masterName: "Şule Öztürk",
    declarationDate: "2027-04-19",
  });
  draft.crew = Array.from({ length: crewCount }, (_, index) => ({
    ...createEmptyImoCrewRow(),
    fullName: `Crew ${String(index + 1).padStart(2, "0")} Ana María de la Cruz`,
    rank: "Chief Officer",
    nationality: "Türkiye",
    dateOfBirth: `1990-12-${String(index + 1).padStart(2, "0")}`,
    placeOfBirth: "İstanbul",
    gender: "Female",
    documentType: "Passport",
    documentNumber: `PASSPORT-${String(index + 1).padStart(4, "0")}`,
    documentExpiry: `2032-01-${String(index + 1).padStart(2, "0")}`,
  }));
  return draft;
}

async function readGeneratedPdf(context, draft) {
  context.mock.method(globalThis, "fetch", async (source) => {
    assert.ok(
      source === "/fonts/NotoSans-Regular.ttf" || source === "/fonts/NotoSans-Bold.ttf",
      `PDF generation must only fetch bundled fonts, received ${source}`,
    );
    const bytes = await readFile(new URL(`../public${source}`, import.meta.url));
    return new Response(bytes, { headers: { "Content-Type": "font/ttf" } });
  });
  const original = structuredClone(draft);
  const blob = await createImoCrewListPdf(draft);
  assert.equal(blob.type, "application/pdf");
  assert.deepEqual(draft, original, "export must not modify the editable draft");
  const loadingTask = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), verbosity: 0 });
  const pdf = await loadingTask.promise;
  try {
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item);
      pages.push({ width: viewport.width, height: viewport.height, items, text: items.map((item) => item.str).join(" ") });
      page.cleanup();
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

function compact(value) {
  return value.normalize("NFC").replace(/\s+/gu, "");
}

function assertPortraitPages(pages) {
  for (const [index, page] of pages.entries()) {
    assert.ok(Math.abs(page.width - 595.28) < 0.1, "A4 portrait width is 210 mm");
    assert.ok(Math.abs(page.height - 841.89) < 0.1, "A4 portrait height is 297 mm");
    assert.match(page.text, /CREW LIST/);
    assert.match(page.text, /IMO FAL Form 5/);
    assert.match(page.text, /Prepared in BlueDeck/);
    assert.ok(page.text.includes(`Page ${index + 1} of ${pages.length}`));
    assert.doesNotMatch(page.text, /Dates:|Issuing State|issuingState/i);
    for (const item of page.items.filter((item) => item.str.trim())) {
      const [, , , , x, y] = item.transform;
      assert.ok(x >= 0 && x + item.width <= page.width + 0.5, `Text stays within the page horizontally: ${item.str}`);
      assert.ok(y >= 0 && y <= page.height, `Text stays within the page vertically: ${item.str}`);
    }
  }
}

test("exports an empty editable list as a readable portrait A4 PDF", async (context) => {
  const pages = await readGeneratedPdf(context, makeDraft());
  assert.equal(pages.length, 1);
  assertPortraitPages(pages);
  const text = compact(pages[0].text);
  for (const expected of ["M/Y Ege Işığı", "7. Full name", "14. Document number", "Name of signatory", "Şule Öztürk", "19/04/2027"]) {
    assert.ok(text.includes(compact(expected)), `Empty form retains ${expected}`);
  }
});

test("preserves every crew member and document across portrait PDF pages", async (context) => {
  const draft = makeDraft(12);
  const pages = await readGeneratedPdf(context, draft);
  assert.ok(pages.length > 1, "12 crew members exercise pagination");
  assertPortraitPages(pages);
  const text = compact(pages.map((page) => page.text).join(" "));
  for (const row of draft.crew) {
    for (const expected of [row.fullName, row.documentNumber]) {
      assert.equal(text.split(compact(expected)).length - 1, 1, `Export includes ${expected} exactly once`);
    }
    for (const date of [row.dateOfBirth, row.documentExpiry]) {
      assert.ok(text.includes(date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1")), `Export preserves ${date}`);
    }
  }
});

test("retains long names and document numbers without clipping or dropping wrapped text", async (context) => {
  const draft = makeDraft(12);
  for (const [index, row] of draft.crew.entries()) {
    row.fullName = `${row.fullName} ${"Alexandra-Louise ".repeat(8)}`.slice(0, 120);
    row.rank = "Chief Officer Navigation Safety Emergency Response Communications ".repeat(2).slice(0, 120);
    row.placeOfBirth = "İstanbul Coastal District Maritime Administrative Region ".repeat(3).slice(0, 120);
    row.documentType = "International Passport And Seafarer Identity Document ".repeat(3).slice(0, 120);
    row.documentNumber = `DOC-${String(index).padStart(2, "0")}-${"1234567890ABCDEF".repeat(8)}`.slice(0, 120);
    row.issuingState = "SHOULD-NOT-APPEAR-IN-PDF";
  }
  const pages = await readGeneratedPdf(context, draft);
  assert.ok(pages.length > 1);
  assertPortraitPages(pages);
  const text = compact(pages.map((page) => page.text).join(" "));
  for (const row of draft.crew) {
    for (const expected of [row.fullName, row.rank, row.placeOfBirth, row.documentType, row.documentNumber]) {
      assert.ok(text.includes(compact(expected)), `Wrapped PDF text retains the whole ${expected}`);
    }
  }
  assert.ok(!text.includes("SHOULD-NOT-APPEAR-IN-PDF"));
});

test("ships the exact matching PDF.js legacy worker for the pinned preview library", async () => {
  const version = "6.3.289";
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.dependencies["pdfjs-dist"], version);
  assert.equal(pdfjsVersion, version);
  const [bundled, installed] = await Promise.all([
    readFile(new URL(`../public/pdfjs/${version}/pdf.worker.min.mjs`, import.meta.url)),
    readFile(new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url)),
  ]);
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha256(bundled), sha256(installed), "Worker and PDF.js API must use the exact same build");
});
