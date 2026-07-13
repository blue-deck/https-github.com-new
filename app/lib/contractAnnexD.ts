import type { jsPDF } from "jspdf";

export type ContractAnnexDDetails = {
  employerName: string;
  employerCapacity: string;
  employerPlaceSigned: string;
  employerDateSigned: string;
  seafarerName: string;
  seafarerPlaceSigned: string;
  seafarerDateSigned: string;
};

export const contractEmployerDeclarationParagraphs = [
  "The Employer or Authorised Signatory confirms that the Seafarer has been informed of their rights and duties under this Agreement, has been given a reasonable opportunity to review its terms before signing, and has received or been given access to a complete copy of the Agreement.",
  "The Employer or Authorised Signatory further confirms that they are duly authorised to execute this Agreement on behalf of the Employer.",
];

export const contractSeafarerDeclarationParagraphs = [
  "The Seafarer confirms that they have entered into this Agreement freely, have been given sufficient opportunity to review and seek advice on its terms, understand their rights and responsibilities, and have received or been given access to a complete copy of Annexes A, B, C and D.",
  "The Seafarer further acknowledges that the applicable Job Description and Yacht Rules may be communicated and reasonably updated separately in writing or through an approved electronic system in accordance with this Agreement.",
  "The Seafarer agrees to familiarise themselves with and comply with all lawful and reasonable duties, Job Descriptions and Yacht Rules properly communicated or made available to them.",
];

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

function displayValue(value: string, emptyWhenMissing = false) {
  return value.trim() || (emptyWhenMissing ? "" : "-");
}

export function drawContractAnnexDPage(
  doc: jsPDF,
  details: ContractAnnexDDetails,
  drawPageHeader: (subtitle: string) => void
) {
  doc.addPage();
  drawPageHeader("ANNEX D - DECLARATIONS & SIGNATURES");
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardX = 42;
  const cardWidth = pageWidth - 84;
  const contentX = cardX + 18;
  const contentWidth = cardWidth - 36;
  const cardGap = 14;

  function drawDeclarationField(
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    emptyWhenMissing = false
  ) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    setText(doc, "#0b3c77");
    doc.text(label.toUpperCase(), x, y);
    setStroke(doc, "#b9d5f0");
    setFill(doc, "#ffffff");
    doc.roundedRect(x, y + 5, width, 22, 3.5, 3.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    setText(doc, "#17233a");
    const fieldValue = displayValue(value, emptyWhenMissing);
    const availableWidth = width - 12;
    const valueWidth = doc.getTextWidth(fieldValue);
    doc.text(fieldValue, x + 6, y + 19, {
      horizontalScale: valueWidth > availableWidth ? availableWidth / valueWidth : 1,
    });
  }

  function drawDeclarationCard({
    title,
    paragraphs,
    nameLabel,
    nameValue,
    secondaryLabel,
    secondaryValue,
    placeValue,
    dateValue,
    y,
    emptyWhenMissing = false,
  }: {
    title: string;
    paragraphs: string[];
    nameLabel: string;
    nameValue: string;
    secondaryLabel?: string;
    secondaryValue?: string;
    placeValue: string;
    dateValue: string;
    y: number;
    emptyWhenMissing?: boolean;
  }) {
    const paragraphFontSize = 8.25;
    const paragraphLineHeight = 10.35;
    const paragraphGap = 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(paragraphFontSize);
    const wrappedParagraphs = paragraphs.map(
      (paragraph) => doc.splitTextToSize(paragraph, contentWidth) as string[]
    );
    const paragraphHeight = wrappedParagraphs.reduce(
      (height, lines) => height + lines.length * paragraphLineHeight + paragraphGap,
      0
    );
    const hasSecondaryField = Boolean(secondaryLabel);
    const fieldsHeight = hasSecondaryField ? 105 : 70;
    const signatureHeight = 60;
    const cardHeight = 30 + 16 + paragraphHeight + 7 + fieldsHeight + 18 + signatureHeight + 16;

    setStroke(doc, "#bfd8ea");
    setFill(doc, "#ffffff");
    doc.setLineWidth(0.8);
    doc.roundedRect(cardX, y, cardWidth, cardHeight, 8, 8, "FD");
    setFill(doc, "#f4f8fc");
    doc.rect(cardX + 0.8, y + 0.8, cardWidth - 1.6, 29, "F");
    setStroke(doc, "#d9e8f3");
    doc.setLineWidth(0.45);
    doc.line(cardX, y + 30, cardX + cardWidth, y + 30);
    doc.setFont("times", "bold");
    doc.setFontSize(13.5);
    setText(doc, "#082759");
    doc.text(title.toUpperCase(), contentX, y + 20.5);

    let cursorY = y + 48;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(paragraphFontSize);
    setText(doc, "#314357");
    wrappedParagraphs.forEach((lines) => {
      doc.text(lines, contentX, cursorY);
      cursorY += lines.length * paragraphLineHeight + paragraphGap;
    });

    cursorY += 4;
    drawDeclarationField(nameLabel, nameValue, contentX, cursorY, contentWidth, emptyWhenMissing);
    cursorY += 35;
    const fieldGap = 12;
    const halfWidth = (contentWidth - fieldGap) / 2;
    drawDeclarationField(
      secondaryLabel || "Place Signed",
      secondaryLabel ? secondaryValue || "" : placeValue,
      contentX,
      cursorY,
      halfWidth,
      emptyWhenMissing
    );
    drawDeclarationField(
      secondaryLabel ? "Place Signed" : "Date",
      secondaryLabel ? placeValue : dateValue,
      contentX + halfWidth + fieldGap,
      cursorY,
      halfWidth,
      emptyWhenMissing
    );
    cursorY += 35;

    if (secondaryLabel) {
      drawDeclarationField("Date", dateValue, contentX, cursorY, halfWidth, emptyWhenMissing);
      cursorY += 35;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    setText(doc, "#0b3c77");
    doc.text("SIGNATURE", contentX, cursorY + 2);
    setStroke(doc, "#8fb9df");
    setFill(doc, "#ffffff");
    doc.setLineWidth(0.9);
    doc.roundedRect(contentX, cursorY + 8, contentWidth, signatureHeight, 4, 4, "FD");

    return cardHeight;
  }

  const employerHeight = drawDeclarationCard({
    title: "Employer's Declaration",
    paragraphs: contractEmployerDeclarationParagraphs,
    nameLabel: "Employer / Authorised Signatory",
    nameValue: details.employerName,
    secondaryLabel: "Capacity",
    secondaryValue: details.employerCapacity,
    placeValue: details.employerPlaceSigned,
    dateValue: details.employerDateSigned,
    y: 82,
  });

  drawDeclarationCard({
    title: "Seafarer's Declaration",
    paragraphs: contractSeafarerDeclarationParagraphs,
    nameLabel: "Seafarer's Full Name",
    nameValue: details.seafarerName,
    placeValue: details.seafarerPlaceSigned,
    dateValue: details.seafarerDateSigned,
    emptyWhenMissing: true,
    y: 82 + employerHeight + cardGap,
  });
}
