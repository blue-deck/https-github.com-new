import type { ContractStudioPdfInput } from "./contractStudioPdf";

export type LegacyContractStudioDocument = ContractStudioPdfInput & {
  /** Retained verbatim for provenance; never reconstructed from current profile data. */
  sourceText: string;
};

type Rows = Array<[string, string]>;

const yachtLabels = [
  "Yacht name", "Flag state", "Official / registration number", "IMO number", "Call sign",
  "Vessel type", "Length overall - LOA", "Gross tonnage", "Port of registry", "Engine power",
];
const ownerLabels = [
  "Owner / company legal name", "Registered address", "Authorized representative",
  "Representative address / passport no", "Email", "Telephone",
];
const crewLabels = [
  "Crew member full name", "Nationality", "Date of birth", "Passport number", "Seaman book no",
  "Position", "Email", "Telephone",
];
const agreementLabels = [
  "Crewmember Name", "Position", "Agreement Start Date", "Agreement End Date", "Agreement Type",
  "Trial Period", "Place of Engagement", "Trial Period End Date",
];
const termLabels = ["Salary", "Salary Accrual", "Notice Period", "Annual Leave", "Place of Repatriation", "Travel Allowance"];
const lawLabels = ["Governing Law", "Jurisdiction / Dispute Forum"];
const employerLabels = ["Employer / Authorised Signatory", "Capacity", "Place Signed", "Date"];
const seafarerLabels = ["Seafarer's Full Name", "Place Signed", "Date"];

class UnrecognizedContract extends Error {}

function splitOnce(source: string, separator: string): [string, string] {
  const index = source.indexOf(separator);
  // Legacy records have no escaping. Ambiguous markers cannot safely be interpreted.
  if (index < 0 || index !== source.lastIndexOf(separator)) throw new UnrecognizedContract();
  return [source.slice(0, index), source.slice(index + separator.length)];
}

function withoutPrefix(source: string, prefix: string) {
  if (!source.startsWith(prefix)) throw new UnrecognizedContract();
  return source.slice(prefix.length);
}

function parseRows(source: string, labels: string[]): Rows {
  const rows: Rows = [];
  let rest = source;
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index];
    rest = withoutPrefix(rest, `${label}: `);
    const [value, next] = index + 1 < labels.length
      ? splitOnce(rest, `\n${labels[index + 1]}: `)
      : [rest, ""];
    // Repeated field labels inside values make the unescaped legacy format ambiguous.
    if (labels.some((candidate) => value.includes(`\n${candidate}: `))) throw new UnrecognizedContract();
    rows.push([label, value]);
    rest = index + 1 < labels.length ? `${labels[index + 1]}: ${next}` : "";
  }
  return rows;
}

function serializeRows(rows: Rows) {
  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

function displayRows(rows: Rows, labels: string[]): Rows {
  return rows.map(([, value], index) => [labels[index], value]);
}

/**
 * Read only the explicitly recognised, losslessly round-trippable Studio text format.
 * Labels determine layout; every value, clause and declaration comes from the record.
 * Unknown or ambiguous records remain available through the original-text fallback.
 */
export function parseLegacyStudioContract(
  value: unknown,
  employerSignatureDataUrl = "",
): LegacyContractStudioDocument | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n?/g, "\n");
  try {
    const prefix = "SEAFARER EMPLOYMENT AGREEMENT\nCOVER SHEET\n\nYACHT DETAILS\n";
    let rest = withoutPrefix(text, prefix);
    let block: string;
    [block, rest] = splitOnce(rest, "\n\nOWNER / COMPANY DETAILS\n");
    const yacht = parseRows(block, yachtLabels);
    [block, rest] = splitOnce(rest, "\n\nCREW MEMBER DETAILS\n");
    const owner = parseRows(block, ownerLabels);
    const coverEnd = "\n\nThis cover sheet forms an integral part of the Seafarer Employment Agreement.\n\n---\n\n1. ANNEX B - EMPLOYMENT TERMS\nAgreement Details\n";
    [block, rest] = splitOnce(rest, coverEnd);
    const crew = parseRows(block, crewLabels);
    [block, rest] = splitOnce(rest, "\n\nTerms Within Trial Period (if applicable)\n");
    const agreement = parseRows(block, agreementLabels);
    [block, rest] = splitOnce(rest, "\n\nStandard Terms\n");
    const trial = parseRows(block, termLabels);
    [block, rest] = splitOnce(rest, "\n\nGoverning Law and Jurisdiction\n");
    const standard = parseRows(block, termLabels);
    [block, rest] = splitOnce(rest, "\n\nSpecial Conditions\n");
    const law = parseRows(block, lawLabels);
    const [specialConditions, afterSpecial] = splitOnce(rest, "\n\n2. ANNEX C - GENERAL TERMS & CONDITIONS\n");
    const [clausesText, afterClauses] = splitOnce(afterSpecial, "\n\n\n3. ANNEX D - DECLARATION AND SIGNATURES\nEMPLOYER'S DECLARATION\n");
    const annexCClauses = clausesText.split("\n\n").map((clause, index) => {
      const [heading, ...body] = clause.split("\n");
      const match = heading.match(/^([1-9]\d*)\. (\S.*)$/u);
      if (!match || Number(match[1]) !== index + 1 || !body.length || body.some((line) => !line)) {
        throw new UnrecognizedContract();
      }
      return { number: match[1], title: match[2], body };
    });
    const [employerDeclaration, afterEmployerDeclaration] = splitOnce(afterClauses, "\n\nEmployer / Authorised Signatory: ");
    const [employerSignatureBlock, afterSignature] = splitOnce(afterEmployerDeclaration, "\n\nSEAFARER'S DECLARATION\n");
    const [employerFields, signatureNotation] = splitOnce(employerSignatureBlock, "\nSignature:");
    const employer = parseRows(`Employer / Authorised Signatory: ${employerFields}`, employerLabels);
    if (signatureNotation !== "" && signatureNotation !== " Electronic signature captured") throw new UnrecognizedContract();
    const [seafarerDeclaration, afterSeafarerDeclaration] = splitOnce(afterSignature, "\n\nSeafarer's Full Name: ");
    if (!afterSeafarerDeclaration.endsWith("\nSignature:\n")) throw new UnrecognizedContract();
    const seafarer = parseRows(`Seafarer's Full Name: ${afterSeafarerDeclaration.slice(0, -"\nSignature:\n".length)}`, seafarerLabels);
    if (!employerDeclaration || !seafarerDeclaration) throw new UnrecognizedContract();

    // Every input character must belong to a known field, clause or structural marker.
    const roundTrip = prefix + serializeRows(yacht)
      + "\n\nOWNER / COMPANY DETAILS\n" + serializeRows(owner)
      + "\n\nCREW MEMBER DETAILS\n" + serializeRows(crew)
      + coverEnd + serializeRows(agreement)
      + "\n\nTerms Within Trial Period (if applicable)\n" + serializeRows(trial)
      + "\n\nStandard Terms\n" + serializeRows(standard)
      + "\n\nGoverning Law and Jurisdiction\n" + serializeRows(law)
      + "\n\nSpecial Conditions\n" + specialConditions
      + "\n\n2. ANNEX C - GENERAL TERMS & CONDITIONS\n"
      + annexCClauses.map((clause) => [`${clause.number}. ${clause.title}`, ...clause.body].join("\n")).join("\n\n")
      + "\n\n\n3. ANNEX D - DECLARATION AND SIGNATURES\nEMPLOYER'S DECLARATION\n"
      + employerDeclaration + "\n\n" + serializeRows(employer) + "\nSignature:" + signatureNotation
      + "\n\nSEAFARER'S DECLARATION\n" + seafarerDeclaration + "\n\n" + serializeRows(seafarer)
      + "\nSignature:\n";
    if (roundTrip !== text) throw new UnrecognizedContract();

    return {
      sourceText: value,
      coverSections: [
        { title: "Yacht details", rows: yacht },
        { title: "Owner / Company details", rows: owner, wideFirstRows: 2 },
        { title: "Crew member details", rows: crew },
      ],
      termsSections: [
        { title: "Agreement details", rows: displayRows(agreement, ["Crewmember name", "Position", "Agreement start date", "Agreement end date", "Agreement type", "Trial period", "Place of engagement", "Trial period end date"]) },
        { title: "Terms within trial period", rows: displayRows(trial, ["Salary", "Salary accrual", "Notice period", "Annual leave", "Place of repatriation", "Travel allowance"]) },
        { title: "Standard terms", rows: displayRows(standard, ["Salary", "Salary accrual", "Notice period", "Annual leave", "Place of repatriation", "Travel allowance"]) },
        { title: "Governing law & jurisdiction", rows: law, wideFirstRows: 2 },
      ],
      specialConditions,
      annexCClauses,
      annexD: {
        employerName: employer[0][1],
        employerCapacity: employer[1][1],
        employerPlaceSigned: employer[2][1],
        employerDateSigned: employer[3][1],
        employerSignatureDataUrl,
        seafarerName: seafarer[0][1],
        seafarerPlaceSigned: seafarer[1][1],
        seafarerDateSigned: seafarer[2][1],
        employerDeclarationParagraphs: employerDeclaration.split("\n"),
        seafarerDeclarationParagraphs: seafarerDeclaration.split("\n"),
      },
    };
  } catch (error) {
    if (error instanceof UnrecognizedContract) return null;
    throw error;
  }
}
