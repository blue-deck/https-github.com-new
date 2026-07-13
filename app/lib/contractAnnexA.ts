import type { jsPDF } from "jspdf";

export type ContractAnnexASection = {
  title: string;
  rows: Array<[string, string | undefined | null]>;
  footer?: string;
  wideFirstRows?: number;
};

const SECTION_X = 42;
const SECTION_START_Y = 82;
const SECTION_GAP = 12;
const SECTION_HEADER_HEIGHT = 38;
const FIELD_START_OFFSET = 55;
const FIELD_ROW_PITCH = 37;
const FIELD_HEIGHT = 23;
const FIELD_TOP_GAP = 7;
const SECTION_BOTTOM_PADDING = 13;

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function setFill(doc: jsPDF, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setStroke(doc: jsPDF, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  doc.setDrawColor(r, g, b);
}

function setText(doc: jsPDF, hex: string) {
  const { r, g, b } = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function displayValue(value: string | undefined | null, emptyWhenMissing: boolean) {
  return String(value || "").trim() || (emptyWhenMissing ? "" : "-");
}

function getSectionRowCount(section: ContractAnnexASection) {
  const wideRows = Math.min(section.wideFirstRows || 0, section.rows.length);
  return wideRows + Math.ceil((section.rows.length - wideRows) / 2);
}

function getSectionHeight(section: ContractAnnexASection) {
  const rowCount = getSectionRowCount(section);
  const fieldRowsHeight = rowCount
    ? (rowCount - 1) * FIELD_ROW_PITCH + FIELD_TOP_GAP + FIELD_HEIGHT
    : 0;
  const footerHeight = section.footer ? 18 : 0;
  return FIELD_START_OFFSET + fieldRowsHeight + SECTION_BOTTOM_PADDING + footerHeight;
}

function drawField(
  doc: jsPDF,
  label: string,
  value: string | undefined | null,
  x: number,
  y: number,
  width: number,
  emptyWhenMissing: boolean
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.3);
  setText(doc, "#082759");
  doc.text(label.toUpperCase(), x, y);

  setStroke(doc, "#9ec4ed");
  setFill(doc, "#ffffff");
  doc.setLineWidth(0.55);
  doc.roundedRect(x, y + FIELD_TOP_GAP, width, FIELD_HEIGHT, 4, 4, "FD");

  const fieldValue = displayValue(value, emptyWhenMissing);
  if (!fieldValue) return;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.6);
  setText(doc, "#17233a");
  const availableWidth = width - 14;
  const valueWidth = doc.getTextWidth(fieldValue);
  doc.text(fieldValue, x + 7, y + 23, {
    horizontalScale: valueWidth > availableWidth ? availableWidth / valueWidth : 1,
  });
}

function drawSection(
  doc: jsPDF,
  section: ContractAnnexASection,
  y: number,
  width: number
) {
  const height = getSectionHeight(section);
  const isCrewMemberDetails = section.title.toLowerCase() === "crew member details";

  setStroke(doc, "#c4d9ee");
  setFill(doc, "#ffffff");
  doc.setLineWidth(0.75);
  doc.roundedRect(SECTION_X, y, width, height, 9, 9, "FD");

  setFill(doc, "#fbfdff");
  doc.rect(SECTION_X + 0.6, y + 0.6, width - 1.2, SECTION_HEADER_HEIGHT - 0.6, "F");
  setStroke(doc, "#d8e7f5");
  doc.setLineWidth(0.45);
  doc.line(SECTION_X, y + SECTION_HEADER_HEIGHT, SECTION_X + width, y + SECTION_HEADER_HEIGHT);

  doc.setFont("times", "bold");
  doc.setFontSize(17.5);
  setText(doc, "#082759");
  doc.text(section.title.toUpperCase(), SECTION_X + 18, y + 27.5);

  const fieldGap = 18;
  const contentWidth = width - 52;
  const colWidth = (contentWidth - fieldGap) / 2;
  const wideRows = Math.min(section.wideFirstRows || 0, section.rows.length);
  let fieldY = y + FIELD_START_OFFSET;

  section.rows.forEach(([label, value], index) => {
    const fullWidth = index < wideRows;
    const pairIndex = index - wideRows;
    const isLeft = pairIndex % 2 === 0;
    const fieldX = SECTION_X + 26 + (fullWidth || isLeft ? 0 : colWidth + fieldGap);

    drawField(
      doc,
      label,
      value,
      fieldX,
      fieldY,
      fullWidth ? contentWidth : colWidth,
      isCrewMemberDetails
    );

    if (fullWidth || !isLeft) fieldY += FIELD_ROW_PITCH;
  });

  if (section.footer) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    setText(doc, "#4f6680");
    doc.text(section.footer, SECTION_X + 26, y + height - 13);
  }

  return height;
}

export function drawContractAnnexAPage(
  doc: jsPDF,
  sections: ContractAnnexASection[],
  drawPageHeader: (subtitle: string) => void
) {
  doc.addPage();
  drawPageHeader("ANNEX A - PARTIES");

  const pageWidth = doc.internal.pageSize.getWidth();
  const sectionWidth = pageWidth - SECTION_X * 2;
  let y = SECTION_START_Y;

  sections.forEach((section, index) => {
    y += drawSection(doc, section, y, sectionWidth);
    if (index < sections.length - 1) y += SECTION_GAP;
  });
}
