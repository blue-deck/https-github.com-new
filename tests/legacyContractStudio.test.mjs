import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { parseLegacyStudioContract } from "../app/lib/legacyContractStudio.ts";
import { contractAnnexCClauses, getContractAnnexCLines } from "../app/lib/contractAnnexC.ts";
import { contractEmployerDeclarationParagraphs, contractSeafarerDeclarationParagraphs } from "../app/lib/contractAnnexD.ts";
import { isContractSignatureDataUrl } from "../app/lib/contractPayload.ts";

// Exercise the parser against the real serializer, not a fixture that repeats its grammar.
const source = await readFile(new URL("../app/yachts/[id]/crew/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helperNames = new Set([
  "createEmptyContractDraft", "getCrewDisplayName", "getCrewPosition", "contractValue", "contractSheetValue",
  "getContractGoverningLaw", "getContractAnnexDDetails", "formatContractMoneyInput", "formatContractSalary",
  "getContractCoverSections", "getContractDocumentSections", "buildContractPreviewText",
]);
const declarations = ast.statements.filter((node) => ts.isVariableStatement(node)
  || (ts.isFunctionDeclaration(node) && helperNames.has(node.name?.text))).map((node) => node.getText(ast));
const compiled = ts.transpileModule(declarations.join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const dependencies = { contractAnnexCClauses, getContractAnnexCLines, contractEmployerDeclarationParagraphs, contractSeafarerDeclarationParagraphs, isContractSignatureDataUrl };
const { createEmptyContractDraft, buildContractPreviewText } = new Function(...Object.keys(dependencies),
  `${compiled}\nreturn { createEmptyContractDraft, buildContractPreviewText };`)(...Object.values(dependencies));

const signature = "data:image/png;base64,iVBORw0KGgo=";
function fixture(overrides = {}) {
  const draft = {
    ...createEmptyContractDraft(), vesselName: "M/Y Ege Işığı", flagState: "Türkiye",
    ownerCompanyName: "Historical Owner", ownerRegisteredAddress: "Floor 4\nOld harbour\nAthens",
    employeeName: "Şule Öztürk", employeePosition: "Chief Officer", agreementType: "Seasonal",
    agreementStartDate: "2026-08-03", agreementEndDate: "2027-08-03", trialSalary: "1250", trialSalaryCurrency: "EUR",
    standardSalary: "4500", standardSalaryCurrency: "USD", specialConditions: "Original agreed term\n\nAnother condition: keep punctuation.",
    signerName: "Γιώργος Παπαδόπουλος", signatureLocation: "İstanbul", signatureDate: "2026-08-03",
    seafarerFullName: "Şule Öztürk", employerSignatureDataUrl: signature, ...overrides,
  };
  return buildContractPreviewText(draft, { crew_profiles: { email: "old-address@example.test", nationality: "Türkiye", phone: "+90 555 000 00 00" } });
}

test("legacy Studio text restores recorded section values, clauses, declarations and signature without profile lookups", () => {
  const text = fixture();
  const parsed = parseLegacyStudioContract(text, signature);
  assert.ok(parsed);
  assert.equal(parsed.sourceText, text);
  assert.equal(parsed.intro, undefined, "The old text did not save an introduction; identifying its version is separate");
  assert.equal(parsed.coverSections[0].rows[0][1], "M/Y Ege Işığı");
  assert.equal(parsed.coverSections[1].rows[1][1], "Floor 4\nOld harbour\nAthens");
  assert.equal(parsed.coverSections[2].rows[6][1], "old-address@example.test");
  assert.equal(parsed.coverSections[2].rows[3][1], "-", "Unknown historical values are never replaced by a newer profile");
  assert.equal(parsed.termsSections[1].rows[0][1], "1.250 EUR");
  assert.equal(parsed.termsSections[2].rows[0][1], "4.500 USD");
  assert.equal(parsed.specialConditions, "Original agreed term\n\nAnother condition: keep punctuation.");
  assert.deepEqual(parsed.annexCClauses, contractAnnexCClauses);
  assert.deepEqual(parsed.annexD.employerDeclarationParagraphs, contractEmployerDeclarationParagraphs);
  assert.deepEqual(parsed.annexD.seafarerDeclarationParagraphs, contractSeafarerDeclarationParagraphs);
  assert.equal(parsed.annexD.employerSignatureDataUrl, signature);
  assert.equal(parsed.annexD.employerName, "Γιώργος Παπαδόπουλος");
  assert.equal(parsed.annexD.seafarerPlaceSigned, "");
});

test("old law, clause text and declaration wording win over every current default", () => {
  const oldParagraph = "This saved clause used different historical wording: retain every word.";
  const oldEmployerDeclaration = "The employer made this historical declaration; no other text is substituted.";
  const oldSeafarerDeclaration = "The seafarer made a separate historical declaration.";
  const text = fixture()
    .replace("Governing Law: Laws and regulations of Türkiye", "Governing Law: Original applicable law")
    .replace(contractAnnexCClauses[0].body[0], oldParagraph)
    .replace(contractEmployerDeclarationParagraphs[0], oldEmployerDeclaration)
    .replace(contractSeafarerDeclarationParagraphs[0], oldSeafarerDeclaration);
  const parsed = parseLegacyStudioContract(text);
  assert.ok(parsed);
  assert.equal(parsed.termsSections[3].rows[0][1], "Original applicable law");
  assert.equal(parsed.annexCClauses[0].body[0], oldParagraph);
  assert.equal(parsed.annexD.employerDeclarationParagraphs[0], oldEmployerDeclaration);
  assert.equal(parsed.annexD.seafarerDeclarationParagraphs[0], oldSeafarerDeclaration);
  assert.equal(parsed.annexD.employerSignatureDataUrl, "", "Missing historical signature images cannot be invented");
});

test("multiline special conditions remain intact, including internal blank lines and clause-like headings", () => {
  const specialConditions = "First agreed condition.\n\n1. A SPECIAL CONDITION\nPreserve these details.\nSalary: This is prose, not a salary field.\n\nLast condition.";
  const parsed = parseLegacyStudioContract(fixture({ specialConditions }));
  assert.ok(parsed);
  assert.equal(parsed.specialConditions, specialConditions);
});

test("line-ending normalization does not change retained source text or stored values", () => {
  const text = fixture().replaceAll("\n", "\r\n");
  const parsed = parseLegacyStudioContract(text);
  assert.ok(parsed);
  assert.equal(parsed.sourceText, text);
  assert.equal(parsed.coverSections[1].rows[1][1], "Floor 4\nOld harbour\nAthens");
});

test("arbitrary, truncated or ambiguously labelled records use the original-text fallback", () => {
  const text = fixture();
  for (const invalid of [
    null, {}, "Private employment agreement\nSalary: 5000", text.slice(0, -12), `${text}Unexpected trailing text`,
    text.replace("Yacht name: M/Y Ege Işığı", "Yacht name: M/Y Ege Işığı\nFlag state: False hidden value"),
    text.replace("OWNER / COMPANY DETAILS\n", "OWNER / COMPANY DETAILS\n\nOWNER / COMPANY DETAILS\n"),
    text.replace("2. DUTIES, JOB DESCRIPTION AND GENERAL OBLIGATIONS OF THE SEAFARER", "9. DUTIES, JOB DESCRIPTION AND GENERAL OBLIGATIONS OF THE SEAFARER"),
    text.replace("\nSignature: Electronic signature captured", "\nSignature: Unexpected signature notation"),
  ]) {
    assert.equal(parseLegacyStudioContract(invalid), null);
  }
});
