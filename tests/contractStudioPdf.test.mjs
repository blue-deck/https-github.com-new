import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as annexA from "../app/lib/contractAnnexA.ts";
import * as annexB from "../app/lib/contractAnnexB.ts";
import * as annexC from "../app/lib/contractAnnexC.ts";
import * as annexD from "../app/lib/contractAnnexD.ts";
import { serializeAssignedContractPdfPayload, maximumAssignedContractBytes, isContractSignatureDataUrl } from "../app/lib/contractPayload.ts";

const helperSource = await readFile(new URL("../app/lib/assignedContractPdf.ts", import.meta.url), "utf8");
const helperCode = ts.transpileModule(helperSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replaceAll('"./contractPayload"', JSON.stringify(new URL("../app/lib/contractPayload.ts", import.meta.url).href))
  .replaceAll('import("jspdf")', `import(${JSON.stringify(import.meta.resolve("jspdf"))})`);
const { installContractPdfFonts } = await import(`data:text/javascript;base64,${Buffer.from(helperCode).toString("base64")}`);

// Execute the real nested Studio generator with its pure production helpers,
// independent of React, authentication and any live database.
const studioSource = await readFile(new URL("../app/yachts/[id]/crew/page.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("page.tsx", studioSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helperNames = new Set([
  "createEmptyContractDraft", "getCrewDisplayName", "getCrewPosition", "contractValue", "contractSheetValue",
  "getContractGoverningLaw", "getContractAnnexDDetails", "contractDisplayLines", "splitContractSubclausePrefix",
  "formatContractMoneyInput", "formatContractSalary", "getContractCoverSections", "getContractTermsSections",
  "getContractDocumentSections", "buildContractPreviewText", "buildContractFileName",
]);
const declarations = parsed.statements.filter((node) => ts.isVariableStatement(node)
  || (ts.isFunctionDeclaration(node) && helperNames.has(node.name?.text))).map((node) => node.getText(parsed));
let generator;
function findGenerator(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === "downloadContractDraftPdf") generator = node.getText(parsed);
  ts.forEachChild(node, findGenerator);
}
findGenerator(parsed);
assert.ok(generator);
const production = ts.transpileModule(`${declarations.join("\n")}\nfunction createFixture(draft, member) {
  const contractPreviewDraft = draft;
  const selectedContractMember = member;
  const contractPreviewText = buildContractPreviewText(draft, member);
  ${generator}
  return downloadContractDraftPdf("preview").then(blob => ({ blob, text: contractPreviewText }));
}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const dependencies = { require: createRequire(import.meta.url), installContractPdfFonts, isContractSignatureDataUrl, ...annexA, ...annexB, ...annexC, ...annexD };
const { createFixture, createEmptyContractDraft } = new Function(...Object.keys(dependencies),
  `${production}\nreturn { createFixture, createEmptyContractDraft };`)(...Object.values(dependencies));

function normalize(value) { return value.normalize("NFC").replace(/\s+/gu, ""); }

test("the real Studio PDF retains Turkish/Greek names, every legal clause and A4 page bounds within the saved payload limit", async (context) => {
  context.mock.method(globalThis, "fetch", async (path) => {
    assert.ok(["/fonts/NotoSans-Regular.ttf", "/fonts/NotoSans-Bold.ttf"].includes(path));
    return new Response(await readFile(new URL(`../public${path}`, import.meta.url)));
  });
  const draft = {
    ...createEmptyContractDraft(),
    vesselName: "M/Y Ege Işığı", flagState: "Türkiye", ownerCompanyName: "Αιγαίο Denizcilik",
    employeeName: "Şule Öztürk", employeePosition: "Chief Officer", signerName: "Γιώργος Παπαδόπουλος",
    signatureLocation: "İstanbul", seafarerFullName: "Şule Öztürk", seafarerPlaceSigned: "Αθήνα",
    specialConditions: Array.from({ length: 90 }, (_, index) => `Special condition ${index + 1}: Türkiye and Ελλάδα employment terms remain intact.`).join("\n"),
  };
  const { blob, text } = await createFixture(draft, { crew_profiles: { full_name: "Şule Öztürk", nationality: "Türkiye" } });
  const payload = await serializeAssignedContractPdfPayload(text, "", blob);
  assert.ok(new TextEncoder().encode(payload).byteLength <= maximumAssignedContractBytes);
  const task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), verbosity: 0 });
  const pdf = await task.promise;
  const pageTexts = [];
  try {
    assert.ok(pdf.numPages > 6);
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      assert.ok(Math.abs(viewport.width - 595.28) < 0.1);
      assert.ok(Math.abs(viewport.height - 841.89) < 0.1);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item && item.str.trim());
      const pageText = items.map((item) => item.str).join(" ");
      assert.ok(pageText.includes(`Page ${number} of ${pdf.numPages}`));
      for (const item of items) {
        const x = item.transform[4];
        const y = item.transform[5];
        assert.ok(x >= 20 && x + item.width <= viewport.width - 20, `Page ${number} text fits horizontally: ${item.str}`);
        assert.ok(y >= 20 && y <= viewport.height - 20, `Page ${number} text fits vertically: ${item.str}`);
      }
      pageTexts.push(items.filter((item) => !/^Page \d+ of \d+$/.test(item.str)
        && item.str !== "SEAFARER EMPLOYMENT AGREEMENT"
        && item.str !== "ANNEX C - GENERAL TERMS & CONDITIONS").map((item) => item.str).join(" "));
      page.cleanup();
    }
    const documentText = normalize(pageTexts.join(" "));
    for (const name of ["Şule Öztürk", "Γιώργος Παπαδόπουλος", "M/Y Ege Işığı", "Αιγαίο Denizcilik", "Αθήνα"]) {
      assert.ok(documentText.includes(normalize(name)), `Unicode name retained: ${name}`);
    }
    for (const clause of annexC.contractAnnexCClauses) {
      assert.ok(documentText.includes(normalize(clause.title)), `Clause heading retained: ${clause.title}`);
      for (const paragraph of clause.body) assert.ok(documentText.includes(normalize(paragraph)), `Clause ${clause.number} paragraph retained`);
    }
    for (let number = 1; number <= 90; number += 1) {
      assert.ok(documentText.includes(normalize(`Special condition ${number}: Türkiye and Ελλάδα employment terms remain intact.`)));
    }
    context.diagnostic(`${pdf.numPages} A4 pages; ${blob.size} PDF bytes; ${new TextEncoder().encode(payload).byteLength} stored bytes`);
  } finally { await task.destroy(); }
});
