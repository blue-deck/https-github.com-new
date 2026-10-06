import type { jsPDF } from "jspdf";
import { parseAssignedContractPayload } from "./contractPayload";

const fontFamily = "NotoSans";
const fontTimeoutMs = 10_000;
const maximumLegacyPages = 500;
let fontDataPromise: Promise<[string, string]> | undefined;

async function loadFont(source: string): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("PDF fonts could not be loaded. Please check your connection and try again."));
    }, fontTimeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(source, { cache: "force-cache", signal: controller.signal });
        if (!response.ok) throw new Error("PDF fonts could not be loaded. Please try again.");
        const bytes = new Uint8Array(await response.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 8192) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        }
        return btoa(binary);
      })(),
      deadline,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function loadFonts() {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all([
      loadFont("/fonts/NotoSans-Regular.ttf"),
      loadFont("/fonts/NotoSans-Bold.ttf"),
    ]).catch((error: unknown) => {
      fontDataPromise = undefined;
      throw error;
    });
  }
  return fontDataPromise;
}

/** Install the same Unicode fonts for contract layouts and validate their actual text. */
export async function installContractPdfFonts(
  doc: jsPDF,
  text: string,
  aliases: string[] = [fontFamily],
): Promise<void> {
  const families = [...new Set(aliases.filter((family) => family.trim()))];
  if (!families.length) throw new Error("A contract PDF font family is required.");
  const fonts = await loadFonts();
  doc.addFileToVFS("NotoSans-Regular.ttf", fonts[0]);
  doc.addFileToVFS("NotoSans-Bold.ttf", fonts[1]);
  for (const family of families) {
    doc.addFont("NotoSans-Regular.ttf", family, "normal");
    doc.addFont("NotoSans-Bold.ttf", family, "bold");
  }

  const characters = new Set(Array.from(text));
  // Check both weights: contract section headings and body text may use either.
  for (const style of ["normal", "bold"]) {
    doc.setFont(families[0], style);
    const font = doc.getFont().metadata as { characterToGlyph?: (codePoint: number) => number };
    if (typeof font.characterToGlyph !== "function") {
      fontDataPromise = undefined;
      throw new Error("PDF fonts could not be prepared. Please try again.");
    }
    for (const character of characters) {
      if (!/\s/u.test(character) && font.characterToGlyph(character.codePointAt(0)!) === 0) {
        throw new Error("The contract contains characters that this PDF font cannot display. Please contact support to export the original text without losing characters.");
      }
    }
  }
  doc.setFont(families[0], "normal");
}

export function assignedContractFileName(id: string) {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return `BlueDeck-contract-${safeId || "record"}.pdf`;
}

/** Return immutable snapshot bytes, or paginate only the text retained in a legacy record. */
export async function createAssignedContractPdf(value: unknown): Promise<Blob> {
  const contract = parseAssignedContractPayload(value);
  if (contract.pdfBase64) {
    const binary = atob(contract.pdfBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: "application/pdf" });
  }

  if (!contract.contractText.trim()) throw new Error("No saved contract document is available.");
  if (/^SEAFARER EMPLOYMENT AGREEMENT\r?\nCOVER SHEET(?:\r?\n|$)/.test(contract.contractText.trimStart())) {
    const { restoreContractStudioPdf } = await import("./restoreContractStudioPdf");
    return restoreContractStudioPdf(contract.contractText, contract.employerSignatureDataUrl);
  }
  const [{ jsPDF }] = await Promise.all([import("jspdf"), loadFonts()]);
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true, putOnlyUsedFonts: true });
  doc.setProperties({ title: "Stored contract record", creator: "BlueDeck" });

  const text = contract.contractText.replace(/\r\n?/g, "\n").normalize("NFC");
  await installContractPdfFonts(doc, text);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 46;
  const contentWidth = pageWidth - margin * 2;
  const contentBottom = pageHeight - 54;
  const lineHeight = 14.5;
  let y = 85;

  function header() {
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(12);
    doc.setTextColor(7, 31, 60);
    doc.text("CONTRACT RECORD", margin, 34);
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8);
    doc.setTextColor(83, 103, 121);
    doc.text("Copy of previously stored contract text", margin, 49);
    doc.setDrawColor(206, 220, 230);
    doc.setLineWidth(0.6);
    doc.line(margin, 62, pageWidth - margin, 62);
    doc.setFontSize(9.5);
    doc.setTextColor(29, 43, 57);
    y = 85;
  }

  function ensureSpace(height: number) {
    if (y + height <= contentBottom) return;
    if (doc.getNumberOfPages() >= maximumLegacyPages) {
      throw new Error("This saved contract is too long to export in the browser. Please contact support.");
    }
    doc.addPage();
    header();
  }

  header();
  for (const originalLine of text.split("\n")) {
    // Existing terms are never reconstructed from today's template or profile.
    // Hard line breaks are retained; only visual wrapping and tab spacing change.
    const rows = originalLine ? doc.splitTextToSize(originalLine.replace(/\t/g, "    "), contentWidth) as string[] : [""];
    for (const row of rows) {
      ensureSpace(lineHeight);
      if (row) doc.text(row, margin, y);
      y += lineHeight;
    }
  }

  if (contract.employerSignatureDataUrl) {
    const image = doc.getImageProperties(contract.employerSignatureDataUrl);
    const scale = Math.min(240 / image.width, 88 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    ensureSpace(height + 44);
    y += 12;
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(9);
    doc.text("Employer / Authorised Signatory", margin, y);
    y += 12;
    doc.addImage(contract.employerSignatureDataUrl, "PNG", margin, y, width, height);
  }

  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(206, 220, 230);
    doc.line(margin, pageHeight - 39, pageWidth - margin, pageHeight - 39);
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8);
    doc.setTextColor(83, 103, 121);
    doc.text("BlueDeck", margin, pageHeight - 25);
    doc.text(`Page ${page} of ${count}`, pageWidth - margin, pageHeight - 25, { align: "right" });
  }
  return doc.output("blob");
}
