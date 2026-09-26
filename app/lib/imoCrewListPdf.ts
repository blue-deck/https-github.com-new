import type { jsPDF } from "jspdf";
import type { ImoCrewListDraft, ImoCrewRow } from "./imoCrewList";
import {
  IMO_CREW_LIST_COLUMNS,
  IMO_CREW_LIST_SIGNATURE_LABEL,
} from "./imoCrewListLayout";

const FONT_FAMILY = "NotoSans";
const FONT_SIZE = 8;
const LINE_HEIGHT = 3.6;
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

type FieldSpec = { label: string; value: string; fraction: number };
type PreparedRow = {
  cells: Array<{ labelLines: string[]; valueLines: string[]; width: number }>;
  valueOffset: number;
  lineCount: number;
  height: number;
  emphasis: boolean;
};

/** Generate a local, printable portrait crew list with selectable text. */
export async function createImoCrewListPdf(draft: ImoCrewListDraft): Promise<Blob> {
  const [{ jsPDF: PdfDocument }, fonts] = await Promise.all([import("jspdf"), loadFonts()]);
  const doc = new PdfDocument({
    orientation: "portrait",
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
  const voyage = draft.voyage;
  const setBodyFont = (emphasis = false) => {
    doc.setFont(FONT_FAMILY, emphasis ? "bold" : "normal");
    doc.setFontSize(emphasis ? 8.5 : FONT_SIZE);
    doc.setTextColor(25, 31, 39);
  };
  setBodyFont();
  const font = doc.getFont().metadata as { characterToGlyph(codePoint: number): number };
  const visibleValues = [
    ...Object.values(voyage),
    ...draft.crew.flatMap((row) => IMO_CREW_LIST_COLUMNS.flatMap((column) =>
      column.key === "sequence" ? [] : [row[column.key]],
    )),
  ];
  const characters = new Set(Array.from(visibleValues.map(plainText).join("")));
  for (const character of characters) {
    if (font.characterToGlyph(character.codePointAt(0)!) === 0) {
      throw new Error("The PDF font cannot display one or more characters. Please use the Latin spelling from the travel document.");
    }
  }

  const prepareRow = (fields: FieldSpec[], emphasis = false): PreparedRow => {
    const cells = fields.map((field) => {
      const cellWidth = width * field.fraction;
      doc.setFont(FONT_FAMILY, "bold");
      doc.setFontSize(6.7);
      const labelLines = wrap(doc, field.label, cellWidth - CELL_PADDING * 2);
      setBodyFont(emphasis);
      return {
        width: cellWidth,
        labelLines,
        valueLines: wrap(doc, field.value, cellWidth - CELL_PADDING * 2),
      };
    });
    // Labels and values are measured using their own fonts before layout.
    const labelCount = Math.max(...cells.map((cell) => cell.labelLines.length));
    const lineCount = Math.max(...cells.map((cell) => cell.valueLines.length));
    const valueOffset = 4.3 + labelCount * 2.7;
    return { cells, valueOffset, lineCount, height: valueOffset + lineCount * LINE_HEIGHT, emphasis };
  };

  const headerRows = [
    prepareRow([
      { label: "1.1 Name of ship", value: voyage.shipName, fraction: 0.6 },
      { label: "1.2 IMO number", value: voyage.imoNumber, fraction: 0.4 },
    ]),
    prepareRow([
      { label: "1.3 Call sign", value: voyage.callSign, fraction: 0.5 },
      { label: "1.4 Voyage number", value: voyage.voyageNumber, fraction: 0.5 },
    ]),
    prepareRow([
      { label: "2. Port of arrival / departure", value: voyage.portOfArrivalDeparture, fraction: 0.65 },
      { label: "3. Date of arrival / departure", value: formatPdfDate(voyage.arrivalDepartureDate), fraction: 0.35 },
    ]),
    prepareRow([
      { label: "4. Flag State of ship", value: voyage.flagState, fraction: 0.5 },
      { label: "5. Last port of call", value: voyage.lastPort, fraction: 0.5 },
    ]),
  ];

  const signaturePadding = 3;
  const signatureGap = 5;
  const signatureFieldUnit = (width - signaturePadding * 2 - signatureGap * 2) / 2.9;
  const signatureFieldWidths = [signatureFieldUnit * 1.25, signatureFieldUnit * 0.65, signatureFieldUnit];
  setBodyFont();
  const masterLines = wrap(doc, voyage.masterName, signatureFieldWidths[0]);
  doc.setFont(FONT_FAMILY, "bold");
  doc.setFontSize(7.2);
  const signatureTitleLines = wrap(doc, IMO_CREW_LIST_SIGNATURE_LABEL, width - signaturePadding * 2);
  const signatureTitleExtra = (signatureTitleLines.length - 1) * LINE_HEIGHT;
  const signatureUnderlineOffset = 13 + signatureTitleExtra + Math.max(7, masterLines.length * LINE_HEIGHT + 2);
  const signatureHeight = signatureUnderlineOffset + signaturePadding;
  const contentBottom = pageHeight - MARGIN - signatureHeight - 9;
  let contentTop = 0;
  let y = 0;

  const drawRow = (row: PreparedRow, offset = 0, count = row.lineCount) => {
    const height = row.valueOffset + count * LINE_HEIGHT;
    let x = MARGIN;
    row.cells.forEach((cell) => {
      doc.setDrawColor(105, 115, 127);
      doc.setLineWidth(0.18);
      if (row.emphasis) {
        doc.setFillColor(244, 246, 248);
        doc.rect(x, y, cell.width, height, "FD");
      } else {
        doc.rect(x, y, cell.width, height);
      }
      doc.setFont(FONT_FAMILY, "bold");
      doc.setFontSize(6.7);
      doc.setTextColor(70, 79, 89);
      drawLines(doc, cell.labelLines, x + CELL_PADDING, y + 3.2, 2.7);
      setBodyFont(row.emphasis);
      drawLines(doc, cell.valueLines.slice(offset, offset + count), x + CELL_PADDING, y + row.valueOffset);
      x += cell.width;
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
    headerRows.forEach((row) => drawRow(row));
    y += 4;
    contentTop = y;
    setBodyFont();
    if (contentBottom - contentTop < 50) {
      throw new Error("The voyage or master details are too long for the crew list. Please shorten those fields.");
    }
  };

  const newPage = () => {
    doc.addPage();
    drawPageHeader();
  };

  const prepareCrew = (crew?: ImoCrewRow, index?: number) => [
    prepareRow([
      { label: "6. No.", value: index === undefined ? "" : String(index + 1), fraction: 0.08 },
      { label: "7. Full name", value: crew?.fullName ?? "", fraction: 0.92 },
    ], true),
    prepareRow([
      { label: "8. Rank or rating", value: crew?.rank ?? "", fraction: 0.4 },
      { label: "9. Nationality", value: crew?.nationality ?? "", fraction: 0.4 },
      { label: "12. Gender", value: crew?.gender ?? "", fraction: 0.2 },
    ]),
    prepareRow([
      { label: "10. Date of birth", value: formatPdfDate(crew?.dateOfBirth ?? ""), fraction: 0.35 },
      { label: "11. Place of birth", value: crew?.placeOfBirth ?? "", fraction: 0.65 },
    ]),
    prepareRow([
      { label: "13. Document type", value: crew?.documentType ?? "", fraction: 0.28 },
      { label: "14. Document number", value: crew?.documentNumber ?? "", fraction: 0.44 },
      { label: "15. Expiry date", value: formatPdfDate(crew?.documentExpiry ?? ""), fraction: 0.28 },
    ]),
  ];

  const drawContinuation = (index: number) => {
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(7);
    doc.setTextColor(70, 79, 89);
    doc.text(`Crew member ${index + 1} - continued`, MARGIN, y + 3.2);
    y += 6;
  };

  drawPageHeader();
  if (draft.crew.length === 0) {
    const rows = prepareCrew();
    const height = rows.reduce((total, row) => total + row.height, 0);
    const blankCount = Math.max(1, Math.floor((contentBottom - contentTop + 3) / (height + 3)));
    for (let index = 0; index < blankCount; index += 1) {
      rows.forEach((row) => drawRow(row));
      y += 3;
    }
  } else {
    draft.crew.forEach((crew, index) => {
      const rows = prepareCrew(crew, index);
      const height = rows.reduce((total, row) => total + row.height, 0);
      // An ordinary crew entry stays together. Oversized entries continue with
      // repeated field labels and a crew-number marker, without dropping text.
      if (y + height > contentBottom && y > contentTop) newPage();
      rows.forEach((row) => {
        if (y + row.height > contentBottom && row.height <= contentBottom - contentTop - 6) {
          newPage();
          drawContinuation(index);
        }
        let offset = 0;
        while (offset < row.lineCount) {
          let availableLines = Math.floor((contentBottom - y - row.valueOffset) / LINE_HEIGHT);
          if (availableLines < 1) {
            newPage();
            drawContinuation(index);
            availableLines = Math.floor((contentBottom - y - row.valueOffset) / LINE_HEIGHT);
          }
          const count = Math.min(row.lineCount - offset, availableLines);
          drawRow(row, offset, count);
          offset += count;
          if (offset < row.lineCount) {
            newPage();
            drawContinuation(index);
          }
        }
      });
      y += 3;
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const signatureY = contentBottom + 4;
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(25, 31, 39);
    doc.setDrawColor(90, 99, 112);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, signatureY, width, signatureHeight);
    drawLines(doc, signatureTitleLines, MARGIN + signaturePadding, signatureY + 4.3);
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
      doc.text(field.label, signatureX, signatureY + 10.5 + signatureTitleExtra);
      setBodyFont();
      drawLines(doc, field.lines, signatureX, signatureY + 15 + signatureTitleExtra);
      doc.setDrawColor(156, 162, 168);
      doc.setLineWidth(0.15);
      doc.line(signatureX, signatureY + signatureUnderlineOffset, signatureX + signatureFieldWidths[index], signatureY + signatureUnderlineOffset);
      signatureX += signatureFieldWidths[index] + signatureGap;
    });
    setBodyFont();
    doc.setFontSize(6.5);
    doc.setTextColor(88, 97, 109);
    doc.text("Prepared in BlueDeck", MARGIN, pageHeight - MARGIN);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - MARGIN, { align: "right" });
  }

  return doc.output("blob");
}
