import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import ts from "typescript";
import { jsPDF } from "jspdf";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  maximumAssignedContractBytes,
  parseAssignedContractPayload,
  serializeAssignedContractPayload,
  serializeAssignedContractPdfPayload,
} from "../app/lib/contractPayload.ts";

const helperUrl = new URL("../app/lib/assignedContractPdf.ts", import.meta.url);
const payloadUrl = new URL("../app/lib/contractPayload.ts", import.meta.url);
const compiled = ts.transpileModule(await readFile(helperUrl, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
  .replaceAll('"./contractPayload"', JSON.stringify(payloadUrl.href))
  .replaceAll('import("jspdf")', `import(${JSON.stringify(import.meta.resolve("jspdf"))})`);
let moduleSequence = 0;
function loadHelper() {
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${moduleSequence++}`);
}

async function bundledFont(source) {
  assert.ok(["/fonts/NotoSans-Regular.ttf", "/fonts/NotoSans-Bold.ttf"].includes(source));
  return new Response(await readFile(new URL(`../public${source}`, import.meta.url)));
}

async function inspectPdf(blob) {
  assert.equal(blob.type, "application/pdf");
  const task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), verbosity: 0 });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const operators = await page.getOperatorList();
      const items = content.items.filter((item) => "str" in item);
      pages.push({ width: viewport.width, height: viewport.height, text: items.map((item) => item.str).join(" "), items, operators });
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

function compact(text) {
  return text.normalize("NFC").replace(/\s+/gu, "");
}

function assertA4Pages(pages) {
  for (const [index, page] of pages.entries()) {
    assert.ok(Math.abs(page.width - 595.28) < 0.1);
    assert.ok(Math.abs(page.height - 841.89) < 0.1);
    assert.ok(page.text.includes(`Page ${index + 1} of ${pages.length}`));
    for (const item of page.items.filter((item) => item.str.trim())) {
      const x = item.transform[4];
      const y = item.transform[5];
      assert.ok(x >= 45 && x + item.width <= page.width - 45, `Text fits horizontally: ${item.str}`);
      assert.ok(y >= 24 && y <= page.height - 24, `Text fits vertically: ${item.str}`);
    }
  }
}

test("new assigned records preserve exact PDF bytes independently of current fonts, profiles or templates", async (context) => {
  const doc = new jsPDF();
  doc.text("The immutable sent terms", 20, 20);
  doc.addPage();
  doc.text("The second sent page", 20, 20);
  const original = doc.output("blob");
  const payload = await serializeAssignedContractPdfPayload("Stored text for accessibility", "", original);
  const parsed = parseAssignedContractPayload(payload);
  assert.equal(parsed.documentVersion, 2);
  assert.equal(parsed.contractText, "Stored text for accessibility");
  context.mock.method(globalThis, "fetch", () => { throw new Error("Snapshot export must not fetch assets"); });
  const { createAssignedContractPdf } = await loadHelper();
  const firstCopy = await createAssignedContractPdf(payload);
  const secondCopy = await createAssignedContractPdf(payload);
  assert.deepEqual(new Uint8Array(await firstCopy.arrayBuffer()), new Uint8Array(await original.arrayBuffer()));
  assert.deepEqual(new Uint8Array(await secondCopy.arrayBuffer()), new Uint8Array(await original.arrayBuffer()));
  const pages = await inspectPdf(firstCopy);
  assert.equal(pages.length, 2);
  assert.match(pages[0].text, /The immutable sent terms/);
  assert.match(pages[1].text, /The second sent page/);
  assert.doesNotMatch(pages.map((page) => page.text).join(" "), /Stored text for accessibility|signed|acceptance/i);
});

test("keeps historical plain text and v1 records readable without inventing a PDF snapshot", () => {
  assert.deepEqual(parseAssignedContractPayload("Terms recorded before PDFs"), {
    contractText: "Terms recorded before PDFs", employerSignatureDataUrl: "", pdfBase64: "", documentVersion: 0,
  });
  assert.equal(serializeAssignedContractPayload("Old terms", "invalid signature"), "Old terms");
  const signature = "data:image/png;base64,aGVsbG8=";
  const v1 = serializeAssignedContractPayload("Original terms", signature);
  assert.deepEqual(parseAssignedContractPayload(v1), {
    contractText: "Original terms", employerSignatureDataUrl: signature, pdfBase64: "", documentVersion: 1,
  });
  assert.equal(parseAssignedContractPayload('{"unrelated":"Original contract text"}').documentVersion, 0);
});

test("rejects damaged or unsupported snapshots instead of silently regenerating different terms", async () => {
  const base = { kind: "bluedeck.assigned-contract", version: 2, contractText: "Do not substitute this", employerSignatureDataUrl: "", pdfBase64: btoa("%PDF-1.4\n") };
  const { createAssignedContractPdf } = await loadHelper();
  for (const invalid of [
    { ...base, pdfBase64: "" },
    { ...base, pdfBase64: "not-base64!" },
    { ...base, pdfBase64: `${base.pdfBase64}\n` },
    { ...base, pdfBase64: btoa("<html>not a PDF</html>") },
    { ...base, pdfBase64: "JVBERi0xLjR=" }, // Noncanonical padding bits.
    { ...base, version: 3 },
    { ...base, contractText: null },
    { ...base, employerSignatureDataUrl: "javascript:alert(1)" },
    { ...base, employerSignatureDataUrl: undefined },
  ]) {
    assert.throws(() => parseAssignedContractPayload(JSON.stringify(invalid)), /saved contract/i);
    await assert.rejects(createAssignedContractPdf(JSON.stringify(invalid)), /saved contract/i);
  }
  assert.throws(() => parseAssignedContractPayload('{"kind":"bluedeck.assigned-contract","version":2,'), /damaged/);
  await assert.rejects(serializeAssignedContractPdfPayload("Terms", "", new Blob(["not a pdf"])), /could not be prepared/);
});

test("enforces the actual complete UTF-8 database limit before sending", async () => {
  const pdf = new Blob(["%PDF-1.4\nexample"], { type: "application/pdf" });
  const empty = await serializeAssignedContractPdfPayload("", "", pdf);
  const remaining = maximumAssignedContractBytes - new TextEncoder().encode(empty).byteLength;
  const exactText = "é".repeat(Math.floor(remaining / 2)) + (remaining % 2 ? "a" : "");
  const exact = await serializeAssignedContractPdfPayload(exactText, "", pdf);
  assert.equal(new TextEncoder().encode(exact).byteLength, maximumAssignedContractBytes);
  assert.equal(parseAssignedContractPayload(exact).contractText, exactText);
  await assert.rejects(serializeAssignedContractPdfPayload(`${exactText}é`, "", pdf), /size limit/);
  assert.throws(() => parseAssignedContractPayload(`${exact} `), /size limit/);
  await assert.rejects(serializeAssignedContractPdfPayload("Terms", "", new Blob([new Uint8Array(maximumAssignedContractBytes)])), /size limit/);
});

test("legacy PDF preserves Unicode and every long paragraph across A4 pages without clipping", async (context) => {
  context.mock.method(globalThis, "fetch", bundledFont);
  const { createAssignedContractPdf } = await loadHelper();
  const lines = Array.from({ length: 130 }, (_, index) => `Clause ${String(index + 1).padStart(3, "0")}: Şule Öztürk, Ana María, Γιώργος — agreed salary €2,500. ${"Original recorded conditions ".repeat(4)}`);
  const original = lines.join("\n\n");
  const pages = await inspectPdf(await createAssignedContractPdf(original));
  assert.ok(pages.length > 3);
  assertA4Pages(pages);
  const text = compact(pages.map((page) => page.text).join(" "));
  for (const line of lines) assert.ok(text.includes(compact(line)), `Complete original clause retained: ${line.slice(0, 12)}`);
  assert.doesNotMatch(text, /ANNEXC|SEAFAREREMPLOYMENTAGREEMENT/);
});

test("legacy v1 PDF retains the stored employer signature on the final page", async (context) => {
  context.mock.method(globalThis, "fetch", bundledFont);
  const { createAssignedContractPdf } = await loadHelper();
  const png = await sharp({ create: { width: 120, height: 40, channels: 4, background: { r: 4, g: 45, b: 73, alpha: 1 } } }).png().toBuffer();
  const payload = serializeAssignedContractPayload("Only these original employment terms", `data:image/png;base64,${png.toString("base64")}`);
  const pages = await inspectPdf(await createAssignedContractPdf(payload));
  assertA4Pages(pages);
  assert.match(pages[0].text, /Only these original employment terms/);
  assert.match(pages.at(-1).text, /Employer \/ Authorised Signatory/);
  assert.ok(pages.at(-1).operators.fnArray.some((operator) => [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(operator)), "Signature remains an embedded image");
});

test("studio font aliases retain Unicode in every existing heading and body style", async (context) => {
  let fontRequests = 0;
  context.mock.method(globalThis, "fetch", async (source) => {
    fontRequests += 1;
    return bundledFont(source);
  });
  const { installContractPdfFonts } = await loadHelper();
  const originalText = "Şule Öztürk · Γιώργος · €2,500 · Ana María";
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true, putOnlyUsedFonts: true });
    await installContractPdfFonts(doc, originalText, ["helvetica", "times"]);
    let y = 80;
    for (const family of ["helvetica", "times"]) {
      for (const style of ["normal", "bold"]) {
        doc.setFont(family, style);
        doc.setFontSize(10);
        doc.text(`${family} ${style}: ${originalText}`, 46, y);
        y += 22;
      }
    }
    const pages = await inspectPdf(doc.output("blob"));
    for (const family of ["helvetica", "times"]) {
      for (const style of ["normal", "bold"]) {
        assert.ok(pages[0].text.includes(`${family} ${style}: ${originalText}`));
      }
    }
  }
  assert.equal(fontRequests, 2, "Successful font downloads are shared by subsequent exports");
  await assert.rejects(installContractPdfFonts(new jsPDF(), "Missing character 🛥", ["helvetica", "times"]), /cannot display/);
});

test("a failed font request can recover and never replaces Unicode with an unsafe fallback font", async (context) => {
  let failing = true;
  const calls = [];
  context.mock.method(globalThis, "fetch", async (source, options) => {
    calls.push(source);
    assert.ok(options.signal instanceof AbortSignal);
    return failing ? new Response("unavailable", { status: 503 }) : bundledFont(source);
  });
  const { createAssignedContractPdf } = await loadHelper();
  await assert.rejects(createAssignedContractPdf("Özgün sözleşme"), /fonts could not be loaded/);
  failing = false;
  const pages = await inspectPdf(await createAssignedContractPdf("Özgün sözleşme"));
  assert.match(pages[0].text, /Özgün sözleşme/);
  assert.equal(calls.length, 4, "Both fonts are retried after failure");
});

test("font downloads stop after ten seconds and allow a fresh retry", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let failing = true;
  const signals = [];
  context.mock.method(globalThis, "fetch", (source, options) => {
    signals.push(options.signal);
    return failing ? new Promise(() => undefined) : bundledFont(source);
  });
  const { createAssignedContractPdf } = await loadHelper();
  const rejected = assert.rejects(createAssignedContractPdf("Stored terms"), /fonts could not be loaded/);
  context.mock.timers.tick(10_000);
  await rejected;
  assert.ok(signals.every((signal) => signal.aborted));
  context.mock.timers.reset();
  failing = false;
  const pages = await inspectPdf(await createAssignedContractPdf("Stored terms"));
  assert.match(pages[0].text, /Stored terms/);
});

test("fails visibly when a legacy character cannot be represented instead of deleting terms", async (context) => {
  context.mock.method(globalThis, "fetch", bundledFont);
  const { createAssignedContractPdf } = await loadHelper();
  await assert.rejects(createAssignedContractPdf("Original terms 🛥"), /cannot display/);
});

test("download names remain local PDF filenames with no path components", async () => {
  const { assignedContractFileName } = await loadHelper();
  assert.equal(assignedContractFileName("76fb12-abc"), "BlueDeck-contract-76fb12-abc.pdf");
  assert.equal(assignedContractFileName("../../<>"), "BlueDeck-contract-record.pdf");
  assert.ok(assignedContractFileName("a".repeat(300)).length < 110);
});
