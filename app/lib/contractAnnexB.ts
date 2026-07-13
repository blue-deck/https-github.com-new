import type { jsPDF } from "jspdf";

export type ContractAnnexBSection = {
  title: string;
  rows: Array<[string, string | undefined | null]>;
  wideFirstRows?: number;
};

type SpecialConditionRow = {
  height: number;
  text: string;
};

const SECTION_X = 42;
const SECTION_START_Y = 80;
const SECTION_GAP = 8;
const SECTION_HEADER_HEIGHT = 36;
const FIELD_START_OFFSET = 52;
const FIELD_ROW_PITCH = 39;
const FIELD_HEIGHT = 21;
const FIELD_TOP_GAP = 6;
const SECTION_BOTTOM_PADDING = 12;
const SPECIAL_CARD_Y = 82;
const SPECIAL_CARD_BOTTOM_MARGIN = 64;
const SPECIAL_HEADER_HEIGHT = 38;
const SPECIAL_TEXT_TOP_OFFSET = 57;
const SPECIAL_TEXT_BOTTOM_PADDING = 18;
const SPECIAL_LINE_HEIGHT = 13.2;
const SPECIAL_BLANK_LINE_HEIGHT = 6.6;

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

function displayValue(value: string | undefined | null) {
  return String(value || "").trim() || "-";
}

function getSectionRowCount(section: ContractAnnexBSection) {
  const wideRows = Math.min(section.wideFirstRows || 0, section.rows.length);
  return wideRows + Math.ceil((section.rows.length - wideRows) / 2);
}

function getSectionHeight(section: ContractAnnexBSection) {
  const rowCount = getSectionRowCount(section);
  const fieldRowsHeight = rowCount
    ? (rowCount - 1) * FIELD_ROW_PITCH + FIELD_TOP_GAP + FIELD_HEIGHT
    : 0;
  return FIELD_START_OFFSET + fieldRowsHeight + SECTION_BOTTOM_PADDING;
}

function drawField(
  doc: jsPDF,
  label: string,
  value: string | undefined | null,
  x: number,
  y: number,
  width: number
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.1);
  setText(doc, "#082759");
  doc.text(label.toUpperCase(), x, y);

  setStroke(doc, "#9ec4ed");
  setFill(doc, "#ffffff");
  doc.setLineWidth(0.55);
  doc.roundedRect(x, y + FIELD_TOP_GAP, width, FIELD_HEIGHT, 4, 4, "FD");

  const fieldValue = displayValue(value);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.2);
  setText(doc, "#17233a");
  const availableWidth = width - 14;
  const valueWidth = doc.getTextWidth(fieldValue);
  doc.text(fieldValue, x + 7, y + 20.5, {
    horizontalScale: valueWidth > availableWidth ? availableWidth / valueWidth : 1,
  });
}

function drawTermsSection(
  doc: jsPDF,
  section: ContractAnnexBSection,
  y: number,
  width: number
) {
  const height = getSectionHeight(section);

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
  doc.setFontSize(16.5);
  setText(doc, "#082759");
  doc.text(section.title.toUpperCase(), SECTION_X + 18, y + 26.5);

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

    drawField(doc, label, value, fieldX, fieldY, fullWidth ? contentWidth : colWidth);
    if (fullWidth || !isLeft) fieldY += FIELD_ROW_PITCH;
  });

  return height;
}

function getSpecialConditionRows(doc: jsPDF, value: string, width: number) {
  const source = value.trim() || "-";
  const groups: SpecialConditionRow[][] = [];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.8);

  source.replace(/\r\n?/g, "\n").split("\n").forEach((line) => {
    if (!line.trim()) {
      groups.push([{ text: "", height: SPECIAL_BLANK_LINE_HEIGHT }]);
      return;
    }

    groups.push(
      (doc.splitTextToSize(line, width) as string[]).map((text) => ({
        text,
        height: SPECIAL_LINE_HEIGHT,
      }))
    );
  });

  return groups.length
    ? groups
    : [[{ text: "-", height: SPECIAL_LINE_HEIGHT }]];
}

function paginateSpecialConditions(groups: SpecialConditionRow[][], availableHeight: number) {
  const pages: SpecialConditionRow[][] = [];
  let page: SpecialConditionRow[] = [];
  let usedHeight = 0;

  function pushPage() {
    if (!page.length) return;
    pages.push(page);
    page = [];
    usedHeight = 0;
  }

  groups.forEach((group) => {
    const groupHeight = group.reduce((height, row) => height + row.height, 0);
    if (page.length && groupHeight <= availableHeight && usedHeight + groupHeight > availableHeight) {
      pushPage();
    }

    group.forEach((row) => {
      if (page.length && usedHeight + row.height > availableHeight) pushPage();
      page.push(row);
      usedHeight += row.height;
    });
  });

  if (page.length) {
      pages.push(page);
  }
  return pages.length ? pages : [[{ text: "-", height: SPECIAL_LINE_HEIGHT }]];
}

function drawSpecialConditionsCard(
  doc: jsPDF,
  rows: SpecialConditionRow[],
  pageIndex: number
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = pageWidth - SECTION_X * 2;
  const height = pageHeight - SPECIAL_CARD_Y - SPECIAL_CARD_BOTTOM_MARGIN;

  setStroke(doc, "#c4d9ee");
  setFill(doc, "#ffffff");
  doc.setLineWidth(0.75);
  doc.roundedRect(SECTION_X, SPECIAL_CARD_Y, width, height, 9, 9, "FD");

  setFill(doc, "#fbfdff");
  doc.rect(
    SECTION_X + 0.6,
    SPECIAL_CARD_Y + 0.6,
    width - 1.2,
    SPECIAL_HEADER_HEIGHT - 0.6,
    "F"
  );
  setStroke(doc, "#d8e7f5");
  doc.setLineWidth(0.45);
  doc.line(
    SECTION_X,
    SPECIAL_CARD_Y + SPECIAL_HEADER_HEIGHT,
    SECTION_X + width,
    SPECIAL_CARD_Y + SPECIAL_HEADER_HEIGHT
  );

  doc.setFont("times", "bold");
  doc.setFontSize(16.5);
  setText(doc, "#082759");
  doc.text(
    pageIndex === 0 ? "SPECIAL CONDITIONS" : "SPECIAL CONDITIONS - CONTINUED",
    SECTION_X + 18,
    SPECIAL_CARD_Y + 26.5
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.8);
  setText(doc, "#17233a");
  let y = SPECIAL_CARD_Y + SPECIAL_TEXT_TOP_OFFSET;

  rows.forEach((row) => {
    if (row.text) doc.text(row.text, SECTION_X + 26, y);
    y += row.height;
  });
}

export function drawContractAnnexBTermsPage(
  doc: jsPDF,
  sections: ContractAnnexBSection[],
  drawPageHeader: (subtitle: string) => void
) {
  doc.addPage();
  drawPageHeader("ANNEX B - EMPLOYMENT TERMS");

  const pageWidth = doc.internal.pageSize.getWidth();
  const sectionWidth = pageWidth - SECTION_X * 2;
  let y = SECTION_START_Y;

  sections.forEach((section, index) => {
    y += drawTermsSection(doc, section, y, sectionWidth);
    if (index < sections.length - 1) y += SECTION_GAP;
  });
}

export function drawContractAnnexBSpecialConditionsPages(
  doc: jsPDF,
  value: string,
  drawPageHeader: (subtitle: string) => void
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const textWidth = pageWidth - SECTION_X * 2 - 52;
  const availableHeight =
    pageHeight -
    SPECIAL_CARD_Y -
    SPECIAL_CARD_BOTTOM_MARGIN -
    SPECIAL_TEXT_TOP_OFFSET -
    SPECIAL_TEXT_BOTTOM_PADDING;
  const groups = getSpecialConditionRows(doc, value, textWidth);
  const pages = paginateSpecialConditions(groups, availableHeight);

  pages.forEach((pageRows, pageIndex) => {
    doc.addPage();
    drawPageHeader("ANNEX B - EMPLOYMENT TERMS");
    drawSpecialConditionsCard(doc, pageRows, pageIndex);
  });

  return pages.length;
}
