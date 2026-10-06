import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
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

const rendererCode = ts.transpileModule(await readFile(new URL("../app/lib/contractStudioPdf.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replaceAll('"./assignedContractPdf"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(helperCode).toString("base64")}`))
  .replace(/"\.\/(contractAnnex[A-D])"/g, (_, name) => JSON.stringify(new URL(`../app/lib/${name}.ts`, import.meta.url).href))
  .replaceAll('import("jspdf")', `import(${JSON.stringify(import.meta.resolve("jspdf"))})`);
const rendererUrl = `data:text/javascript;base64,${Buffer.from(rendererCode).toString("base64")}`;
const renderer = await import(rendererUrl);
const restorationCode = ts.transpileModule(await readFile(new URL("../app/lib/restoreContractStudioPdf.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replaceAll('"./legacyContractStudio"', JSON.stringify(new URL("../app/lib/legacyContractStudio.ts", import.meta.url).href))
  .replaceAll('"./contractStudioPdf"', JSON.stringify(rendererUrl))
  .replaceAll('"./contractStudioAugust2026"', JSON.stringify(new URL("../app/lib/contractStudioAugust2026.ts", import.meta.url).href));
const restorationUrl = `data:text/javascript;base64,${Buffer.from(restorationCode).toString("base64")}`;
const assignedCode = helperCode.replaceAll('import("./restoreContractStudioPdf")', `import(${JSON.stringify(restorationUrl)})`);
const { createAssignedContractPdf } = await import(`data:text/javascript;base64,${Buffer.from(assignedCode).toString("base64")}`);

// Execute the real nested Studio generator with its pure production helpers,
// independent of React, authentication and any live database.
const studioSource = await readFile(process.env.CONTRACT_STUDIO_BASELINE_SOURCE || new URL("../app/yachts/[id]/crew/page.tsx", import.meta.url), "utf8");
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
  return downloadContractDraftPdf("preview").then(blob => ({ blob, text: contractPreviewText, input: {
    coverSections: getContractCoverSections(draft, member), termsSections: getContractTermsSections(draft, member),
    specialConditions: draft.specialConditions, annexCClauses: contractAnnexCClauses,
    annexD: getContractAnnexDDetails(draft, member), intro: contractStudioIntroduction,
  } }));
}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const dependencies = { require: createRequire(import.meta.url), installContractPdfFonts, isContractSignatureDataUrl, ...annexA, ...annexB, ...annexC, ...annexD, ...renderer };
const declaredNames = new Set(parsed.statements.filter(ts.isVariableStatement).flatMap((statement) =>
  statement.declarationList.declarations.filter((declaration) => ts.isIdentifier(declaration.name)).map((declaration) => declaration.name.text)));
const injected = Object.fromEntries(Object.entries(dependencies).filter(([name]) => !declaredNames.has(name)));
const { createFixture, createEmptyContractDraft } = new Function(...Object.keys(injected),
  `${production}\nreturn { createFixture, createEmptyContractDraft };`)(...Object.values(injected));

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

function visualFixtureDraft() {
  const draft = Object.fromEntries(Object.keys(createEmptyContractDraft()).map((key, index) => [key, `Recorded ${index + 1}`]));
  const canvas = createCanvas(140, 44);
  const context = canvas.getContext("2d");
  context.strokeStyle = "#123550";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(4, 30);
  context.bezierCurveTo(20, 0, 30, 43, 65, 15);
  context.bezierCurveTo(85, 3, 100, 43, 136, 10);
  context.stroke();
  return {
    ...draft,
    employeeName: "Şule Öztürk", vesselName: "M/Y Ege Işığı", ownerCompanyName: "Αιγαίο Denizcilik",
    signerName: "Γιώργος Παπαδόπουλος", seafarerFullName: "Şule Öztürk", seafarerPlaceSigned: "Αθήνα",
    trialSalaryCurrency: "EUR", standardSalaryCurrency: "EUR",
    specialConditions: "Recorded special condition one.\n\nRecorded special condition two: salary €2,500.",
    employerSignatureDataUrl: canvas.toDataURL("image/png"),
  };
}

function normalizedOperators(value) {
  if (typeof value === "string") return value.replace(/g_d\d+_f/g, "g_document_f");
  if (ArrayBuffer.isView(value)) return Array.from(value);
  if (Array.isArray(value)) return value.map(normalizedOperators);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizedOperators(entry)]));
  }
  return value;
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function pageFingerprints(blob, outputPrefix) {
  const task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), verbosity: 0 });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const operators = await page.getOperatorList();
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const png = canvas.toBuffer("image/png");
      if (outputPrefix) await writeFile(`${outputPrefix}-${index}.png`, png);
      pages.push({
        page: index,
        textAndCoordinates: sha256(JSON.stringify(normalizedOperators(content.items))),
        drawingOperators: sha256(JSON.stringify(normalizedOperators(operators))),
        pixels: sha256(png),
      });
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
    }
    return pages;
  } finally { await task.destroy(); }
}

let originalFingerprints;
function originalPageFingerprints() {
  // Rasterize the captured original PDF on the same platform as the current renderer.
  // This catches pixel regressions without depending on OS-specific PNG hashes.
  originalFingerprints ??= readFile(new URL("./fixtures/contract-studio-original.pdf", import.meta.url))
    .then((bytes) => pageFingerprints(new Blob([bytes], { type: "application/pdf" })));
  return originalFingerprints;
}

test("shared Studio renderer keeps every existing page, field, signature, text position and rendered pixel", async (context) => {
  context.mock.method(globalThis, "fetch", async (path) => new Response(await readFile(new URL(`../public${path}`, import.meta.url))));
  const member = { crew_profiles: { email: "synthetic@example.invalid", phone: "+00 000 000" } };
  const { blob, input, text } = await createFixture(visualFixtureDraft(), member);
  const sharedBlob = await renderer.createContractStudioPdf(input);
  const output = process.env.CONTRACT_STUDIO_QA_OUTPUT;
  if (output) {
    await mkdir(output, { recursive: true });
    await writeFile(`${output}/original-studio.pdf`, Buffer.from(await blob.arrayBuffer()));
    await writeFile(`${output}/shared-studio.pdf`, Buffer.from(await sharedBlob.arrayBuffer()));
    await writeFile(`${output}/legacy-studio-text.txt`, text);
    await writeFile(`${output}/legacy-studio-payload.json`, JSON.stringify({ kind: "bluedeck.assigned-contract", version: 1, contractText: text, employerSignatureDataUrl: input.annexD.employerSignatureDataUrl }));
    await writeFile(`${output}/snapshot-studio-payload.json`, await serializeAssignedContractPdfPayload(text, input.annexD.employerSignatureDataUrl, sharedBlob));
    await writeFile(`${output}/studio-input.json`, JSON.stringify(input));
  }
  const actual = await pageFingerprints(blob, output && `${output}/original`);
  const shared = await pageFingerprints(sharedBlob, output && `${output}/shared`);
  assert.deepEqual(shared, actual, "Extracted renderer is identical to the Studio entry point");
  const original = await originalPageFingerprints();
  assert.deepEqual(actual, original, "Current Studio PDF matches the pre-extraction page layout");
  context.diagnostic(`${actual.length} pages compared by text coordinates, PDF drawing operations and exact PNG pixels`);
});

test("the shared renderer uses recorded declarations and omits an unrecorded introduction", async (context) => {
  context.mock.method(globalThis, "fetch", async (path) => new Response(await readFile(new URL(`../public${path}`, import.meta.url))));
  const { input } = await createFixture(visualFixtureDraft());
  const blob = await renderer.createContractStudioPdf({
    ...input,
    intro: undefined,
    annexD: {
      ...input.annexD,
      employerDeclarationParagraphs: ["The recorded employer declaration remains unchanged."],
      seafarerDeclarationParagraphs: ["The recorded seafarer declaration remains unchanged."],
    },
  });
  const task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), verbosity: 0 });
  const pdf = await task.promise;
  try {
    const firstPage = await pdf.getPage(1);
    const firstText = (await firstPage.getTextContent()).items.map((item) => item.str || "").join(" ");
    assert.match(firstText, /ANNEX A - PARTIES/);
    assert.doesNotMatch(firstText, /INTRODUCTORY NOTE/);
    const lastPage = await pdf.getPage(pdf.numPages);
    const finalText = (await lastPage.getTextContent()).items.map((item) => item.str || "").join(" ");
    assert.match(finalText, /The recorded employer declaration remains unchanged\./);
    assert.match(finalText, /The recorded seafarer declaration remains unchanged\./);
    for (const paragraph of [...annexD.contractEmployerDeclarationParagraphs, ...annexD.contractSeafarerDeclarationParagraphs]) {
      assert.ok(!normalize(finalText).includes(normalize(paragraph)), "Today's declarations do not replace recorded declarations");
    }
  } finally { await task.destroy(); }
});


test("saved Studio text restores the complete original document, including its verified introductory note and signature", async (context) => {
  context.mock.method(globalThis, "fetch", async (path) => new Response(await readFile(new URL(`../public${path}`, import.meta.url))));
  const member = { crew_profiles: { email: "synthetic@example.invalid", phone: "+00 000 000" } };
  const { text, input } = await createFixture(visualFixtureDraft(), member);
  const payload = JSON.stringify({ kind: "bluedeck.assigned-contract", version: 1, contractText: text, employerSignatureDataUrl: input.annexD.employerSignatureDataUrl });
  const restored = await createAssignedContractPdf(payload);
  const output = process.env.CONTRACT_STUDIO_QA_OUTPUT;
  if (output) await writeFile(`${output}/restored-legacy-studio.pdf`, Buffer.from(await restored.arrayBuffer()));
  const actual = await pageFingerprints(restored, output && `${output}/restored`);
  const original = await originalPageFingerprints();
  assert.deepEqual(actual, original, "Legacy parsing, historical template identification and assigned-document export preserve every original page pixel");
  context.diagnostic(`${actual.length} restored legacy pages equal the original Studio by text positions, drawing operations and exact PNG pixels`);
});

test("unknown historical terms keep the saved clauses and declarations without adding an unverified introductory note", async (context) => {
  context.mock.method(globalThis, "fetch", async (path) => new Response(await readFile(new URL(`../public${path}`, import.meta.url))));
  const { text, input } = await createFixture(visualFixtureDraft());
  const changed = text.replace(annexC.contractAnnexCClauses[0].body[0], "1.1 This uniquely recorded historical clause remains unchanged.")
    .replace(annexD.contractEmployerDeclarationParagraphs[0], "The historical employer declaration must remain unchanged.");
  const payload = JSON.stringify({ kind: "bluedeck.assigned-contract", version: 1, contractText: changed, employerSignatureDataUrl: input.annexD.employerSignatureDataUrl });
  const blob = await createAssignedContractPdf(payload);
  const task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), verbosity: 0 });
  const pdf = await task.promise;
  try {
    const pageTexts = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      pageTexts.push((await page.getTextContent()).items.map((item) => item.str || "").join(" "));
      page.cleanup();
    }
    assert.match(pageTexts[0], /ANNEX A - PARTIES/);
    const allText = pageTexts.join(" ");
    assert.match(allText, /1\.1 This uniquely recorded historical clause remains unchanged\./);
    assert.match(allText, /The historical employer declaration must remain unchanged\./);
    assert.ok(!normalize(allText).includes(normalize(annexC.contractAnnexCClauses[0].body[0])));
    assert.ok(!normalize(allText).includes(normalize(annexD.contractEmployerDeclarationParagraphs[0])));
    for (const paragraph of renderer.contractStudioIntroduction.paragraphs) {
      assert.ok(!normalize(allText).includes(normalize(paragraph)), "Unverified introductory paragraphs are never inserted");
    }
  } finally { await task.destroy(); }
  await assert.rejects(createAssignedContractPdf("SEAFARER EMPLOYMENT AGREEMENT\nCOVER SHEET\nDamaged saved Studio contract"), /could not be restored/);
});


test("later Studio introduction edits cannot change a restored historical agreement", async (context) => {
  context.mock.method(globalThis, "fetch", async (path) => new Response(await readFile(new URL(`../public${path}`, import.meta.url))));
  const member = { crew_profiles: { email: "synthetic@example.invalid", phone: "+00 000 000" } };
  const { text, input } = await createFixture(visualFixtureDraft(), member);
  const payload = JSON.stringify({ kind: "bluedeck.assigned-contract", version: 1, contractText: text, employerSignatureDataUrl: input.annexD.employerSignatureDataUrl });
  const originalParagraph = renderer.contractStudioIntroduction.paragraphs[0];
  try {
    renderer.contractStudioIntroduction.paragraphs[0] = "A later Studio introductory note that does not belong to the recorded agreement.";
    const restored = await createAssignedContractPdf(payload);
    assert.deepEqual(await pageFingerprints(restored), await originalPageFingerprints(), "Historical introductory note stays pinned despite current Studio edits");
  } finally {
    renderer.contractStudioIntroduction.paragraphs[0] = originalParagraph;
  }
});
