import { installContractPdfFonts } from "./assignedContractPdf";
import { drawContractAnnexAPage, type ContractAnnexASection } from "./contractAnnexA";
import { drawContractAnnexBSpecialConditionsPages, drawContractAnnexBTermsPage, type ContractAnnexBSection } from "./contractAnnexB";
import type { ContractAnnexCClause } from "./contractAnnexC";
import { drawContractAnnexDPage, type ContractAnnexDDetails } from "./contractAnnexD";

export type ContractStudioIntroduction = {
  paragraphs: string[];
  annexes: Array<{ title: string; text: string }>;
  closingParagraphs: string[];
  footerNotice: string;
};

export type ContractStudioPdfInput = {
  coverSections: ContractAnnexASection[];
  termsSections: ContractAnnexBSection[];
  specialConditions: string;
  annexCClauses: ContractAnnexCClause[];
  annexD: ContractAnnexDDetails;
  intro?: ContractStudioIntroduction;
};

type ContractDocumentSection = { title: string; lines: string[] };

export const contractIntroParagraphs = [
  'This Seafarer Employment Agreement (the "Agreement") consists of this Introductory Note and four (4) Annexes. Together, the Introductory Note and Annexes A, B, C and D constitute the written agreement between the Seafarer and the Employer in relation to the Seafarer’s employment aboard the Yacht.',
  "The Agreement may be supplemented, in accordance with Annex C, by any Job Description, Yacht Rules, safety procedure, operational policy or other document validly communicated to the Seafarer.",
];

export const contractIntroAnnexes = [
  {
    title: "ANNEX A - PARTIES & YACHT DETAILS",
    text: "Contains the identification and contact details of the Yacht, Seafarer, Employer, Shipowner, Owner and Management Company, as applicable.",
  },
  {
    title: "ANNEX B - EMPLOYMENT TERMS & SPECIAL CONDITIONS",
    text: "Contains the specific terms of employment, including the Seafarer’s position, commencement date, contract duration, trial period where applicable, salary, leave entitlement, rotation, working arrangements, notice period, repatriation destination, governing law, jurisdiction and any Special Conditions agreed between the parties.",
  },
  {
    title: "ANNEX C - GENERAL TERMS & CONDITIONS",
    text: "Contains the general provisions governing the Seafarer’s employment, including duties and Job Description arrangements, Yacht Rules, professional conduct, working and rest hours, wages, leave, medical care, insurance, travel, repatriation, accommodation, confidentiality, safety, complaints, disciplinary matters, termination, governing law and dispute resolution.",
  },
  {
    title: "ANNEX D - DECLARATIONS & SIGNATURES",
    text: "Contains the declarations, acknowledgements and signatures of the Seafarer, Employer and any authorised representative.",
  },
];

export const contractIntroClosingParagraphs = [
  "The Introductory Note and all Annexes shall be read together as one Agreement. Unless expressly supplemented, varied or replaced by a written Special Condition stated in Annex B, all provisions of Annex C shall apply in full.",
  "Where a Special Condition in Annex B conflicts with a provision of Annex C, the Special Condition shall prevail only to the extent of that specific conflict, subject always to applicable mandatory law, the Yacht’s flag-State requirements and any applicable collective bargaining agreement.",
  "The Seafarer’s applicable Job Description and the Yacht Rules may be communicated separately in accordance with Annex C.",
  "By signing Annex D, the parties confirm their acceptance of the Agreement.",
];

export const contractIntroFooterNotice =
  "Generated using BlueDeck.app. BlueDeck.app is not a party to this Agreement and does not provide legal advice.";

export const contractStudioIntroduction: ContractStudioIntroduction = {
  paragraphs: contractIntroParagraphs,
  annexes: contractIntroAnnexes,
  closingParagraphs: contractIntroClosingParagraphs,
  footerNotice: contractIntroFooterNotice,
};

function contractDisplayLines(lines: string[]) {
  return lines.flatMap((line) => (line ? line.split("\n") : [""]));
}

function splitContractSubclausePrefix(text: string) {
  const match = text.match(/^(\d+(?:\.\d+)+)(?=\s)/);
  return match ? { prefix: match[1], remainder: text.slice(match[1].length) } : null;
}

/** The same page layout for Studio generation and the recorded fields of older contracts. */
export async function createContractStudioPdf(
  input: ContractStudioPdfInput,
  downloadName?: string,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true, putOnlyUsedFonts: true });
  const text = JSON.stringify(input, (key, value) => key === "employerSignatureDataUrl" ? undefined : value);
  await installContractPdfFonts(doc, text, ["helvetica", "times"]);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  function hexToRgb(hex: string) {
    const clean = hex.replace("#", "");
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }

  function setFill(hex: string) {
    const { r, g, b } = hexToRgb(hex);
    doc.setFillColor(r, g, b);
  }

  function setStroke(hex: string) {
    const { r, g, b } = hexToRgb(hex);
    doc.setDrawColor(r, g, b);
  }

  function setText(hex: string) {
    const { r, g, b } = hexToRgb(hex);
    doc.setTextColor(r, g, b);
  }

  function drawContractPageBase() {
    setFill("#ffffff");
    doc.rect(0, 0, pageWidth, pageHeight, "F");
  }

  function drawContractPageFooter(pageNo: number, totalPages: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    setText("#082759");
    doc.text(`Page ${pageNo} of ${totalPages}`, pageWidth - 48, pageHeight - 28, { align: "right" });
  }

  function drawContractAnnexDivider(text: string, y: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    setText("#0d58ae");
    const label = text.toUpperCase();
    const labelWidth = doc.getTextWidth(label);
    const gap = 9;
    const center = pageWidth / 2;
    const leftEnd = center - labelWidth / 2 - gap;
    const rightStart = center + labelWidth / 2 + gap;

    doc.text(label, center, y + 2.5, { align: "center" });
    doc.setLineWidth(0.35);
    setStroke("#d8e7f5");
    doc.line(112, y, leftEnd - 38, y);
    doc.line(rightStart + 38, y, pageWidth - 112, y);
    setStroke("#88b9e6");
    doc.line(leftEnd - 38, y, leftEnd, y);
    doc.line(rightStart, y, rightStart + 38, y);
  }

  function drawContractDocumentHeader(subtitle?: string) {
    doc.setFont("times", "bold");
    doc.setFontSize(17);
    setText("#082759");
    doc.text("SEAFARER EMPLOYMENT AGREEMENT", pageWidth / 2, 38, { align: "center" });
    if (subtitle) drawContractAnnexDivider(subtitle, 60);
  }

  function drawContractIntroPage() {
    drawContractPageBase();
    drawContractDocumentHeader("INTRODUCTORY NOTE");
    const x = 68;
    const width = pageWidth - 136;
    let y = 154;

    function drawIntroText(text: string, fontSize = 9.8, lineHeight = 12.3, indent = 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      setText("#17233a");
      const lines = doc.splitTextToSize(text, width - indent);
      doc.text(lines, x + indent, y);
      y += lines.length * lineHeight;
    }

    input.intro!.paragraphs.forEach((paragraph) => {
      drawIntroText(paragraph, 9.8, 12.3);
      y += 10;
    });

    input.intro!.annexes.forEach((annex, index) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.7);
      setText("#082759");
      doc.text(`${index + 1}.`, x, y);
      doc.text(annex.title, x + 18, y);
      y += 20;
      drawIntroText(annex.text, 9.1, 11.5, 18);
      y += 8;
    });

    setStroke("#d8e7f5");
    doc.line(x, y + 2, x + width, y + 2);
    y += 18;
    input.intro!.closingParagraphs.forEach((paragraph) => {
      drawIntroText(paragraph, 9.1, 11.5);
      y += 8;
    });

    setStroke("#d8e7f5");
    doc.line(x, pageHeight - 58, x + width, pageHeight - 58);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    setText("#4f6680");
    doc.text(input.intro!.footerNotice, x, pageHeight - 43);
  }

  function drawContractCoverPage() {
    const sections = input.coverSections;
    drawContractAnnexAPage(doc, sections, drawBodyPageHeader);
  }

  function drawContractTermsPage() {
    const sections = input.termsSections;
    drawContractAnnexBTermsPage(doc, sections, drawBodyPageHeader);
    drawContractAnnexBSpecialConditionsPages(
      doc,
      input.specialConditions,
      drawBodyPageHeader
    );
  }

  function drawBodyPageHeader(subtitle?: string) {
    drawContractPageBase();
    drawContractDocumentHeader(subtitle);
  }

  function drawBodyPages() {
    const sections: ContractDocumentSection[] = [
      { title: "Annex B - Employment Terms", lines: [] },
      { title: "Annex C - General Terms & Conditions", lines: [] },
      { title: "Annex D - Declaration and Signatures", lines: [] },
    ];
    const left = 54;
    const right = pageWidth - 54;
    const width = right - left;
    const top = 92;
    const bottom = pageHeight - 52;
    const annexCContentTop = 96;

    function drawSectionTitle(section: ContractDocumentSection, y: number) {
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      setText("#082759");
      doc.text(section.title.toUpperCase(), left, y);
      setStroke("#b8d2ee");
      doc.line(left, y + 8, right, y + 8);
    }

    function getWrappedRows(section: ContractDocumentSection) {
      const rows: string[] = [];
      const isAnnexC = section.title.startsWith("Annex C");
      const lineWidth = isAnnexC ? pageWidth - 96 : width - 8;
      contractDisplayLines(section.lines).forEach((line) => {
        const pieces = line ? doc.splitTextToSize(line, lineWidth) : [""];
        pieces.forEach((piece: string) => rows.push(piece));
        rows.push("");
      });
      return rows;
    }

    function getAnnexCPdfRows() {
      const rows: Array<{ kind: "heading" | "body" | "space"; text: string }> = [];
      const lineWidth = pageWidth - 88;

      input.annexCClauses.forEach((clause, clauseIndex) => {
        doc.setFont("times", "bold");
        doc.setFontSize(11.2);
        (doc.splitTextToSize(`${clause.number}. ${clause.title}`, lineWidth) as string[]).forEach((text) => {
          rows.push({ kind: "heading", text });
        });

        doc.setFont("times", "normal");
        doc.setFontSize(9.9);
        clause.body.forEach((paragraph) => {
          (doc.splitTextToSize(paragraph, lineWidth) as string[]).forEach((text) => {
            rows.push({ kind: "body", text });
          });
          rows.push({ kind: "space", text: "" });
        });

        if (clauseIndex < input.annexCClauses.length - 1) {
          rows.push({ kind: "space", text: "" });
        }
      });

      return rows;
    }

    function drawSinglePageSection(section: ContractDocumentSection, subtitle: string) {
      doc.addPage();
      drawBodyPageHeader(subtitle);
      drawSectionTitle(section, top);
      let y = top + 26;
      const rows = getWrappedRows(section);
      const usableHeight = bottom - y;
      const lineHeight = Math.min(12, Math.max(8.1, usableHeight / Math.max(rows.length, 1)));
      const fontSize = Math.min(9.2, Math.max(6.5, lineHeight * 0.78));

      rows.forEach((row) => {
        if (row) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(fontSize);
          setText("#17233a");
          doc.text(row, left + 4, y);
          y += lineHeight;
        } else {
          y += lineHeight * 0.48;
        }
      });
    }

    function drawFlowingSection(section: ContractDocumentSection, firstPageSubtitle: string) {
      doc.addPage();
      drawBodyPageHeader(firstPageSubtitle);
      const isAnnexC = section.title.startsWith("Annex C");
      if (!isAnnexC) {
        drawSectionTitle(section, top);
      }
      let y = isAnnexC ? annexCContentTop : top + 26;
      const textX = isAnnexC ? 44 : left + 4;
      const rows = isAnnexC
        ? getAnnexCPdfRows()
        : getWrappedRows(section).map((text) => ({ kind: text ? "body" : "space", text }));

      function ensureSpace(height: number) {
        if (y + height <= bottom) return;
        doc.addPage();
        drawBodyPageHeader(isAnnexC ? firstPageSubtitle : undefined);
        if (!isAnnexC) {
          drawSectionTitle(section, top);
        }
        y = isAnnexC ? annexCContentTop : top + 26;
      }

      rows.forEach((row) => {
        if (row.text) {
          const isHeading = isAnnexC && row.kind === "heading";
          const headingOffset = isHeading && y > annexCContentTop + 2 ? 6 : 0;
          ensureSpace((isHeading ? 17 : 12.5) + headingOffset);
          if (headingOffset) y += headingOffset;
          doc.setFont(isAnnexC ? "times" : "helvetica", isHeading ? "bold" : "normal");
          doc.setFontSize(isAnnexC ? (isHeading ? 11.2 : 9.9) : 9.2);
          setText(isHeading ? "#082759" : "#17233a");
          const subclause = isAnnexC && !isHeading ? splitContractSubclausePrefix(row.text) : null;
          if (subclause) {
            doc.setFont("times", "bold");
            doc.text(subclause.prefix, textX, y);
            const prefixWidth = doc.getTextWidth(subclause.prefix);
            doc.setFont("times", "normal");
            doc.text(subclause.remainder, textX + prefixWidth, y);
          } else {
            doc.text(row.text, textX, y);
          }
          y += isAnnexC ? (isHeading ? 14.6 : 11.6) : 12;
        } else {
          y += isAnnexC ? 3.3 : 5;
        }
      });
    }

    sections.forEach((section) => {
      if (section.title.startsWith("Annex B")) {
        drawContractTermsPage();
        return;
      }

      if (section.title.startsWith("Annex C")) {
        drawFlowingSection(section, "ANNEX C - GENERAL TERMS & CONDITIONS");
        return;
      }

      if (section.title.startsWith("Annex D")) {
        drawContractAnnexDPage(
          doc,
          input.annexD,
          drawBodyPageHeader
        );
        return;
      }

      drawSinglePageSection(section, section.title.toUpperCase());
    });
  }

  if (input.intro) drawContractIntroPage();
  drawContractCoverPage();
  drawBodyPages();
  if (!input.intro) doc.deletePage(1);
  const totalPages = doc.getNumberOfPages();
  for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
    doc.setPage(pageNo);
    drawContractPageFooter(pageNo, totalPages);
  }

  const blob = doc.output("blob");
  if (downloadName) await doc.save(downloadName, { returnPromise: true });
  return blob;
}
