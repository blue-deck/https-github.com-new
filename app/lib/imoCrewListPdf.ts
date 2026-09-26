import type { jsPDF } from "jspdf";
import type { ImoCrewListDraft } from "./imoCrewList";
import {
  IMO_CREW_LIST_COLUMNS,
  IMO_CREW_LIST_CONTENT_WIDTH,
  IMO_CREW_LIST_DOCUMENT_COLUMN_INDEX,
  IMO_CREW_LIST_DOCUMENT_GROUP_LABEL,
  IMO_CREW_LIST_SIGNATURE_LABEL,
} from "./imoCrewListLayout";

const FONT_FAMILY = "NotoSans";
const FONT_SIZE = 7.5;
const LINE_HEIGHT = 3.5;
const CELL_PADDING = 1.8;
const MARGIN = 10;

let fontDataPromise: Promise<[string, string]> | undefined;

async function loadFont(source: string): Promise<string> {
  const response = await fetch(source, { cache: "force-cache" });
  if (!response.ok) throw new Error("PDF fonts could not be loaded. Please try again.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function loadFonts(): Promise<[string, string]> {
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

function plainText(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function formatPdfDate(value: string): string {
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
}

function wrap(doc: jsPDF, value: string, width: number): string[] {
  return value ? (doc.splitTextToSize(plainText(value), width) as string[]) : [""];
}

function drawLines(doc: jsPDF, lines: string[], x: number, y: number, lineHeight = LINE_HEIGHT) {
  // Explicit line placement keeps table measurement and rendering in the same units.
  lines.forEach((line, index) => {
    if (line) doc.text(line, x, y + index * lineHeight);
  });
}

/** Generate a local, printable IMO FAL Form 5 preparation document. */
export async function createImoCrewListPdf(draft: ImoCrewListDraft): Promise<Blob> {
  const [{ jsPDF: PdfDocument }, fonts] = await Promise.all([import("jspdf"), loadFonts()]);
  const doc = new PdfDocument({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });
  doc.addFileToVFS("NotoSans-Regular.ttf", fonts[0]);
  doc.addFont("NotoSans-Regular.ttf", FONT_FAMILY, "normal");
  doc.addFileToVFS("NotoSans-Bold.ttf", fonts[1]);
  doc.addFont("NotoSans-Bold.ttf", FONT_FAMILY, "bold");
  doc.setProperties({
    title: "Crew List - IMO FAL Form 5",
    subject: "Crew list preparation document",
    creator: "BlueDeck",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth - MARGIN * 2;
  // Account for the small decimal difference between the A4 width and 297 mm.
  const columns = IMO_CREW_LIST_COLUMNS.map((column) => ({
    ...column,
    width: column.width * width / IMO_CREW_LIST_CONTENT_WIDTH,
  }));
  const voyage = draft.voyage;

  const setBodyFont = () => {
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(FONT_SIZE);
    doc.setTextColor(25, 31, 39);
  };
  setBodyFont();
  const font = doc.getFont().metadata as { characterToGlyph(codePoint: number): number };
  const visibleValues = [
    ...Object.values(voyage),
    ...draft.crew.flatMap((row) => columns.flatMap((column) =>
      column.key === "sequence" ? [] : [row[column.key]],
    )),
  ];
  const characters = new Set(Array.from(visibleValues.map(plainText).join("")));
  for (const character of characters) {
    if (font.characterToGlyph(character.codePointAt(0)!) === 0) {
      throw new Error("The PDF font cannot display one or more characters. Please use the Latin spelling from the travel document.");
    }
  }
  const signaturePadding = 3;
  const signatureGap = 7;
  const signatureFieldUnit = (width - signaturePadding * 2 - signatureGap * 2) / 2.9;
  const signatureFieldWidths = [signatureFieldUnit * 1.25, signatureFieldUnit * 0.65, signatureFieldUnit];
  const masterLines = wrap(doc, voyage.masterName, signatureFieldWidths[0]);
  const signatureUnderlineOffset = 13 + Math.max(7, masterLines.length * LINE_HEIGHT + 2);
  const signatureHeight = signatureUnderlineOffset + signaturePadding;
  const tableBottom = pageHeight - MARGIN - signatureHeight - 9;
  let tableTop = 0;
  let y = 0;

  const drawVoyageRow = (fields: Array<{ label: string; value: string; fraction: number }>) => {
    setBodyFont();
    const prepared = fields.map((field) => ({
      ...field,
      width: width * field.fraction,
      lines: wrap(doc, field.value, width * field.fraction - CELL_PADDING * 2),
    }));
    const height = Math.max(11, Math.max(...prepared.map((field) => field.lines.length)) * LINE_HEIGHT + 7.5);
    let x = MARGIN;
    prepared.forEach((field) => {
      doc.rect(x, y, field.width, height);
      doc.setFont(FONT_FAMILY, "bold");
      doc.setFontSize(6.7);
      doc.text(field.label, x + CELL_PADDING, y + 3.6);
      setBodyFont();
      drawLines(doc, field.lines, x + CELL_PADDING, y + 7.5);
      x += field.width;
    });
    y += height;
  };

  const drawPageHeader = () => {
    doc.setDrawColor(90, 99, 112);
    doc.setLineWidth(0.2);
    doc.setTextColor(20, 28, 38);
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(15);
    doc.text("CREW LIST", MARGIN, 12);
    doc.setFontSize(9);
    doc.text("IMO FAL Form 5", pageWidth - MARGIN, 12, { align: "right" });
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(7.5);
    doc.text("Arrival", MARGIN + 5, 18);
    doc.text("Departure", MARGIN + 32, 18);
    ["arrival", "departure"].forEach((movement, index) => {
      const x = MARGIN + index * 27;
      doc.rect(x, 15.1, 3.5, 3.5);
      if (voyage.movement === movement) {
        doc.line(x + 0.6, 15.7, x + 2.9, 18);
        doc.line(x + 2.9, 15.7, x + 0.6, 18);
      }
    });
    y = 22;
    drawVoyageRow([
      { label: "1.1 Name of ship", value: voyage.shipName, fraction: 0.4 },
      { label: "1.2 IMO number", value: voyage.imoNumber, fraction: 0.2 },
      { label: "1.3 Call sign", value: voyage.callSign, fraction: 0.2 },
      { label: "1.4 Voyage number", value: voyage.voyageNumber, fraction: 0.2 },
    ]);
    drawVoyageRow([
      { label: "2. Port of arrival / departure", value: voyage.portOfArrivalDeparture, fraction: 0.65 },
      { label: "3. Date of arrival / departure", value: formatPdfDate(voyage.arrivalDepartureDate), fraction: 0.35 },
    ]);
    drawVoyageRow([
      { label: "4. Flag State of ship", value: voyage.flagState, fraction: 0.5 },
      { label: "5. Last port of call", value: voyage.lastPort, fraction: 0.5 },
    ]);
    y += 3;
    const headerHeight = 15.5;
    let x = MARGIN;
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(7);
    doc.setFillColor(244, 246, 248);
    doc.rect(MARGIN, y, width, headerHeight, "F");
    columns.forEach((column, index) => {
      const groupHeight = index >= IMO_CREW_LIST_DOCUMENT_COLUMN_INDEX ? 5 : 0;
      doc.rect(x, y + groupHeight, column.width, headerHeight - groupHeight);
      const label = wrap(doc, column.label, column.width - CELL_PADDING * 2);
      drawLines(doc, label, x + CELL_PADDING, y + groupHeight + 4.4, 3.25);
      x += column.width;
    });
    const identityStart = MARGIN + columns.slice(0, IMO_CREW_LIST_DOCUMENT_COLUMN_INDEX)
      .reduce((total, column) => total + column.width, 0);
    doc.rect(identityStart, y, pageWidth - MARGIN - identityStart, 5);
    doc.text(IMO_CREW_LIST_DOCUMENT_GROUP_LABEL, identityStart + CELL_PADDING, y + 3.5);
    y += headerHeight;
    tableTop = y;
    setBodyFont();
    if (tableBottom - tableTop < 15) {
      throw new Error("The voyage or master details are too long for the crew list. Please shorten those fields.");
    }
  };

  const newPage = () => {
    doc.addPage();
    drawPageHeader();
  };

  const drawCrewCells = (cells: string[][], lineOffset: number, lineCount: number, height: number) => {
    let x = MARGIN;
    columns.forEach((column, index) => {
      doc.rect(x, y, column.width, height);
      drawLines(doc, cells[index].slice(lineOffset, lineOffset + lineCount), x + CELL_PADDING, y + 4.2);
      x += column.width;
    });
    y += height;
  };

  drawPageHeader();
  if (draft.crew.length === 0) {
    const blankRows = Math.max(1, Math.floor((tableBottom - tableTop) / 9));
    for (let index = 0; index < blankRows; index += 1) {
      drawCrewCells(columns.map(() => [""]), 0, 1, 9);
    }
  } else {
    draft.crew.forEach((crew, index) => {
      const cells = columns.map((column) => wrap(
        doc,
        column.key === "sequence"
          ? String(index + 1)
          : column.key === "dateOfBirth" || column.key === "documentExpiry"
            ? formatPdfDate(crew[column.key])
            : crew[column.key],
        column.width - CELL_PADDING * 2,
      ));
      const lineCount = Math.max(...cells.map((cell) => cell.length));
      const rowHeight = Math.max(7, lineCount * LINE_HEIGHT + CELL_PADDING * 2);
      // Keep ordinary rows together; exceptionally long cells continue over pages.
      if (y + rowHeight > tableBottom && y > tableTop) newPage();
      let offset = 0;
      while (offset < lineCount) {
        const availableLines = Math.max(1, Math.floor((tableBottom - y - CELL_PADDING * 2) / LINE_HEIGHT));
        const count = Math.min(lineCount - offset, availableLines);
        const height = Math.max(7, count * LINE_HEIGHT + CELL_PADDING * 2);
        drawCrewCells(cells, offset, count, height);
        offset += count;
        if (offset < lineCount) newPage();
      }
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const signatureY = tableBottom + 4;
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(25, 31, 39);
    doc.setDrawColor(90, 99, 112);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, signatureY, width, signatureHeight);
    doc.text(IMO_CREW_LIST_SIGNATURE_LABEL, MARGIN + signaturePadding, signatureY + 4.3);
    const signatureFields = [
      { label: "Name of signatory", lines: masterLines },
      { label: "Date", lines: [formatPdfDate(voyage.declarationDate)] },
      { label: "Signature", lines: [] },
    ];
    let signatureX = MARGIN + signaturePadding;
    signatureFields.forEach((field, index) => {
      doc.setFont(FONT_FAMILY, "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(69, 78, 87);
      doc.text(field.label, signatureX, signatureY + 10.5);
      setBodyFont();
      drawLines(doc, field.lines, signatureX, signatureY + 15);
      doc.setDrawColor(156, 162, 168);
      doc.setLineWidth(0.15);
      doc.line(signatureX, signatureY + signatureUnderlineOffset, signatureX + signatureFieldWidths[index], signatureY + signatureUnderlineOffset);
      signatureX += signatureFieldWidths[index] + signatureGap;
    });
    setBodyFont();
    doc.setFontSize(6.5);
    doc.setTextColor(88, 97, 109);
    doc.text("Prepared in BlueDeck | Dates: DD/MM/YYYY", MARGIN, pageHeight - MARGIN);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - MARGIN, { align: "right" });
  }

  return doc.output("blob");
}
