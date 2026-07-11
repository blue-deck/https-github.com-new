"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { contractAnnexCClauses, getContractAnnexCLines } from "../../../lib/contractAnnexC";
import {
  Anchor,
  Archive,
  AlertTriangle,
  Bell,
  CalendarClock,
  Camera,
  Check,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  LifeBuoy,
  ListChecks,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  ShipWheel,
  TimerReset,
  Utensils,
  UserRound,
  UserPlus,
  Wrench,
  Waves,
  X,
} from "lucide-react";
import {
  canAssignChecklistDepartment,
  canAssignToCrew,
  checklistFrequencies,
  checklistLibraryPacks,
  checklistTaskCategories,
  checklistTemplates,
  getAssignableDepartments,
  getChecklistTaskSuggestions,
  getDefaultPositionForAccountType,
  getDepartmentByPosition,
  positionSelectGroups,
  yachtDepartments,
} from "../../../lib/yachtOperations";

type ContractStudioStep =
  | "parties"
  | "terms"
  | "clauses"
  | "signature"
  | "preview";

type ContractDraft = {
  agreementDate: string;
  vesselName: string;
  flagState: string;
  officialNumber: string;
  imoNumber: string;
  callSign: string;
  vesselType: string;
  lengthOverall: string;
  grossTonnage: string;
  portOfRegistry: string;
  enginePower: string;
  ownerCompanyName: string;
  ownerRegisteredAddress: string;
  ownerRepresentative: string;
  ownerRepresentativeDetails: string;
  ownerEmail: string;
  ownerTelephone: string;
  employeeName: string;
  employeeNationality: string;
  employeeDob: string;
  employeePassportNo: string;
  employeeSeamanBookNo: string;
  employeePosition: string;
  startDate: string;
  endDate: string;
  salary: string;
  currency: string;
  leaveTerms: string;
  travelTerms: string;
  accommodationTerms: string;
  terminationNotice: string;
  agreementStartDate: string;
  agreementEndDate: string;
  agreementType: string;
  trialPeriod: string;
  placeOfEngagement: string;
  trialPeriodEndDate: string;
  trialSalary: string;
  trialSalaryCurrency: string;
  trialSalaryAccrual: string;
  trialNoticePeriod: string;
  trialAnnualLeave: string;
  trialPlaceOfRepatriation: string;
  trialTravelAllowance: string;
  standardSalary: string;
  standardSalaryCurrency: string;
  standardSalaryAccrual: string;
  standardNoticePeriod: string;
  standardAnnualLeave: string;
  standardPlaceOfRepatriation: string;
  standardTravelAllowance: string;
  specialConditions: string;
  clauses: string;
  signerName: string;
  signerTitle: string;
  signatureDate: string;
  signatureLocation: string;
};

type ContractSheetRow = [string, string | undefined | null];

type ContractSheetSection = {
  number: string;
  title: string;
  note: string;
  rows: ContractSheetRow[];
  footer?: string;
  wideFirstRows?: number;
};

type ContractDocumentSection = {
  title: string;
  lines: string[];
};

type ContractDraftField = keyof ContractDraft;

type ContractSaveSectionKey =
  | "annexAYacht"
  | "annexAOwner"
  | "annexBAgreement"
  | "annexBTrial"
  | "annexBStandard"
  | "annexBSpecial";

type ContractCrewMember = {
  position?: string | null;
  invited_email?: string | null;
  crew_profiles?: {
    full_name?: string | null;
    email?: string | null;
    current_position?: string | null;
    nationality?: string | null;
    date_of_birth?: string | null;
    birth_date?: string | null;
    passport_no?: string | null;
    seaman_book_no?: string | null;
    phone?: string | null;
    mobile_number?: string | null;
    mobile?: string | null;
  } | null;
};

const contractIntroParagraphs = [
  'This Seafarer Employment Agreement (the "Agreement") consists of this Introductory Note and four (4) Annexes. Together, the Introductory Note and Annexes A, B, C and D constitute the written agreement between the Seafarer and the Employer in relation to the Seafarer’s employment aboard the Yacht.',
  "The Agreement may be supplemented, in accordance with Annex C, by any Job Description, Yacht Rules, safety procedure, operational policy or other document validly communicated to the Seafarer.",
];

const contractIntroAnnexes = [
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

const contractIntroClosingParagraphs = [
  "The Introductory Note and all Annexes shall be read together as one Agreement. Unless expressly supplemented, varied or replaced by a written Special Condition stated in Annex B, all provisions of Annex C shall apply in full.",
  "Where a Special Condition in Annex B conflicts with a provision of Annex C, the Special Condition shall prevail only to the extent of that specific conflict, subject always to applicable mandatory law, the Yacht’s flag-State requirements and any applicable collective bargaining agreement.",
  "The Seafarer’s applicable Job Description and the Yacht Rules may be communicated separately in accordance with Annex C.",
  "By signing Annex D, the parties confirm their acceptance of the Agreement.",
];

const contractIntroFooterNotice =
  "Generated using BlueDeck.app. BlueDeck.app is not a party to this Agreement and does not provide legal advice.";

const contractAnnexAYachtFields: ContractDraftField[] = [
  "vesselName",
  "flagState",
  "officialNumber",
  "imoNumber",
  "callSign",
  "vesselType",
  "lengthOverall",
  "grossTonnage",
  "portOfRegistry",
  "enginePower",
];

const contractAnnexAOwnerFields: ContractDraftField[] = [
  "ownerCompanyName",
  "ownerRegisteredAddress",
  "ownerRepresentative",
  "ownerRepresentativeDetails",
  "ownerEmail",
  "ownerTelephone",
];

const contractAnnexAFields: ContractDraftField[] = [
  ...contractAnnexAYachtFields,
  ...contractAnnexAOwnerFields,
];

const contractAnnexBAgreementFields: ContractDraftField[] = [
  "employeeName",
  "employeePosition",
  "agreementStartDate",
  "agreementEndDate",
  "agreementType",
  "trialPeriod",
  "placeOfEngagement",
  "trialPeriodEndDate",
];

const contractAnnexBTrialFields: ContractDraftField[] = [
  "trialSalary",
  "trialSalaryCurrency",
  "trialSalaryAccrual",
  "trialNoticePeriod",
  "trialAnnualLeave",
  "trialPlaceOfRepatriation",
  "trialTravelAllowance",
];

const contractAnnexBStandardFields: ContractDraftField[] = [
  "standardSalary",
  "standardSalaryCurrency",
  "standardSalaryAccrual",
  "standardNoticePeriod",
  "standardAnnualLeave",
  "standardPlaceOfRepatriation",
  "standardTravelAllowance",
];

const contractAnnexBSpecialFields: ContractDraftField[] = [
  "specialConditions",
];

const contractAnnexBFields: ContractDraftField[] = [
  ...contractAnnexBAgreementFields,
  ...contractAnnexBTrialFields,
  ...contractAnnexBStandardFields,
  ...contractAnnexBSpecialFields,
];

const contractSaveSectionIds: ContractSaveSectionKey[] = [
  "annexAYacht",
  "annexAOwner",
  "annexBAgreement",
  "annexBTrial",
  "annexBStandard",
  "annexBSpecial",
];

const contractStepCards: Array<{
  id: ContractStudioStep;
  title: string;
  meta: string;
}> = [
  { id: "parties", title: "Annex A", meta: "Yacht / Owner / Crew" },
  { id: "terms", title: "Annex B", meta: "Employment Terms" },
  { id: "clauses", title: "Annex C", meta: "General Terms" },
  { id: "signature", title: "Annex D", meta: "Declaration & signatures" },
  { id: "preview", title: "Preview", meta: "PDF & send" },
];

const contractCurrencyOptions = ["EUR", "USD", "TRY", "GBP"];
const contractAgreementTypeOptions = [
  "Permanent",
  "Seasonal",
  "Temporary",
  "Rotational",
  "Transfer",
  "Daywork",
];
const contractSalaryAccrualOptions = ["Monthly", "Daily", "Weekly", "Year"];
const contractJurisdictionForum =
  "Any competent court, tribunal or authority having jurisdiction under applicable law";
const CONTRACT_PREVIEW_PAGE_WIDTH = 920;
const CONTRACT_PREVIEW_PAGE_HEIGHT = Math.round((CONTRACT_PREVIEW_PAGE_WIDTH * 1536) / 1057);

function createEmptyContractDraft(): ContractDraft {
  return {
    agreementDate: "",
    vesselName: "",
    flagState: "",
    officialNumber: "",
    imoNumber: "",
    callSign: "",
    vesselType: "",
    lengthOverall: "",
    grossTonnage: "",
    portOfRegistry: "",
    enginePower: "",
    ownerCompanyName: "",
    ownerRegisteredAddress: "",
    ownerRepresentative: "",
    ownerRepresentativeDetails: "",
    ownerEmail: "",
    ownerTelephone: "",
    employeeName: "",
    employeeNationality: "",
    employeeDob: "",
    employeePassportNo: "",
    employeeSeamanBookNo: "",
    employeePosition: "",
    startDate: "",
    endDate: "",
    salary: "",
    currency: "EUR",
    leaveTerms: "",
    travelTerms: "",
    accommodationTerms: "",
    terminationNotice: "",
    agreementStartDate: "",
    agreementEndDate: "",
    agreementType: "",
    trialPeriod: "",
    placeOfEngagement: "",
    trialPeriodEndDate: "",
    trialSalary: "",
    trialSalaryCurrency: "EUR",
    trialSalaryAccrual: "",
    trialNoticePeriod: "",
    trialAnnualLeave: "",
    trialPlaceOfRepatriation: "",
    trialTravelAllowance: "",
    standardSalary: "",
    standardSalaryCurrency: "EUR",
    standardSalaryAccrual: "",
    standardNoticePeriod: "",
    standardAnnualLeave: "",
    standardPlaceOfRepatriation: "",
    standardTravelAllowance: "",
    specialConditions: "",
    clauses:
      "The employee shall perform duties in a professional, safe and seamanlike manner in accordance with yacht rules, flag requirements and lawful instructions from the Captain or yacht representative.",
    signerName: "",
    signerTitle: "Captain / Yacht Representative",
    signatureDate: "",
    signatureLocation: "",
  };
}

function getCrewDisplayName(member?: ContractCrewMember) {
  return (
    member?.crew_profiles?.full_name ||
    member?.invited_email ||
    member?.crew_profiles?.email ||
    ""
  );
}

function getCrewPosition(member?: ContractCrewMember) {
  return member?.position || member?.crew_profiles?.current_position || "";
}

function contractValue(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function contractSheetValue(value: string | undefined | null) {
  return String(value || "").trim() || "-";
}

function getContractGoverningLaw(draft: Pick<ContractDraft, "flagState">) {
  const flagState = draft.flagState.trim();
  return `Laws and regulations of ${flagState || "the Yacht's Flag State"}`;
}

function contractDisplayLines(lines: string[]) {
  return lines.flatMap((line) => (line ? line.split("\n") : [""]));
}

function splitContractSubclausePrefix(text: string) {
  const match = text.match(/^(\d+(?:\.\d+)+)(?=\s)/);
  if (!match) return null;

  return {
    prefix: match[1],
    remainder: text.slice(match[1].length),
  };
}

function normalizeInitialContractInput(value: string, previousValue = "") {
  if (!value || previousValue.trim()) return value;

  const firstLetterIndex = value.search(/[A-Za-zÀ-ÖØ-öø-ÿ]/);
  if (firstLetterIndex < 0) return value;

  return [
    value.slice(0, firstLetterIndex),
    value[firstLetterIndex].toUpperCase(),
    value.slice(firstLetterIndex + 1).toLowerCase(),
  ].join("");
}

function formatContractDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatContractMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatContractSalary(amount: string | undefined, currency: string | undefined) {
  const cleanAmount = formatContractMoneyInput(amount || "");
  if (!cleanAmount) return "";
  return `${cleanAmount} ${currency || "EUR"}`;
}

function buildContractSectionSaveKey(draft: ContractDraft, fields: ContractDraftField[]) {
  return JSON.stringify(fields.map((field) => [field, draft[field]]));
}

function copyContractFields(target: ContractDraft, source: ContractDraft, fields: ContractDraftField[]) {
  const next = { ...target };
  fields.forEach((field) => {
    (next as Record<string, ContractDraft[ContractDraftField]>)[field] = source[field];
  });
  return next;
}

function normalizeContractDraft(value: unknown): ContractDraft {
  const empty = createEmptyContractDraft();
  if (!value || typeof value !== "object") return empty;
  const source = value as Record<string, unknown>;
  const normalized = { ...empty };

  (Object.keys(empty) as ContractDraftField[]).forEach((field) => {
    const fieldValue = source[field];
    if (typeof fieldValue === "string") normalized[field] = fieldValue;
  });

  return normalized;
}

function normalizeContractSavedSectionKeys(value: unknown): Partial<Record<ContractSaveSectionKey, string>> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return contractSaveSectionIds.reduce<Partial<Record<ContractSaveSectionKey, string>>>((keys, sectionKey) => {
    if (typeof source[sectionKey] === "string") keys[sectionKey] = source[sectionKey];
    return keys;
  }, {});
}

function parseStoredContractDraftPayload(value?: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const savedDraft = normalizeContractDraft(parsed.savedDraft || parsed.savedContractDraft || parsed.draft);
    const savedSectionKeys = normalizeContractSavedSectionKeys(
      parsed.savedSectionKeys || parsed.savedContractSectionKeys
    );
    const savedAt = typeof parsed.savedAt === "string" ? parsed.savedAt : "";
    return { savedDraft, savedSectionKeys, savedAt };
  } catch {
    return null;
  }
}

function serializeContractDraftPayload(
  savedDraft: ContractDraft,
  savedSectionKeys: Partial<Record<ContractSaveSectionKey, string>>
) {
  return JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    savedDraft,
    savedSectionKeys,
  });
}

function mergeSavedContractAnnexes(draft: ContractDraft, savedDraft: ContractDraft) {
  const withAnnexA = copyContractFields(draft, savedDraft, contractAnnexAFields);
  return copyContractFields(withAnnexA, savedDraft, contractAnnexBFields);
}

function getContractCoverSections(draft: ContractDraft, member?: ContractCrewMember): ContractSheetSection[] {
  const crewProfile = member?.crew_profiles || {};

  return [
    {
      number: "1.",
      title: "Yacht details",
      note: "To be completed by the Owner / Company",
      rows: [
        ["Yacht name", draft.vesselName],
        ["Flag state", draft.flagState],
        ["Official / registration number", draft.officialNumber],
        ["IMO number", draft.imoNumber],
        ["Call sign", draft.callSign],
        ["Vessel type", draft.vesselType],
        ["Length overall - LOA", draft.lengthOverall],
        ["Gross tonnage", draft.grossTonnage],
        ["Port of registry", draft.portOfRegistry],
        ["Engine power", draft.enginePower],
      ],
    },
    {
      number: "2.",
      title: "Owner / Company details",
      note: "Legal contracting party",
      wideFirstRows: 2,
      rows: [
        ["Owner / company legal name", draft.ownerCompanyName],
        ["Registered address", draft.ownerRegisteredAddress],
        ["Authorized representative", draft.ownerRepresentative],
        ["Representative address / passport no", draft.ownerRepresentativeDetails],
        ["Email", draft.ownerEmail],
        ["Telephone", draft.ownerTelephone],
      ],
    },
    {
      number: "3.",
      title: "Crew member details",
      note: "Employee / Seafarer information",
      rows: [
        ["Crew member full name", draft.employeeName || getCrewDisplayName(member)],
        ["Nationality", draft.employeeNationality || crewProfile.nationality],
        ["Date of birth", draft.employeeDob || crewProfile.date_of_birth || crewProfile.birth_date],
        ["Passport number", draft.employeePassportNo || crewProfile.passport_no],
        ["Seaman book no", draft.employeeSeamanBookNo || crewProfile.seaman_book_no],
        ["Position", draft.employeePosition || getCrewPosition(member)],
        ["Email", crewProfile.email || member?.invited_email],
        ["Telephone", crewProfile.phone || crewProfile.mobile_number || crewProfile.mobile],
      ],
    },
  ];
}

function getContractTermsSections(draft: ContractDraft, member?: ContractCrewMember): ContractSheetSection[] {
  const employeeName = contractValue(draft.employeeName, getCrewDisplayName(member) || "-");
  const employeePosition = contractValue(draft.employeePosition, getCrewPosition(member) || "-");

  return [
    {
      number: "1.",
      title: "Agreement details",
      note: "Complete all applicable fields",
      rows: [
        ["Crewmember name", employeeName],
        ["Position", employeePosition],
        ["Agreement start date", draft.agreementStartDate || draft.startDate],
        ["Agreement end date", draft.agreementEndDate || draft.endDate],
        ["Agreement type", draft.agreementType],
        ["Trial period", draft.trialPeriod],
        ["Place of engagement", draft.placeOfEngagement],
        ["Trial period end date", draft.trialPeriodEndDate],
      ],
    },
    {
      number: "2.",
      title: "Terms within trial period",
      note: "If applicable",
      rows: [
        ["Salary", formatContractSalary(draft.trialSalary, draft.trialSalaryCurrency)],
        ["Salary accrual", draft.trialSalaryAccrual],
        ["Notice period", draft.trialNoticePeriod],
        ["Annual leave", draft.trialAnnualLeave],
        ["Place of repatriation", draft.trialPlaceOfRepatriation],
        ["Travel allowance", draft.trialTravelAllowance],
      ],
    },
    {
      number: "3.",
      title: "Standard terms",
      note: "Employment terms",
      rows: [
        ["Salary", formatContractSalary(draft.standardSalary || draft.salary, draft.standardSalaryCurrency || draft.currency)],
        ["Salary accrual", draft.standardSalaryAccrual],
        ["Notice period", draft.standardNoticePeriod || draft.terminationNotice],
        ["Annual leave", draft.standardAnnualLeave || draft.leaveTerms],
        ["Place of repatriation", draft.standardPlaceOfRepatriation],
        ["Travel allowance", draft.standardTravelAllowance || draft.travelTerms],
      ],
    },
    {
      number: "4.",
      title: "Governing law & jurisdiction",
      note: "Applicable law",
      wideFirstRows: 2,
      rows: [
        ["Governing Law", getContractGoverningLaw(draft)],
        ["Jurisdiction / Dispute Forum", contractJurisdictionForum],
      ],
    },
  ];
}

function getContractDocumentSections(draft: ContractDraft, member?: ContractCrewMember): ContractDocumentSection[] {
  const employeeName = contractValue(draft.employeeName, getCrewDisplayName(member) || "-");
  const employeePosition = contractValue(draft.employeePosition, getCrewPosition(member) || "-");

  return [
    {
      title: "Annex B - Employment Terms",
      lines: [
        "Agreement Details",
        `Crewmember Name: ${employeeName}`,
        `Position: ${employeePosition}`,
        `Agreement Start Date: ${contractValue(draft.agreementStartDate || draft.startDate, "-")}`,
        `Agreement End Date: ${contractValue(draft.agreementEndDate || draft.endDate, "-")}`,
        `Agreement Type: ${contractValue(draft.agreementType, "-")}`,
        `Trial Period: ${contractValue(draft.trialPeriod, "-")}`,
        `Place of Engagement: ${contractValue(draft.placeOfEngagement, "-")}`,
        `Trial Period End Date: ${contractValue(draft.trialPeriodEndDate, "-")}`,
        "",
        "Terms Within Trial Period (if applicable)",
        `Salary: ${contractValue(formatContractSalary(draft.trialSalary, draft.trialSalaryCurrency), "-")}`,
        `Salary Accrual: ${contractValue(draft.trialSalaryAccrual, "-")}`,
        `Notice Period: ${contractValue(draft.trialNoticePeriod, "-")}`,
        `Annual Leave: ${contractValue(draft.trialAnnualLeave, "-")}`,
        `Place of Repatriation: ${contractValue(draft.trialPlaceOfRepatriation, "-")}`,
        `Travel Allowance: ${contractValue(draft.trialTravelAllowance, "-")}`,
        "",
        "Standard Terms",
        `Salary: ${contractValue(formatContractSalary(draft.standardSalary || draft.salary, draft.standardSalaryCurrency || draft.currency), "-")}`,
        `Salary Accrual: ${contractValue(draft.standardSalaryAccrual, "-")}`,
        `Notice Period: ${contractValue(draft.standardNoticePeriod || draft.terminationNotice, "-")}`,
        `Annual Leave: ${contractValue(draft.standardAnnualLeave || draft.leaveTerms, "-")}`,
        `Place of Repatriation: ${contractValue(draft.standardPlaceOfRepatriation, "-")}`,
        `Travel Allowance: ${contractValue(draft.standardTravelAllowance || draft.travelTerms, "-")}`,
        "",
        "Governing Law and Jurisdiction",
        `Governing Law: ${getContractGoverningLaw(draft)}`,
        `Jurisdiction / Dispute Forum: ${contractJurisdictionForum}`,
        "",
        "Special Conditions",
        contractValue(draft.specialConditions, "-"),
      ],
    },
    {
      title: "Annex C - General Terms & Conditions",
      lines: getContractAnnexCLines(),
    },
    {
      title: "Annex D - Declaration and Signatures",
      lines: [
        `Prepared by: ${contractValue(draft.signerName, "[CAPTAIN / REPRESENTATIVE NAME]")}`,
        `Title: ${contractValue(draft.signerTitle, "Captain / Yacht Representative")}`,
        `Date: ${contractValue(draft.signatureDate, "[SIGNATURE DATE]")}`,
        `Location: ${contractValue(draft.signatureLocation, "[SIGNATURE LOCATION]")}`,
        "Employee signature will be collected through BlueDeck mobile signing flow.",
      ],
    },
  ];
}

function buildContractPreviewText(draft: ContractDraft, member?: ContractCrewMember) {
  const coverLines = getContractCoverSections(draft, member).flatMap((section) => [
    section.title.toUpperCase(),
    ...section.rows.map(([label, value]) => `${label}: ${contractSheetValue(value)}`),
    ...(section.footer ? [section.footer] : []),
    "",
  ]);

  const bodyLines = getContractDocumentSections(draft, member).flatMap((section, index) => [
    `${index + 1}. ${section.title.toUpperCase()}`,
    ...section.lines,
    "",
  ]);

  return [
    "SEAFARER EMPLOYMENT AGREEMENT",
    "COVER SHEET",
    "",
    ...coverLines,
    "This cover sheet forms an integral part of the Seafarer Employment Agreement.",
    "",
    "---",
    "",
    ...bodyLines,
  ].join("\n");
}

function buildContractFileName(draft: ContractDraft, member?: ContractCrewMember) {
  const name = contractValue(draft.employeeName, getCrewDisplayName(member) || "Crew")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `BlueDeck-contract-${name || "crew"}.pdf`;
}

export default function CrewPage({
  view = "command",
}: {
  view?: "command" | "checklists";
}) {
  const params = useParams();
  const yachtId = String(params?.id || "");
  const isChecklistSystem = view === "checklists";
  const [crew, setCrew] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [selectedCrew, setSelectedCrew] = useState("");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [crewPublicId, setCrewPublicId] = useState("");
  const [position, setPosition] = useState("Deckhand");
  const [frequency, setFrequency] = useState("Template default");
  const [dueDate, setDueDate] = useState("");
  const [captainNote, setCaptainNote] = useState("");
  const [contractStep, setContractStep] = useState<ContractStudioStep>("parties");
  const [openAnnexCClause, setOpenAnnexCClause] = useState<string | null>(contractAnnexCClauses[0]?.number || null);
  const [contractDraft, setContractDraft] = useState<ContractDraft>(createEmptyContractDraft());
  const [savedContractDraft, setSavedContractDraft] = useState<ContractDraft>(createEmptyContractDraft());
  const [savedContractSectionKeys, setSavedContractSectionKeys] = useState<Partial<Record<ContractSaveSectionKey, string>>>({});
  const [contractDraftRecordId, setContractDraftRecordId] = useState("");
  const [savingContractSections, setSavingContractSections] = useState<Partial<Record<ContractSaveSectionKey, boolean>>>({});
  const [inviteNotice, setInviteNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ label: string; url: string } | null>(null);
  const [expandedProgress, setExpandedProgress] = useState<string[]>([]);
  const [expandedTemplateTasks, setExpandedTemplateTasks] = useState<string[]>([]);
  const [templateTaskDrafts, setTemplateTaskDrafts] = useState<Record<string, string[]>>({});
  const [newTemplateTasks, setNewTemplateTasks] = useState<Record<string, string>>({});
  const [operator, setOperator] = useState({
    position: "",
    department: "",
    role: "",
  });
  const [templateDepartmentFilter, setTemplateDepartmentFilter] = useState("All");
  const [templateFrequencyFilter, setTemplateFrequencyFilter] = useState("All");
  const [templateSearch, setTemplateSearch] = useState("");
  const [activeChecklistPack, setActiveChecklistPack] = useState("departure-ready");
  const [checklistSection, setChecklistSection] = useState<"builder" | "monitor" | "archive">("builder");
  const [archiveRetention, setArchiveRetention] = useState<{ months: number; cutoff: string; purged: number } | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDepartment, setManualDepartment] = useState("Deck");
  const [manualType, setManualType] = useState("Custom Routine");
  const [manualCategoryId, setManualCategoryId] = useState("deck");
  const [manualTaskDraft, setManualTaskDraft] = useState("");
  const [manualTasks, setManualTasks] = useState<string[]>([]);

  const assignableDepartments = useMemo(
    () => getAssignableDepartments(operator.position, operator.department),
    [operator.department, operator.position]
  );

  const assignableCrew = useMemo(() => {
    return crew.filter((member) =>
      canAssignToCrew(
        operator.position,
        operator.department,
        member.position || member.crew_profiles?.current_position,
        member.department,
        operator.role
      )
    );
  }, [crew, operator.department, operator.position, operator.role]);

  const availableTemplates = useMemo(() => {
    return checklistTemplates.filter((template) =>
      canAssignChecklistDepartment(
        operator.position,
        operator.department,
        template.department,
        operator.role
      )
    );
  }, [operator.department, operator.position, operator.role]);

  const authorizedTemplateIds = useMemo(
    () => new Set(availableTemplates.map((template) => template.id)),
    [availableTemplates]
  );

  const activeChecklistPackData = useMemo(
    () =>
      checklistLibraryPacks.find((pack) => pack.id === activeChecklistPack) ||
      checklistLibraryPacks[0],
    [activeChecklistPack]
  );

  const manualDepartmentOptions = useMemo(() => {
    const allowed = yachtDepartments.filter((item) =>
      canAssignChecklistDepartment(operator.position, operator.department, item, operator.role)
    );
    return allowed.length ? allowed : yachtDepartments;
  }, [operator.department, operator.position, operator.role]);

  const manualCategoryOptions = useMemo(() => {
    const allowed = checklistTaskCategories.filter((category) =>
      canAssignChecklistDepartment(
        operator.position,
        operator.department,
        category.department,
        operator.role
      )
    );
    return allowed.length ? allowed : checklistTaskCategories;
  }, [operator.department, operator.position, operator.role]);

  const activeManualCategory = useMemo(
    () =>
      checklistTaskCategories.find((category) => category.id === manualCategoryId) ||
      checklistTaskCategories[0],
    [manualCategoryId]
  );

  const manualTaskSuggestions = useMemo(
    () => getChecklistTaskSuggestions(manualTaskDraft, activeManualCategory?.id, 8),
    [activeManualCategory?.id, manualTaskDraft]
  );

  const contractDraftStorageKey = useMemo(
    () => (yachtId ? `bluedeck:contract-studio-draft:${yachtId}` : ""),
    [yachtId]
  );

  const visibleTemplates = useMemo(() => {
    const search = templateSearch.trim().toLowerCase();
    const isFiltered =
      Boolean(search) ||
      templateDepartmentFilter !== "All" ||
      templateFrequencyFilter !== "All";
    const baseTemplates = isFiltered
      ? checklistTemplates
      : checklistTemplates.filter((template) =>
          activeChecklistPackData?.templateIds.includes(template.id)
        );

    return baseTemplates.filter((template) => {
      const matchesDepartment =
        templateDepartmentFilter === "All" || template.department === templateDepartmentFilter;
      const matchesFrequency =
        templateFrequencyFilter === "All" || template.frequency === templateFrequencyFilter;
      const matchesSearch =
        !search ||
        `${template.title} ${template.department} ${template.type} ${template.summary} ${template.tasks.join(" ")}`
          .toLowerCase()
          .includes(search);

      return matchesDepartment && matchesFrequency && matchesSearch;
    });
  }, [activeChecklistPackData, templateDepartmentFilter, templateFrequencyFilter, templateSearch]);

  const selectedTemplateObjects = useMemo(
    () => checklistTemplates.filter((template) => selectedTemplates.includes(template.id)),
    [selectedTemplates]
  );

  const selectedContractMember = useMemo(
    () => crew.find((item) => item.id === selectedCrew),
    [crew, selectedCrew]
  );

  const contractPreviewDraft = useMemo(
    () => mergeSavedContractAnnexes(contractDraft, savedContractDraft),
    [contractDraft, savedContractDraft]
  );

  const contractPreviewText = useMemo(
    () => buildContractPreviewText(contractPreviewDraft, selectedContractMember),
    [contractPreviewDraft, selectedContractMember]
  );

  const contractSectionSaveKeys = useMemo<Record<ContractSaveSectionKey, string>>(
    () => ({
      annexAYacht: buildContractSectionSaveKey(contractDraft, contractAnnexAYachtFields),
      annexAOwner: buildContractSectionSaveKey(contractDraft, contractAnnexAOwnerFields),
      annexBAgreement: buildContractSectionSaveKey(contractDraft, contractAnnexBAgreementFields),
      annexBTrial: buildContractSectionSaveKey(contractDraft, contractAnnexBTrialFields),
      annexBStandard: buildContractSectionSaveKey(contractDraft, contractAnnexBStandardFields),
      annexBSpecial: buildContractSectionSaveKey(contractDraft, contractAnnexBSpecialFields),
    }),
    [contractDraft]
  );

  const contractSectionSaved = useMemo<Record<ContractSaveSectionKey, boolean>>(
    () => ({
      annexAYacht: savedContractSectionKeys.annexAYacht === contractSectionSaveKeys.annexAYacht,
      annexAOwner: savedContractSectionKeys.annexAOwner === contractSectionSaveKeys.annexAOwner,
      annexBAgreement: savedContractSectionKeys.annexBAgreement === contractSectionSaveKeys.annexBAgreement,
      annexBTrial: savedContractSectionKeys.annexBTrial === contractSectionSaveKeys.annexBTrial,
      annexBStandard: savedContractSectionKeys.annexBStandard === contractSectionSaveKeys.annexBStandard,
      annexBSpecial: savedContractSectionKeys.annexBSpecial === contractSectionSaveKeys.annexBSpecial,
    }),
    [contractSectionSaveKeys, savedContractSectionKeys]
  );

  const contractStepIndex = Math.max(
    contractStepCards.findIndex((step) => step.id === contractStep),
    0
  );
  const activeContractStepInfo = contractStepCards[contractStepIndex] || contractStepCards[0];
  const previousContractStep = contractStepCards[Math.max(contractStepIndex - 1, 0)]?.id || "parties";
  const nextContractStep =
    contractStepCards[Math.min(contractStepIndex + 1, contractStepCards.length - 1)]?.id || "preview";

  const checklistInsights = useMemo(() => {
    const allTasks = checklists.flatMap((checklist) => checklist.yacht_checklist_items || []);
    const completedTasks = allTasks.filter((task: any) => task.completed).length;
    const openTasks = Math.max(allTasks.length - completedTasks, 0);
    const completedChecklists = checklists.filter((checklist) => checklist.status === "completed").length;
    const openChecklists = Math.max(checklists.length - completedChecklists, 0);
    const proofItems = allTasks.filter((task: any) => getTaskPhoto(task, "before") || getTaskPhoto(task, "after")).length;
    const dueSoon = checklists.filter((checklist) => {
      if (!checklist.due_date || checklist.status === "completed") return false;
      const dueTime = new Date(checklist.due_date).getTime();
      const now = Date.now();
      const threeDays = 1000 * 60 * 60 * 24 * 3;
      return dueTime >= now - threeDays && dueTime <= now + threeDays;
    }).length;
    const progress = allTasks.length ? Math.round((completedTasks / allTasks.length) * 100) : 0;

    return {
      allTasks: allTasks.length,
      completedTasks,
      openTasks,
      openChecklists,
      completedChecklists,
      proofItems,
      dueSoon,
      progress,
    };
  }, [checklists]);

  const checklistRecords = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return checklists.filter((checklist) => {
      const createdAt = checklist.created_at ? new Date(checklist.created_at) : null;
      return !createdAt || createdAt >= cutoff;
    });
  }, [checklists]);

  const monitorChecklists = useMemo(
    () =>
      [...checklists].sort((first, second) => {
        const firstOpen = first.status === "completed" ? 1 : 0;
        const secondOpen = second.status === "completed" ? 1 : 0;
        if (firstOpen !== secondOpen) return firstOpen - secondOpen;
        return new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime();
      }),
    [checklists]
  );

  const archiveStats = useMemo(() => {
    const archivedTasks = checklistRecords.flatMap((checklist) => checklist.yacht_checklist_items || []);
    const completed = checklistRecords.filter((checklist) => checklist.status === "completed").length;
    const proofItems = archivedTasks.filter((task: any) => getTaskPhoto(task, "before") || getTaskPhoto(task, "after")).length;
    return {
      records: checklistRecords.length,
      tasks: archivedTasks.length,
      completed,
      proofItems,
    };
  }, [checklistRecords]);

  function updateContractDraft(field: keyof ContractDraft, value: string) {
    setContractDraft((current) => ({ ...current, [field]: value }));
  }

  const applySavedContractDraft = useCallback((
    savedDraft: ContractDraft,
    savedSectionKeys: Partial<Record<ContractSaveSectionKey, string>>,
    recordId = ""
  ) => {
    setContractDraft(savedDraft);
    setSavedContractDraft(savedDraft);
    setSavedContractSectionKeys(savedSectionKeys);
    if (recordId) setContractDraftRecordId(recordId);
  }, []);

  const loadSavedContractDraft = useCallback(async () => {
    if (!yachtId) return;

    let localDraft = null as ReturnType<typeof parseStoredContractDraftPayload>;

    if (contractDraftStorageKey) {
      try {
        localDraft = parseStoredContractDraftPayload(window.localStorage.getItem(contractDraftStorageKey));
      } catch (error) {
        console.warn("Contract draft local load failed", error);
      }

      if (localDraft) {
        applySavedContractDraft(localDraft.savedDraft, localDraft.savedSectionKeys);
      }
    }

    const response = await supabase
      .from("yacht_contracts")
      .select("id, contract_text")
      .eq("yacht_id", yachtId)
      .eq("status", "studio_draft")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (response.error) {
      if (!isSchemaCacheError(response.error)) {
        console.warn("Contract draft could not be loaded", response.error.message);
      }
      return;
    }

    if (response.data?.id) {
      setContractDraftRecordId(response.data.id);
    }

    const storedDraft = parseStoredContractDraftPayload(response.data?.contract_text);
    if (storedDraft) {
      const localSavedTime = Date.parse(localDraft?.savedAt || "");
      const remoteSavedTime = Date.parse(storedDraft.savedAt || "");
      const shouldUseRemoteDraft =
        !localDraft || !localSavedTime || (remoteSavedTime > 0 && remoteSavedTime >= localSavedTime);

      if (!shouldUseRemoteDraft) return;

      applySavedContractDraft(storedDraft.savedDraft, storedDraft.savedSectionKeys, response.data?.id || "");
      if (contractDraftStorageKey) {
        try {
          window.localStorage.setItem(
            contractDraftStorageKey,
            serializeContractDraftPayload(storedDraft.savedDraft, storedDraft.savedSectionKeys)
          );
        } catch (error) {
          console.warn("Contract draft local sync failed", error);
        }
      }
    }
  }, [applySavedContractDraft, contractDraftStorageKey, yachtId]);

  async function persistSavedContractDraft(
    nextSavedDraft: ContractDraft,
    nextSavedSectionKeys: Partial<Record<ContractSaveSectionKey, string>>
  ) {
    const contractText = serializeContractDraftPayload(nextSavedDraft, nextSavedSectionKeys);
    let localSaved = false;

    if (contractDraftStorageKey) {
      try {
        window.localStorage.setItem(contractDraftStorageKey, contractText);
        localSaved = true;
      } catch (error) {
        console.warn("Contract draft local save failed", error);
      }
    }

    if (!yachtId) return localSaved;

    let recordId = contractDraftRecordId;

    if (!recordId) {
      const existing = await supabase
        .from("yacht_contracts")
        .select("id")
        .eq("yacht_id", yachtId)
        .eq("status", "studio_draft")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing.data?.id) {
        recordId = existing.data.id;
        setContractDraftRecordId(recordId);
      }
    }

    const savedAt = new Date().toISOString();

    if (recordId) {
      const { error } = await supabase
        .from("yacht_contracts")
        .update({
          contract_text: contractText,
          sent_at: savedAt,
          status: "studio_draft",
        })
        .eq("id", recordId);

      if (!error) return true;
      console.warn("Contract draft update failed", error.message);
      return localSaved;
    }

    const { data, error } = await supabase
      .from("yacht_contracts")
      .insert({
        yacht_id: yachtId,
        contract_text: contractText,
        status: "studio_draft",
        sent_at: savedAt,
      })
      .select("id")
      .single();

    if (!error) {
      setContractDraftRecordId(data?.id || "");
      return true;
    }

    console.warn("Contract draft insert failed", error.message);
    return localSaved;
  }

  async function saveContractSection(sectionKey: ContractSaveSectionKey, fields: ContractDraftField[]) {
    if (savingContractSections[sectionKey]) return;

    const currentSectionSaveKey = contractSectionSaveKeys[sectionKey];
    const nextSavedDraft = copyContractFields(savedContractDraft, contractDraft, fields);
    const nextSavedSectionKeys = {
      ...savedContractSectionKeys,
      [sectionKey]: currentSectionSaveKey,
    };

    setSavingContractSections((current) => ({ ...current, [sectionKey]: true }));

    try {
      const persisted = await persistSavedContractDraft(nextSavedDraft, nextSavedSectionKeys);
      if (persisted) {
        setSavedContractDraft(nextSavedDraft);
        setSavedContractSectionKeys(nextSavedSectionKeys);
      } else {
        alert("Contract draft could not be saved. Please try again.");
      }
    } finally {
      setSavingContractSections((current) => ({ ...current, [sectionKey]: false }));
    }
  }

  async function downloadContractDraftPdf(mode: "download" | "preview" = "download") {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
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

    function drawCoverField(
      label: string,
      value: string | undefined | null,
      x: number,
      y: number,
      width: number,
      options: { fieldHeight?: number; maxLines?: number } = {}
    ) {
      const fieldHeight = options.fieldHeight || 18;
      const maxLines = options.maxLines || 1;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      setText("#082759");
      doc.text(label.toUpperCase(), x, y);
      setStroke("#9ec4ed");
      setFill("#ffffff");
      doc.roundedRect(x, y + 6, width, fieldHeight, 4, 4, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.6);
      setText("#17233a");
      const text = doc.splitTextToSize(contractSheetValue(value), width - 10);
      doc.text(text.slice(0, maxLines), x + 7, y + 19);
    }

    function drawCoverSection(section: ContractSheetSection, x: number, y: number, width: number, height: number) {
      const isSpecialConditions = section.title.toLowerCase().includes("special conditions");
      setStroke("#c4d9ee");
      setFill("#ffffff");
      doc.roundedRect(x, y, width, height, 9, 9, "FD");
      setFill("#fbfdff");
      doc.rect(x + 0.6, y + 0.6, width - 1.2, 34, "F");
      setStroke("#d8e7f5");
      doc.line(x, y + 34, x + width, y + 34);
      doc.setFont("times", "bold");
      doc.setFontSize(16);
      setText("#082759");
      doc.text(section.title.toUpperCase(), x + 18, y + 25.5);

      if (isSpecialConditions) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.4);
        setText("#17233a");
        const text = doc.splitTextToSize(contractSheetValue(section.rows[0]?.[1]), width - 52);
        doc.text(text.slice(0, 4), x + 26, y + 53);
        return;
      }

      const gap = 18;
      const colWidth = (width - 52 - gap) / 2;
      let fieldY = y + 48;
      section.rows.forEach(([label, value], index) => {
        const fullWidth = index < (section.wideFirstRows || 0);
        const multiline = false;
        const isLeft = index % 2 === 0;
        const fieldX = fullWidth ? x + 26 : x + 26 + (isLeft ? 0 : colWidth + gap);
        drawCoverField(label, value, fieldX, fieldY, fullWidth ? width - 52 : colWidth, {
          fieldHeight: multiline ? 34 : 18,
          maxLines: multiline ? 2 : 1,
        });
        if (fullWidth || !isLeft) fieldY += multiline ? 48 : 32;
      });

      if (section.footer) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.3);
        setText("#4f6680");
        doc.text(doc.splitTextToSize(section.footer, width - 52), x + 26, y + height - 17);
      }
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

      contractIntroParagraphs.forEach((paragraph) => {
        drawIntroText(paragraph, 9.8, 12.3);
        y += 10;
      });

      contractIntroAnnexes.forEach((annex, index) => {
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
      contractIntroClosingParagraphs.forEach((paragraph) => {
        drawIntroText(paragraph, 9.1, 11.5);
        y += 8;
      });

      setStroke("#d8e7f5");
      doc.line(x, pageHeight - 58, x + width, pageHeight - 58);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.6);
      setText("#4f6680");
      doc.text(contractIntroFooterNotice, x, pageHeight - 43);
    }

    function drawContractCoverPage() {
      doc.addPage();
      drawBodyPageHeader("ANNEX A - PARTIES");
      const sections = getContractCoverSections(contractPreviewDraft, selectedContractMember);
      drawCoverSection(sections[0], 42, 82, pageWidth - 84, 198);
      drawCoverSection(sections[1], 42, 290, pageWidth - 84, 166);
      drawCoverSection(sections[2], 42, 466, pageWidth - 84, 180);
    }

    function drawContractTermsPage() {
      doc.addPage();
      drawBodyPageHeader("ANNEX B - EMPLOYMENT TERMS");
      const sections = getContractTermsSections(contractPreviewDraft, selectedContractMember);
      drawCoverSection(sections[0], 42, 82, pageWidth - 84, 164);
      drawCoverSection(sections[1], 42, 254, pageWidth - 84, 136);
      drawCoverSection(sections[2], 42, 398, pageWidth - 84, 136);
      drawCoverSection(sections[3], 42, 542, pageWidth - 84, 106);

      const left = 54;
      const right = pageWidth - 54;
      const width = right - left;
      const bottom = pageHeight - 58;
      let y = 674;
      const sourceLines = contractDisplayLines([contractSheetValue(contractPreviewDraft.specialConditions)]);
      const wrappedLines = sourceLines.flatMap((line) => {
        if (!line) return [""];
        return doc.splitTextToSize(line, width) as string[];
      });

      doc.setFont("times", "bold");
      doc.setFontSize(14);
      setText("#082759");
      doc.text("SPECIAL CONDITIONS", left, y);
      setStroke("#b8d2ee");
      doc.line(left, y + 8, right, y + 8);
      y += 26;

      function addAnnexBContinuationPage() {
        doc.addPage();
        drawBodyPageHeader("ANNEX B - EMPLOYMENT TERMS");
        y = 92;
      }

      wrappedLines.forEach((line) => {
        const lineHeight = line ? 10.8 : 5.4;
        if (y + lineHeight > bottom) addAnnexBContinuationPage();
        if (line) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.7);
          setText("#17233a");
          doc.text(line, left + 4, y);
        }
        y += lineHeight;
      });
    }

    function drawBodyPageHeader(subtitle?: string) {
      drawContractPageBase();
      drawContractDocumentHeader(subtitle);
    }

    function drawBodyPages() {
      const sections = getContractDocumentSections(contractPreviewDraft, selectedContractMember);
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

        contractAnnexCClauses.forEach((clause, clauseIndex) => {
          (doc.splitTextToSize(`${clause.number}. ${clause.title}`, lineWidth) as string[]).forEach((text) => {
            rows.push({ kind: "heading", text });
          });

          clause.body.forEach((paragraph) => {
            (doc.splitTextToSize(paragraph, lineWidth) as string[]).forEach((text) => {
              rows.push({ kind: "body", text });
            });
            rows.push({ kind: "space", text: "" });
          });

          if (clauseIndex < contractAnnexCClauses.length - 1) {
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
          drawSinglePageSection(section, "ANNEX D - DECLARATION AND SIGNATURES");
          return;
        }

        drawSinglePageSection(section, section.title.toUpperCase());
      });
    }

    drawContractIntroPage();
    drawContractCoverPage();
    drawBodyPages();
    const totalPages = doc.getNumberOfPages();
    for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
      doc.setPage(pageNo);
      drawContractPageFooter(pageNo, totalPages);
    }

    const pdfBlob = doc.output("blob");
    if (mode === "download") {
      doc.save(buildContractFileName(contractPreviewDraft, selectedContractMember));
    }

    return pdfBlob;
  }

  function toggleProgressCard(id: string) {
    setExpandedProgress((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function openChecklistPack(id: string) {
    setActiveChecklistPack(id);
    setTemplateSearch("");
    setTemplateDepartmentFilter("All");
    setTemplateFrequencyFilter("All");
  }

  function toggleTemplateTaskPanel(id: string) {
    setExpandedTemplateTasks((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function getTemplateAssignmentTasks(template: { id: string; tasks: string[] }) {
    return templateTaskDrafts[template.id] || template.tasks;
  }

  function updateTemplateTask(templateId: string, baseTasks: string[], index: number, value: string) {
    const next = [...(templateTaskDrafts[templateId] || baseTasks)];
    next[index] = value;
    setTemplateTaskDrafts((current) => ({ ...current, [templateId]: next }));
  }

  function removeTemplateTask(templateId: string, baseTasks: string[], index: number) {
    const next = [...(templateTaskDrafts[templateId] || baseTasks)].filter((_, taskIndex) => taskIndex !== index);
    setTemplateTaskDrafts((current) => ({ ...current, [templateId]: next }));
  }

  function addTemplateTask(templateId: string, baseTasks: string[]) {
    const task = (newTemplateTasks[templateId] || "").trim();
    if (!task) return;

    const next = [...(templateTaskDrafts[templateId] || baseTasks), task];
    setTemplateTaskDrafts((current) => ({ ...current, [templateId]: next }));
    setNewTemplateTasks((current) => ({ ...current, [templateId]: "" }));
  }

  function resetTemplateTasks(templateId: string) {
    setTemplateTaskDrafts((current) => {
      const next = { ...current };
      delete next[templateId];
      return next;
    });
    setNewTemplateTasks((current) => {
      const next = { ...current };
      delete next[templateId];
      return next;
    });
  }

  function addManualTask(taskOverride?: string) {
    const task = (taskOverride || manualTaskDraft).trim();
    if (!task) return;

    setManualTasks((current) => [...current, task]);
    setManualTaskDraft("");
  }

  function updateManualTask(index: number, value: string) {
    setManualTasks((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function removeManualTask(index: number) {
    setManualTasks((current) => current.filter((_, taskIndex) => taskIndex !== index));
  }

  async function createManualChecklist() {
    if (!selectedCrew) {
      alert("Select crew member");
      return;
    }

    const category = activeManualCategory || checklistTaskCategories[0];
    const assignmentDepartment = category.department;
    const title = manualTitle.trim() || `${category.label} Checklist`;
    const type = manualType.trim() || category.type || "Custom Routine";
    const tasks = manualTasks.map((task) => task.trim()).filter(Boolean);

    if (tasks.length === 0) {
      alert("Add at least one checklist task.");
      return;
    }

    const member = crew.find((item) => item.id === selectedCrew);
    if (
      !member ||
      !canAssignToCrew(
        operator.position,
        operator.department,
        member.position || member.crew_profiles?.current_position,
        member.department,
        operator.role
      )
    ) {
      alert("You can only assign checklists to crew below you in the yacht hierarchy.");
      return;
    }

    if (
      !canAssignChecklistDepartment(
        operator.position,
        operator.department,
        assignmentDepartment,
        operator.role
      )
    ) {
      alert(`${assignmentDepartment} is outside your checklist authority.`);
      return;
    }

    setLoading(true);

    const { data: checklist, error } = await createChecklist({
      yacht_id: yachtId,
      title,
      department: assignmentDepartment,
      checklist_type: type,
      frequency: frequency === "Template default" ? "One-time" : frequency,
      captain_note: captainNote || null,
      assigned_to: member?.crew_profile_id,
      due_date: dueDate || null,
      status: "open",
      items: {
        frequency: frequency === "Template default" ? "One-time" : frequency,
        captain_note: captainNote || null,
        tasks,
        source_template: "manual",
        summary: "Manual BlueDeck checklist created onboard.",
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const { error: itemError } = await insertChecklistItems(
      tasks.map((task) => ({
        checklist_id: checklist.id,
        task_text: task,
        completed: false,
      }))
    );

    if (itemError) {
      alert(itemError.message);
      setLoading(false);
      return;
    }

    setManualTitle("");
    setManualType("Custom Routine");
    setManualTaskDraft("");
    setManualTasks([]);
    setCaptainNote("");
    setDueDate("");
    setLoading(false);
    loadData();

    alert("Manual checklist assigned.");
  }

  async function loadData(silent = false) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch(`/api/yachts/${encodeURIComponent(yachtId)}/crew-data`, {
      cache: "no-store",
      headers: session?.access_token
        ? {
            authorization: `Bearer ${session.access_token}`,
          }
        : {},
    });
    const payload = await response.json();

    if (!response.ok || !payload?.ok) {
      if (!silent) alert(payload?.error || "Crew data could not be loaded.");
      return;
    }

    const crewData = payload.crew || [];
    const checklistData = payload.checklists || [];

    setCrew(crewData);
    setChecklists(checklistData);
    setArchiveRetention(payload.checklist_retention || null);
    loadCurrentOperator(crewData, user, payload.operator);
  }

  function loadCurrentOperator(crewData: any[], user: any, resolvedOperator?: any) {
    const role = normalizeAccountRole(
      resolvedOperator?.role ||
        (typeof user?.user_metadata?.role === "string" ? user.user_metadata.role : "")
    );

    const normalizedUserEmail = normalizeEmail(user.email);
    const membership = crewData.find((member) => {
      return (
        member.crew_profiles?.user_id === user.id ||
        normalizeEmail(member.crew_profiles?.email) === normalizedUserEmail ||
        normalizeEmail(member.invited_email) === normalizedUserEmail
      );
    });

    if (!membership && !resolvedOperator && role !== "captain" && role !== "management" && role !== "owner") {
      setOperator({ position: "", department: "", role });
      return;
    }

    const operatorPosition =
      resolvedOperator?.position ||
      membership?.position ||
      membership?.crew_profiles?.current_position ||
      getDefaultPositionForAccountType(role);

    setOperator({
      position: operatorPosition || "",
      department:
        resolvedOperator?.department ||
        membership?.department ||
        getDepartmentByPosition(operatorPosition),
      role,
    });
  }

  useEffect(() => {
    if (!yachtId) return;
    loadData();
    const interval = window.setInterval(() => loadData(true), 10000);
    return () => window.clearInterval(interval);
  }, [yachtId]);

  useEffect(() => {
    if (!yachtId) return;
    const restoreTimer = window.setTimeout(() => {
      void loadSavedContractDraft();
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [loadSavedContractDraft, yachtId]);

  useEffect(() => {
    if (!photoPreview) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPhotoPreview(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photoPreview]);

  useEffect(() => {
    setSelectedTemplates((current) =>
      current.filter((id) => availableTemplates.some((template) => template.id === id))
    );
  }, [availableTemplates]);

  useEffect(() => {
    if (!selectedCrew) return;
    if (!assignableCrew.some((member) => member.id === selectedCrew)) {
      setSelectedCrew("");
    }
  }, [assignableCrew, selectedCrew]);

  useEffect(() => {
    if (manualDepartmentOptions.includes(manualDepartment as any)) return;
    setManualDepartment(manualDepartmentOptions[0] || "Deck");
  }, [manualDepartment, manualDepartmentOptions]);

  useEffect(() => {
    if (manualCategoryOptions.some((category) => category.id === manualCategoryId)) return;
    setManualCategoryId(manualCategoryOptions[0]?.id || "deck");
  }, [manualCategoryId, manualCategoryOptions]);

  async function addCrew() {
    if (!inviteEmail && !crewPublicId) {
      alert("Crew email or Crew ID required");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`/api/yachts/${encodeURIComponent(yachtId)}/crew-invitations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(session?.access_token
            ? {
                authorization: `Bearer ${session.access_token}`,
              }
            : {}),
        },
        body: JSON.stringify({
          crewId: crewPublicId.trim() || undefined,
          email: inviteEmail.trim() || undefined,
          position,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        alert(payload?.error || "Crew invitation could not be created.");
        return;
      }

      setInviteEmail("");
      setCrewPublicId("");
      setInviteNotice("Invitation is now waiting inside the crew member's My YachtOS portal.");
      void loadData();

      alert("Crew invitation created. The crew member will see it inside My YachtOS.");
    } catch {
      alert("Crew invitation could not be created. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleTemplate(key: string) {
    const template = checklistTemplates.find((item) => item.id === key);
    if (
      template &&
      !canAssignChecklistDepartment(
        operator.position,
        operator.department,
        template.department,
        operator.role
      )
    ) {
      alert(`${template.title} is outside your checklist authority.`);
      return;
    }

    setSelectedTemplates((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  }

  async function assignSelectedChecklists() {
    if (!selectedCrew) {
      alert("Select crew member");
      return;
    }

    if (selectedTemplates.length === 0) {
      alert("Select checklist");
      return;
    }

    setLoading(true);

    const member = crew.find((item) => item.id === selectedCrew);
    if (
      !member ||
      !canAssignToCrew(
        operator.position,
        operator.department,
        member.position || member.crew_profiles?.current_position,
        member.department,
        operator.role
      )
    ) {
      alert("You can only assign checklists to crew below you in the yacht hierarchy.");
      setLoading(false);
      return;
    }

    for (const key of selectedTemplates) {
      const template = checklistTemplates.find((item) => item.id === key);
      if (!template) continue;
      if (
        !canAssignChecklistDepartment(
          operator.position,
          operator.department,
          template.department,
          operator.role
        )
      ) {
        alert(`${template.title} is outside your checklist authority.`);
        continue;
      }

      const assignmentTasks = getTemplateAssignmentTasks(template)
        .map((task) => task.trim())
        .filter(Boolean);

      if (assignmentTasks.length === 0) {
        alert(`${template.title} has no task items to assign.`);
        continue;
      }

      const { data: checklist, error } = await createChecklist({
        yacht_id: yachtId,
        title: template.title,
        department: template.department,
        checklist_type: template.type,
        frequency: frequency === "Template default" ? template.frequency : frequency,
        captain_note: captainNote || null,
        assigned_to: member?.crew_profile_id,
        due_date: dueDate || null,
        status: "open",
        items: {
          frequency: frequency === "Template default" ? template.frequency : frequency,
          captain_note: captainNote || null,
          tasks: assignmentTasks,
          source_template: template.id,
          summary: template.summary,
        },
      });

      if (error) {
        alert(error.message);
        continue;
      }

      const tasks = assignmentTasks.map((task: string) => ({
        checklist_id: checklist.id,
        task_text: task,
        completed: false,
      }));

      const { error: itemError } = await insertChecklistItems(tasks);
      if (itemError) alert(itemError.message);
    }

    setSelectedTemplates([]);
    setCaptainNote("");
    setDueDate("");
    setLoading(false);
    loadData();

    alert("Checklist assigned.");
  }

  async function createChecklist(payload: Record<string, any>) {
    const variants = [
      payload,
      omitKeys(payload, ["captain_note"]),
      omitKeys(payload, ["frequency"]),
      omitKeys(payload, ["frequency", "captain_note"]),
      omitKeys(payload, ["items"]),
      omitKeys(payload, ["items", "captain_note"]),
      omitKeys(payload, ["items", "frequency"]),
      omitKeys(payload, ["items", "frequency", "captain_note"]),
      omitKeys(payload, ["items", "due_date"]),
      omitKeys(payload, ["items", "due_date", "status"]),
      omitKeys(payload, ["items", "frequency", "captain_note", "due_date"]),
      omitKeys(payload, ["items", "frequency", "captain_note", "due_date", "status"]),
    ];

    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase
        .from("yacht_checklists")
        .insert(variant)
        .select()
        .single();

      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  async function insertChecklistItems(tasks: any[]) {
    const variants = [
      tasks,
      tasks.map((task) => omitKeys(task, ["completed"])),
    ];

    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase.from("yacht_checklist_items").insert(variant);
      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  function getAssignedCrewLabel(checklist: any) {
    const assignedCrew = crew.find(
      (member) => member.crew_profile_id === checklist.assigned_to
    );
    return (
      assignedCrew?.crew_profiles?.full_name ||
      assignedCrew?.invited_email ||
      checklist.assigned_to ||
      "Crew member"
    );
  }

  async function downloadChecklistArchivePdf() {
    if (checklistRecords.length === 0) {
      alert("No checklist records are available in the 6-month archive.");
      return;
    }

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    let y = 48;

    function ensureSpace(height: number) {
      if (y + height <= pageHeight - 58) return;
      doc.setDrawColor(23, 84, 96);
      doc.line(margin, pageHeight - 44, pageWidth - margin, pageHeight - 44);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("BlueDeck checklist archive - records are retained for 6 months.", margin, pageHeight - 28);
      doc.addPage();
      y = 48;
    }

    function writeWrapped(text: string, x: number, maxWidth: number, lineHeight = 13) {
      const lines = doc.splitTextToSize(text || "-", maxWidth);
      lines.forEach((line: string) => {
        ensureSpace(lineHeight + 3);
        doc.text(line, x, y);
        y += lineHeight;
      });
    }

    doc.setFillColor(7, 24, 39);
    doc.roundedRect(margin, y, contentWidth, 58, 14, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("BlueDeck Checklist Archive", margin + 18, y + 25);
    doc.setFontSize(9);
    doc.setTextColor(175, 239, 247);
    doc.text(`Last 6 months / ${checklistRecords.length} checklist records`, margin + 18, y + 43);
    y += 82;

    checklistRecords.forEach((checklist, index) => {
      const progress = getChecklistProgress(checklist);
      const tasks = checklist.yacht_checklist_items || [];
      const assignedCrew = getAssignedCrewLabel(checklist);
      const created = checklist.created_at ? formatDateTime(checklist.created_at) : "-";
      const completed = checklist.completed_at ? formatDateTime(checklist.completed_at) : "-";

      ensureSpace(126);
      doc.setDrawColor(210, 226, 232);
      doc.setFillColor(248, 252, 253);
      doc.roundedRect(margin, y, contentWidth, 86, 10, 10, "FD");

      doc.setTextColor(7, 24, 39);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`${index + 1}. ${checklist.title || "Checklist"}`, margin + 14, y + 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Crew: ${assignedCrew}`, margin + 14, y + 37);
      doc.text(`Department: ${checklist.department || "-"} / ${checklist.checklist_type || "-"}`, margin + 14, y + 52);
      doc.text(`Created: ${created}   Completed: ${completed}`, margin + 14, y + 67);
      doc.text(`Status: ${checklist.status || "open"}   Progress: ${progress.done}/${progress.total} (${progress.percent}%)`, pageWidth - margin - 210, y + 37);
      doc.text(`Frequency: ${getChecklistFrequency(checklist) || "-"}`, pageWidth - margin - 210, y + 52);
      doc.text(`Due: ${checklist.due_date || "-"}`, pageWidth - margin - 210, y + 67);
      y += 106;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(21, 94, 117);
      doc.text("Tasks", margin, y);
      y += 15;

      tasks.forEach((task: any, taskIndex: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.6);
        doc.setTextColor(51, 65, 85);
        const status = task.completed ? "done" : "open";
        const proof = getTaskPhoto(task, "before") || getTaskPhoto(task, "after") ? " / proof" : "";
        writeWrapped(`${taskIndex + 1}. [${status}${proof}] ${task.task_text || "-"}`, margin + 8, contentWidth - 16, 12);
      });

      const note = getChecklistNote(checklist);
      if (note) {
        y += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.6);
        doc.setTextColor(7, 24, 39);
        doc.text("Captain note", margin, y);
        y += 12;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        writeWrapped(note, margin + 8, contentWidth - 16, 12);
      }

      y += 16;
    });

    doc.setDrawColor(23, 84, 96);
    doc.line(margin, pageHeight - 44, pageWidth - margin, pageHeight - 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("BlueDeck checklist archive - records are retained for 6 months.", margin, pageHeight - 28);
    doc.save(`BlueDeck-checklist-archive-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function assignContract() {
    if (!selectedCrew) {
      alert("Select crew member");
      return;
    }

    if (!contractPreviewText.trim()) {
      alert("Contract details required");
      return;
    }

    const member = crew.find((item) => item.id === selectedCrew);

    const { error } = await insertContract({
      yacht_id: yachtId,
      crew_profile_id: member?.crew_profile_id,
      membership_id: selectedCrew,
      contract_text: contractPreviewText,
      status: "sent_for_signature",
      sent_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
      return;
    }

    setContractStep("preview");
    alert("Contract sent for mobile signature.");
  }

  async function insertContract(payload: Record<string, any>) {
    const variants = [
      payload,
      omitKeys(payload, ["sent_at"]),
      omitKeys(payload, ["membership_id"]),
      omitKeys(payload, ["sent_at", "membership_id"]),
    ];
    let lastResponse: any = null;

    for (const variant of variants) {
      const response = await supabase.from("yacht_contracts").insert(variant);

      if (!response.error) return response;
      lastResponse = response;

      if (!isSchemaCacheError(response.error)) return response;
    }

    return lastResponse;
  }

  return (
    <main className="bd-crew-command-page min-h-screen w-full min-w-0 overflow-x-hidden bg-[linear-gradient(135deg,#fbf7ef_0%,#eef7f8_48%,#f7efe0_100%)] px-4 py-5 pb-12 text-slate-900 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-[1700px]">
        <div className="mb-6 overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-2xl shadow-cyan-950/10 backdrop-blur sm:mb-10 sm:rounded-[40px]">
          <div className="h-1.5 bg-[linear-gradient(90deg,#08111f,#22d3ee,#d8b45f,#ef776f)]" />
          <div className={isChecklistSystem ? "grid min-w-0 gap-6 p-5 sm:p-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]" : "p-5 sm:p-10"}>
            <div className="min-w-0">
              <p className="font-semibold uppercase tracking-[0.18em] text-cyan-700">
                {isChecklistSystem ? "BlueDeck ChecklistOS" : "BlueDeck CrewOS"}
              </p>
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
                {isChecklistSystem ? "Checklist System" : "Yacht Crew Command"}
              </h1>
              <p className="mt-4 max-w-4xl text-base leading-relaxed text-slate-500 sm:mt-5 sm:text-xl">
                {isChecklistSystem
                  ? "Assign yacht-ready operational routines, verify crew progress and keep proof photos in one controlled captain workspace."
                  : "Invite crew, manage onboard roles and send yacht contracts from one clean crew command workspace."}
              </p>
            </div>

            {isChecklistSystem && checklistSection === "monitor" && (
              <div className="grid gap-3 rounded-[28px] border border-cyan-100 bg-[linear-gradient(135deg,#071827_0%,#0d3143_58%,#eafcff_58%,#ffffff_100%)] p-4 shadow-inner shadow-cyan-950/15 sm:grid-cols-2">
                <InsightCard label="Open tasks" value={checklistInsights.openTasks} tone="dark" icon={<ListChecks />} />
                <InsightCard label="Progress" value={`${checklistInsights.progress}%`} tone="aqua" icon={<CheckCircle />} />
                <InsightCard label="Due soon" value={checklistInsights.dueSoon} tone="amber" icon={<CalendarClock />} />
                <InsightCard label="Proof records" value={checklistInsights.proofItems} tone="white" icon={<FileCheck2 />} />
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 md:mb-10 md:grid-cols-4 md:gap-6">
          <Stat title="Crew" value={crew.length} icon={<Bell />} />
          {isChecklistSystem ? (
            <>
              <Stat title="Open Checklists" value={checklistInsights.openChecklists} icon={<ClipboardList />} />
              <Stat title="Library" value={`${checklistTemplates.length} templates`} icon={<ShipWheel />} />
            </>
          ) : (
            <>
              <Stat title="Assignable Crew" value={assignableCrew.length} icon={<UserRound />} />
              <Stat
                title="Invited"
                value={crew.filter((member) => member.status === "invited").length}
                icon={<Plus />}
              />
            </>
          )}
          <Stat title="Authority" value={operator.position} icon={<CheckSquare />} />
        </div>

        {!isChecklistSystem && (
          <section className="mb-8 rounded-[32px] border border-cyan-100 bg-[linear-gradient(135deg,#f8fdff_0%,#ffffff_54%,#eefcff_100%)] p-5 shadow-2xl shadow-cyan-950/8 sm:mb-10 sm:rounded-[42px] sm:p-7">
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="rounded-[28px] border border-white bg-white/88 p-5 shadow-xl shadow-cyan-950/6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-700 text-white shadow-[0_18px_40px_rgba(8,145,178,0.22)]">
                        <UserPlus className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                          Crew Invitation
                        </p>
                        <h3 className="text-2xl font-black text-slate-950">Send invite</h3>
                      </div>
                    </div>

                    <div className="mt-6 space-y-4">
                      <input
                        placeholder="Crew ID"
                        value={crewPublicId}
                        onChange={(e) => setCrewPublicId(e.target.value.toUpperCase())}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg font-black uppercase tracking-[0.08em] text-slate-950 outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-cyan-300"
                      />

                      <select
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg font-black text-slate-950 outline-none focus:border-cyan-300"
                      >
                        {positionSelectGroups.map((group) => (
                          <optgroup key={group.department} label={group.department}>
                            {group.positions.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      <input
                        placeholder="Crew email if Crew ID is not known"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                      />

                      <button
                        type="button"
                        onClick={addCrew}
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 py-4 text-lg font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-cyan-800 disabled:opacity-60"
                      >
                        <Send className="h-5 w-5" />
                        {loading ? "Sending..." : "Send Yacht Invite"}
                      </button>

                      {inviteNotice && (
                        <div className="rounded-2xl border border-cyan-400/25 bg-cyan-50 p-4 text-sm text-slate-700">
                          <p className="font-bold">Invitation sent</p>
                          <p className="mt-2 leading-6">{inviteNotice}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-cyan-100 bg-white/78 p-5 shadow-inner shadow-cyan-950/6">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                      Invite Status
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-slate-950">Recent crew access</h3>
                    <div className="mt-5 space-y-3">
                      {crew.slice(0, 6).map((member) => (
                        <div key={member.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-black text-slate-950">
                                {member.crew_profiles?.full_name || member.invited_email || member.crew_profiles?.email || "Crew member"}
                              </p>
                              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-cyan-800">
                                {member.position || "Crew"} · {member.department || "Yacht"}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                              member.status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              {member.status || "invited"}
                            </span>
                          </div>
                        </div>
                      ))}

                      {crew.length === 0 && (
                        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold text-slate-500">
                          Invite your first crew member to open this yacht&apos;s controlled crew access.
                        </p>
                      )}
                    </div>
                  </div>
                  </div>
          </section>
        )}

        {!isChecklistSystem && (
          <section className="mb-8 overflow-hidden rounded-[28px] border border-[#2fb6c7]/25 bg-white shadow-2xl shadow-slate-950/14 sm:mb-10">
            <div className="h-1 bg-[linear-gradient(90deg,#07313b_0%,#8ed8e6_36%,#21aebf_72%,#0a4452_100%)]" />
            <div className="border-b border-white/12 bg-[linear-gradient(135deg,#08242e_0%,#0e4f5d_54%,#106f7f_100%)] px-5 py-4 text-white sm:px-6 sm:py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8ed8e6]">
                    BlueDeck Contract Studio
                  </p>
                  <h2 className="bd-contract-studio-current mt-2 text-2xl font-black leading-tight drop-shadow-sm sm:text-3xl lg:text-4xl">
                    {activeContractStepInfo.title}
                  </h2>
                  <p className="bd-contract-studio-current mt-1 text-sm font-semibold sm:text-base">
                    {activeContractStepInfo.meta}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-b border-[#2fb6c7]/20 bg-[#eef7f8] px-4 py-3 sm:px-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {contractStepCards.map((step) => {
                  const active = contractStep === step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setContractStep(step.id)}
                      className={`bd-focus group flex min-h-[72px] items-center gap-3 rounded-[16px] border p-3 text-left transition ${
                        active
                          ? "border-[#21aebf] bg-white text-[#0b2330] shadow-lg shadow-[#21aebf]/16 ring-2 ring-[#21aebf]/24"
                          : "border-[#cde7ec] bg-white text-[#0b2330] shadow-sm shadow-slate-950/5 hover:border-[#5fd3e5] hover:bg-[#f8fcfd]"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                          active ? "border-[#21aebf] bg-[#eef7f8] text-[#0b6b7b]" : "border-[#d7eaf0] bg-[#eef7f8] text-[#0b6b7b] group-hover:border-[#5fd3e5]"
                        }`}
                      >
                        <ContractStepIcon step={step.id} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{step.title}</span>
                        <span className="block truncate text-[11px] font-semibold text-slate-500">{step.meta}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#f6f9fa] p-5 sm:p-8">
              {contractStep === "parties" && (
                <div className="space-y-5">
                  <div className="overflow-hidden rounded-[26px] border border-[#bfd8ea] bg-white shadow-sm shadow-slate-950/5">
                    <div className="flex items-center justify-between gap-4 border-b border-[#d9e8f3] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-5 py-4">
                      <div className="flex items-center gap-4">
                        <h3 className="font-serif text-2xl font-black uppercase tracking-[0.02em] text-[#082759]">
                          Yacht details
                        </h3>
                      </div>
                      <span className="hidden text-xs font-bold text-[#0d58ae] sm:block">
                        To be completed by the Owner / Company
                      </span>
                    </div>
                    <div className="grid gap-4 p-5 lg:grid-cols-2">
                        <ContractField
                          label="Yacht name"
                          value={contractDraft.vesselName}
                          onChange={(value) => updateContractDraft("vesselName", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Flag state"
                          value={contractDraft.flagState}
                          onChange={(value) => updateContractDraft("flagState", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Official / registration number"
                          value={contractDraft.officialNumber}
                          onChange={(value) => updateContractDraft("officialNumber", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="IMO number"
                          value={contractDraft.imoNumber}
                          onChange={(value) => updateContractDraft("imoNumber", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Call sign"
                          value={contractDraft.callSign}
                          onChange={(value) => updateContractDraft("callSign", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Vessel type"
                          value={contractDraft.vesselType}
                          onChange={(value) => updateContractDraft("vesselType", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Length overall - LOA"
                          value={contractDraft.lengthOverall}
                          onChange={(value) => updateContractDraft("lengthOverall", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Gross tonnage"
                          value={contractDraft.grossTonnage}
                          onChange={(value) => updateContractDraft("grossTonnage", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Port of registry"
                          value={contractDraft.portOfRegistry}
                          onChange={(value) => updateContractDraft("portOfRegistry", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Engine power"
                          value={contractDraft.enginePower}
                          onChange={(value) => updateContractDraft("enginePower", value)}
                          placeholder=""
                        />
                    </div>
                    <div className="flex justify-end border-t border-[#d9e8f3] px-5 py-4">
                      <ContractSectionSaveButton
                        saved={contractSectionSaved.annexAYacht}
                        saving={Boolean(savingContractSections.annexAYacht)}
                        onSave={() => saveContractSection("annexAYacht", contractAnnexAYachtFields)}
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[26px] border border-[#bfd8ea] bg-white shadow-sm shadow-slate-950/5">
                    <div className="flex items-center justify-between gap-4 border-b border-[#d9e8f3] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-5 py-4">
                      <div className="flex items-center gap-4">
                        <h3 className="font-serif text-2xl font-black uppercase tracking-[0.02em] text-[#082759]">
                          Owner / Company details
                        </h3>
                      </div>
                      <span className="hidden text-xs font-bold text-[#0d58ae] sm:block">
                        Legal contracting party
                      </span>
                    </div>
                    <div className="grid gap-4 p-5 lg:grid-cols-2">
                        <ContractField
                          className="lg:col-span-2"
                          label="Owner / company legal name"
                          value={contractDraft.ownerCompanyName}
                          onChange={(value) => updateContractDraft("ownerCompanyName", value)}
                          placeholder=""
                        />
                        <ContractField
                          className="lg:col-span-2"
                          label="Registered address"
                          value={contractDraft.ownerRegisteredAddress}
                          onChange={(value) => updateContractDraft("ownerRegisteredAddress", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Authorized representative"
                          value={contractDraft.ownerRepresentative}
                          onChange={(value) => updateContractDraft("ownerRepresentative", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Representative address / passport no"
                          value={contractDraft.ownerRepresentativeDetails}
                          onChange={(value) => updateContractDraft("ownerRepresentativeDetails", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Email"
                          value={contractDraft.ownerEmail}
                          onChange={(value) => updateContractDraft("ownerEmail", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Telephone"
                          value={contractDraft.ownerTelephone}
                          onChange={(value) => updateContractDraft("ownerTelephone", value)}
                          placeholder=""
                        />
                    </div>
                    <div className="flex justify-end border-t border-[#d9e8f3] px-5 py-4">
                      <ContractSectionSaveButton
                        saved={contractSectionSaved.annexAOwner}
                        saving={Boolean(savingContractSections.annexAOwner)}
                        onSave={() => saveContractSection("annexAOwner", contractAnnexAOwnerFields)}
                      />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[26px] border border-[#bfd8ea] bg-white shadow-sm shadow-slate-950/5">
                    <div className="flex items-center justify-between gap-4 border-b border-[#d9e8f3] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-5 py-4">
                      <div className="flex items-center gap-4">
                        <h3 className="font-serif text-2xl font-black uppercase tracking-[0.02em] text-[#082759]">
                          Crew member details
                        </h3>
                      </div>
                      <span className="hidden text-xs font-bold text-[#0d58ae] sm:block">
                        Employee / Seafarer information
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="rounded-[22px] border border-dashed border-[#9fc6e7] bg-[#f7fbff] p-5">
                        <p className="text-sm font-semibold leading-7 text-slate-600">
                          The final contract will be sent to the selected crew member through BlueDeck. The crew member will accept the contract and complete their own crew details; after completion, those details will appear on the final contract.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {contractStep === "terms" && (
                <div className="space-y-5">
                    <ContractTermsBlock
                      title="Agreement details"
                      note="Complete all applicable fields"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <ContractField
                          label="Crewmember name"
                          value={contractDraft.employeeName}
                          onChange={(value) => updateContractDraft("employeeName", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Position"
                          value={contractDraft.employeePosition}
                          onChange={(value) => updateContractDraft("employeePosition", value)}
                          placeholder=""
                        />
                        <ContractDateField
                          label="Agreement start date"
                          value={contractDraft.agreementStartDate}
                          onChange={(value) => updateContractDraft("agreementStartDate", value)}
                        />
                        <ContractDateField
                          label="Agreement end date"
                          value={contractDraft.agreementEndDate}
                          onChange={(value) => updateContractDraft("agreementEndDate", value)}
                        />
                        <ContractSelectField
                          label="Agreement type"
                          value={contractDraft.agreementType}
                          onChange={(value) => updateContractDraft("agreementType", value)}
                          options={contractAgreementTypeOptions}
                        />
                        <ContractField
                          label="Trial period"
                          value={contractDraft.trialPeriod}
                          onChange={(value) => updateContractDraft("trialPeriod", value)}
                          placeholder=""
                        />
                        <ContractField
                          label="Place of engagement"
                          value={contractDraft.placeOfEngagement}
                          onChange={(value) => updateContractDraft("placeOfEngagement", value)}
                          placeholder=""
                        />
                        <ContractDateField
                          label="Trial period end date"
                          value={contractDraft.trialPeriodEndDate}
                          onChange={(value) => updateContractDraft("trialPeriodEndDate", value)}
                        />
                      </div>
                      <div className="mt-4 flex justify-end border-t border-[#d9e8f3] pt-4">
                        <ContractSectionSaveButton
                          saved={contractSectionSaved.annexBAgreement}
                          saving={Boolean(savingContractSections.annexBAgreement)}
                          onSave={() => saveContractSection("annexBAgreement", contractAnnexBAgreementFields)}
                        />
                      </div>
                    </ContractTermsBlock>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <ContractTermsBlock
                        title="Terms within trial period"
                        note="if applicable"
                      >
                        <div className="grid gap-4">
                          <ContractMoneyField
                            label="Salary"
                            amount={contractDraft.trialSalary}
                            currency={contractDraft.trialSalaryCurrency}
                            onAmountChange={(value) => updateContractDraft("trialSalary", value)}
                            onCurrencyChange={(value) => updateContractDraft("trialSalaryCurrency", value)}
                          />
                          <ContractSelectField
                            label="Salary accrual"
                            value={contractDraft.trialSalaryAccrual}
                            onChange={(value) => updateContractDraft("trialSalaryAccrual", value)}
                            options={contractSalaryAccrualOptions}
                          />
                          <ContractField
                            label="Notice period"
                            value={contractDraft.trialNoticePeriod}
                            onChange={(value) => updateContractDraft("trialNoticePeriod", value)}
                            placeholder=""
                          />
                          <ContractField
                            label="Annual leave"
                            value={contractDraft.trialAnnualLeave}
                            onChange={(value) => updateContractDraft("trialAnnualLeave", value)}
                            placeholder=""
                          />
                          <ContractField
                            label="Place of repatriation"
                            value={contractDraft.trialPlaceOfRepatriation}
                            onChange={(value) => updateContractDraft("trialPlaceOfRepatriation", value)}
                            placeholder=""
                          />
                          <ContractField
                            label="Travel allowance"
                            value={contractDraft.trialTravelAllowance}
                            onChange={(value) => updateContractDraft("trialTravelAllowance", value)}
                            placeholder=""
                          />
                        </div>
                        <div className="mt-4 flex justify-end border-t border-[#d9e8f3] pt-4">
                          <ContractSectionSaveButton
                            saved={contractSectionSaved.annexBTrial}
                            saving={Boolean(savingContractSections.annexBTrial)}
                            onSave={() => saveContractSection("annexBTrial", contractAnnexBTrialFields)}
                          />
                        </div>
                      </ContractTermsBlock>

                      <ContractTermsBlock title="Standard terms">
                        <div className="grid gap-4">
                          <ContractMoneyField
                            label="Salary"
                            amount={contractDraft.standardSalary}
                            currency={contractDraft.standardSalaryCurrency}
                            onAmountChange={(value) => updateContractDraft("standardSalary", value)}
                            onCurrencyChange={(value) => updateContractDraft("standardSalaryCurrency", value)}
                          />
                          <ContractSelectField
                            label="Salary accrual"
                            value={contractDraft.standardSalaryAccrual}
                            onChange={(value) => updateContractDraft("standardSalaryAccrual", value)}
                            options={contractSalaryAccrualOptions}
                          />
                          <ContractField
                            label="Notice period"
                            value={contractDraft.standardNoticePeriod}
                            onChange={(value) => updateContractDraft("standardNoticePeriod", value)}
                            placeholder=""
                          />
                          <ContractField
                            label="Annual leave"
                            value={contractDraft.standardAnnualLeave}
                            onChange={(value) => updateContractDraft("standardAnnualLeave", value)}
                            placeholder=""
                          />
                          <ContractField
                            label="Place of repatriation"
                            value={contractDraft.standardPlaceOfRepatriation}
                            onChange={(value) => updateContractDraft("standardPlaceOfRepatriation", value)}
                            placeholder=""
                          />
                          <ContractField
                            label="Travel allowance"
                            value={contractDraft.standardTravelAllowance}
                            onChange={(value) => updateContractDraft("standardTravelAllowance", value)}
                            placeholder=""
                          />
                        </div>
                        <div className="mt-4 flex justify-end border-t border-[#d9e8f3] pt-4">
                          <ContractSectionSaveButton
                            saved={contractSectionSaved.annexBStandard}
                            saving={Boolean(savingContractSections.annexBStandard)}
                            onSave={() => saveContractSection("annexBStandard", contractAnnexBStandardFields)}
                          />
                        </div>
                      </ContractTermsBlock>
                    </div>

                    <ContractTermsBlock
                      title="Governing law & jurisdiction"
                      note="Auto-applied from yacht flag"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <ContractReadOnlyField
                          label="Governing Law"
                          value={getContractGoverningLaw(contractDraft)}
                        />
                        <ContractReadOnlyField
                          label="Jurisdiction / Dispute Forum"
                          value={contractJurisdictionForum}
                        />
                      </div>
                    </ContractTermsBlock>

                    <ContractTermsBlock
                      title="Special conditions"
                      note="Additional agreed terms"
                    >
                      <ContractArea
                        label="Special conditions"
                        value={contractDraft.specialConditions}
                        onChange={(value) => updateContractDraft("specialConditions", value)}
                        rows={4}
                        placeholder="Any additional agreed terms may be written here and shall take priority over Annex B."
                      />
                      <div className="mt-4 flex justify-end border-t border-[#d9e8f3] pt-4">
                        <ContractSectionSaveButton
                          saved={contractSectionSaved.annexBSpecial}
                          saving={Boolean(savingContractSections.annexBSpecial)}
                          onSave={() => saveContractSection("annexBSpecial", contractAnnexBSpecialFields)}
                        />
                      </div>
                    </ContractTermsBlock>
                </div>
              )}

              {contractStep === "clauses" && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <ContractPanelTitle
                    eyebrow="Annex C"
                    title="General terms and conditions"
                    text="Fixed agreement clauses are grouped below. Open a clause to review the complete legal text."
                  />
                  <div className="mt-5 space-y-3">
                    {contractAnnexCClauses.map((clause) => {
                      const isOpen = openAnnexCClause === clause.number;

                      return (
                        <div
                          key={clause.number}
                          className={`overflow-hidden rounded-[24px] border shadow-sm transition ${
                            isOpen
                              ? "border-[#6ed7e8] bg-[#f6fcff]"
                              : "border-[#d9e8f3] bg-white hover:border-[#9bdce9]"
                          }`}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center gap-4 px-4 py-4 text-left"
                            onClick={() => setOpenAnnexCClause(isOpen ? null : clause.number)}
                            aria-expanded={isOpen}
                          >
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#cfe2f4] bg-white text-lg font-black text-[#071631]">
                              {clause.number}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[0.7rem] font-black uppercase tracking-[0.24em] text-[#1f8397]">
                                General term
                              </span>
                              <span className="mt-1 block text-base font-black uppercase tracking-[0.04em] text-[#071631]">
                                {clause.title}
                              </span>
                            </span>
                            <ChevronDown
                              className={`h-5 w-5 shrink-0 text-[#1f8397] transition ${isOpen ? "rotate-180" : ""}`}
                            />
                          </button>

                          {isOpen && (
                            <div className="border-t border-[#d9e8f3] bg-white px-4 py-4">
                              <div className="rounded-[20px] border border-[#d9e8f3] bg-[#f8fbff] p-4 text-sm leading-7 text-[#314357]">
                                {clause.body.map((paragraph, paragraphIndex) => (
                                  <p key={`${clause.number}-${paragraphIndex}`} className={paragraphIndex ? "mt-3" : ""}>
                                    {paragraph}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {contractStep === "signature" && (
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <ContractPanelTitle
                    eyebrow="Annex D"
                    title="Declaration and signatures"
                    text="The crew member signs from their BlueDeck portal after the contract is sent."
                  />
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <ContractField
                      label="Prepared by"
                      value={contractDraft.signerName}
                      onChange={(value) => updateContractDraft("signerName", value)}
                      placeholder="Captain / representative name"
                    />
                    <ContractField
                      label="Title"
                      value={contractDraft.signerTitle}
                      onChange={(value) => updateContractDraft("signerTitle", value)}
                      placeholder="Captain / Yacht Representative"
                    />
                    <ContractDateField
                      label="Signature date"
                      value={contractDraft.signatureDate}
                      onChange={(value) => updateContractDraft("signatureDate", value)}
                    />
                    <ContractField
                      label="Signature location"
                      value={contractDraft.signatureLocation}
                      onChange={(value) => updateContractDraft("signatureLocation", value)}
                      placeholder="Port / city"
                    />
                  </div>
                </div>
              )}

              {contractStep === "preview" && (
                <div className="bd-contract-preview-grid grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="bd-contract-preview-card min-w-0 overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <ContractPanelTitle
                      eyebrow="Preview contract"
                      title="Final contract draft"
                      text="Review the generated text before sending it for mobile signature."
                    />
                    <ContractGeneratedPreview
                      draft={contractPreviewDraft}
                      member={selectedContractMember}
                      createPdfBlob={() => downloadContractDraftPdf("preview")}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-[#2fb6c7]/20 bg-[linear-gradient(135deg,#effbfc_0%,#ffffff_100%)] p-5">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-800">
                        Send to crew
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        This will create a BlueDeck contract record and place it in the crew signature workflow.
                      </p>
                      <button
                        type="button"
                        onClick={assignContract}
                        disabled={loading || !selectedCrew}
                        className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#08313b] py-4 text-base font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-[#0e4f5d] disabled:opacity-50"
                      >
                        <Send className="h-5 w-5" />
                        Send for Signature
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => void downloadContractDraftPdf()}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#5fd3e5] py-4 text-base font-black text-[#031923] shadow-lg shadow-cyan-700/20 transition hover:bg-[#84e6f3]"
                    >
                      <Download className="h-5 w-5" />
                      Download Draft PDF
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setContractStep(previousContractStep)}
                  disabled={contractStepIndex === 0}
                  className="bd-focus rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition hover:border-cyan-300 hover:text-cyan-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <div className="text-center text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Step {contractStepIndex + 1} of {contractStepCards.length}
                </div>
                <button
                  type="button"
                  onClick={() => setContractStep(nextContractStep)}
                  disabled={contractStepIndex === contractStepCards.length - 1}
                  className="bd-focus rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/12 transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        )}

        {isChecklistSystem && (
          <section className="mb-6 grid min-w-0 gap-3 rounded-[30px] border border-white/70 bg-white/86 p-3 shadow-xl shadow-cyan-950/6 backdrop-blur sm:grid-cols-2 sm:rounded-[36px] sm:p-4 xl:grid-cols-3">
            <ChecklistSectionButton
              active={checklistSection === "builder"}
              icon={<Send className="h-5 w-5" />}
              title="Checklist Builder"
              text="Select crew, category, recurrence and unlimited tasks."
              meta={`${selectedTemplates.length} selected`}
              onClick={() => setChecklistSection("builder")}
            />
            <ChecklistSectionButton
              active={checklistSection === "monitor"}
              icon={<ActivityIcon />}
              title="Sent Status"
              text="Track what crew completed, missed or attached proof to."
              meta={`${checklistInsights.openChecklists} open`}
              onClick={() => setChecklistSection("monitor")}
            />
            <ChecklistSectionButton
              active={checklistSection === "archive"}
              icon={<Archive className="h-5 w-5" />}
              title="Archive"
              text="Keep recent records and export a clean PDF archive."
              meta={`${archiveStats.records} records`}
              onClick={() => setChecklistSection("archive")}
            />
          </section>
        )}

        {(!isChecklistSystem || checklistSection === "builder") && (
        <div className={isChecklistSystem ? "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,390px)_minmax(0,1fr)] xl:gap-8" : "space-y-6 xl:space-y-8"}>
          <div className={isChecklistSystem ? "min-w-0 space-y-6 xl:space-y-8" : "hidden"}>
            {isChecklistSystem && (
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 shadow-xl shadow-cyan-950/5 sm:rounded-[36px]">
              <div className="bg-[linear-gradient(135deg,#071827_0%,#0d3143_100%)] p-5 text-white sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                  Assignment Console
                </p>
                <h2 className="mt-2 text-3xl font-black sm:text-4xl">Create Checklist</h2>
                <p className="mt-3 text-sm leading-6 text-cyan-50/78">
                  Select crew, schedule the routine, then assign one or more verified BlueDeck templates.
                </p>
              </div>

              <div className="p-5 sm:p-7">
                <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Crew member
                </label>
                <select
                  value={selectedCrew}
                  onChange={(e) => setSelectedCrew(e.target.value)}
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg font-bold text-slate-950 outline-none focus:border-cyan-300"
                >
                  <option value="">Select crew</option>
                  {assignableCrew.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.crew_profiles?.full_name || member.invited_email} — {member.position}
                    </option>
                  ))}
                </select>
                {assignableCrew.length === 0 && (
                  <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-slate-600">
                    No crew below your current hierarchy is available for assignment yet.
                  </p>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Frequency
                    </span>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none focus:border-cyan-300"
                    >
                      {checklistFrequencies.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Due date
                    </span>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none focus:border-cyan-300"
                    />
                  </label>
                </div>

                <label className="mt-5 block">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Captain note
                  </span>
                  <textarea
                    placeholder="Optional note for the assigned crew"
                    value={captainNote}
                    onChange={(e) => setCaptainNote(e.target.value)}
                    className="mt-2 h-24 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                  />
                </label>

                <div className="mt-6 rounded-3xl border border-cyan-100 bg-[#f5fcfd] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                        Selected templates
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedTemplateObjects.length
                          ? `${selectedTemplateObjects.length} routine${selectedTemplateObjects.length === 1 ? "" : "s"} ready`
                          : "Choose templates from the library"}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-black text-white">
                      {selectedTemplates.length}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {selectedTemplateObjects.slice(0, 4).map((template) => (
                      <div key={template.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">{template.title}</p>
                          <p className="text-xs font-semibold text-cyan-700">
                            {template.department} · {frequency === "Template default" ? template.frequency : frequency}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleTemplate(template.id)}
                          className="bd-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-[#b9423b]"
                          title="Remove selected checklist"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    {selectedTemplateObjects.length > 4 && (
                      <p className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-500">
                        +{selectedTemplateObjects.length - 4} more selected
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={assignSelectedChecklists}
                  disabled={loading}
                  className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 py-4 text-lg font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-cyan-800 disabled:opacity-60"
                >
                  {loading ? "Assigning..." : "Assign Selected Checklists"}
                </button>
              </div>
            </div>
            )}

            {isChecklistSystem && (
            <div className="overflow-hidden rounded-[28px] border border-cyan-100 bg-white/90 shadow-xl shadow-cyan-950/5 sm:rounded-[36px]">
              <div className="border-b border-cyan-100 bg-[linear-gradient(135deg,#f8fdff_0%,#e9f8fb_100%)] p-5 sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-800">
                  Quick Checklist Builder
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">
                  Build From Tasks
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Type a duty, choose from professional yacht task suggestions, or add your own wording.
                </p>
              </div>

              <div className="space-y-4 p-5 sm:p-7">
                <input
                  value={manualTitle}
                  onChange={(event) => setManualTitle(event.target.value)}
                  placeholder={`${activeManualCategory?.label || "Custom"} checklist title (optional)`}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-lg font-black text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={manualCategoryId}
                    onChange={(event) => {
                      const nextCategory = checklistTaskCategories.find((category) => category.id === event.target.value);
                      setManualCategoryId(event.target.value);
                      if (nextCategory) {
                        setManualDepartment(nextCategory.department);
                        setManualType(nextCategory.type);
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none focus:border-cyan-300"
                  >
                    {manualCategoryOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={frequency === "Template default" ? "One-time" : frequency}
                    onChange={(event) => setFrequency(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                  >
                    {["One-time", "Daily", "Weekly", "Monthly", "Before Departure", "After Arrival", "Before Guest Arrival", "After Guest Departure", "Season Start", "Season End"].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>

                {activeManualCategory?.hint && (
                  <p className="rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
                    {activeManualCategory.hint}
                  </p>
                )}

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        value={manualTaskDraft}
                        onChange={(event) => setManualTaskDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addManualTask();
                          }
                        }}
                        placeholder="Start typing a yacht task"
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                      />
                      <button
                        type="button"
                        onClick={() => addManualTask()}
                        className="bd-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/12 transition hover:bg-cyan-800"
                        title="Add manual checklist item"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>

                    {(manualTaskDraft.trim() || manualTaskSuggestions.length > 0) && (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-lg shadow-cyan-950/8">
                        {manualTaskSuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.categoryId}-${suggestion.task}`}
                            type="button"
                            onClick={() => addManualTask(suggestion.task)}
                            className="bd-focus flex w-full items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition last:border-b-0 hover:bg-cyan-50"
                          >
                            <span>{suggestion.task}</span>
                            <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-800">
                              {activeManualCategory?.label}
                            </span>
                          </button>
                        ))}
                        {manualTaskDraft.trim() && !manualTaskSuggestions.some((suggestion) => suggestion.task.toLowerCase() === manualTaskDraft.trim().toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => addManualTask()}
                            className="bd-focus flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-black text-slate-950 transition hover:bg-cyan-50"
                          >
                            <span>Add custom task</span>
                            <span className="truncate text-xs font-semibold text-cyan-800">{manualTaskDraft.trim()}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {manualTasks.map((task, index) => (
                      <div key={`${task}-${index}`} className="flex items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-900 text-xs font-black text-white">
                          {index + 1}
                        </span>
                        <input
                          value={task}
                          onChange={(event) => updateManualTask(index, event.target.value)}
                          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-300"
                        />
                        <button
                          type="button"
                          onClick={() => removeManualTask(index)}
                          className="bd-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-white text-[#b9423b] transition hover:border-rose-200 hover:bg-rose-50"
                          title="Remove manual item"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    {manualTasks.length === 0 && (
                      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                        Add manual checklist items here.
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={createManualChecklist}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-700 py-4 text-lg font-black text-white shadow-lg shadow-cyan-700/20 transition hover:bg-slate-950 disabled:opacity-60"
                >
                  <ListChecks className="h-5 w-5" />
                  {loading ? "Creating..." : "Create Manual Checklist"}
                </button>
              </div>
            </div>
            )}

          </div>

          <div className="min-w-0 space-y-6 xl:space-y-8">
            {!isChecklistSystem && (
              <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-xl shadow-cyan-950/5 sm:rounded-[36px] sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.18em] text-cyan-700">
                      Crew Directory
                    </p>
                    <h2 className="mt-2 text-3xl font-black sm:text-5xl">Onboard Team</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                      Crew profiles, yacht roles, invitations and contract readiness in one
                      clean captain command view.
                    </p>
                  </div>
                  <UserRound className="h-10 w-10 text-cyan-700" />
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {crew.map((member) => (
                    <article
                      key={member.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <p className="truncate text-lg font-black text-slate-950">
                        {member.crew_profiles?.full_name || member.invited_email || "Crew member"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-cyan-700">
                        {member.position || member.crew_profiles?.current_position || "Crew"} · {member.department || "Yacht"}
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        {member.status || "active"}
                      </p>
                    </article>
                  ))}

                  {crew.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                      No crew has been added yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {isChecklistSystem && (
            <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-xl shadow-cyan-950/5 sm:rounded-[36px] sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex min-w-0 items-start gap-4">
                  <DepartmentIcon department="Command" />
                  <div className="min-w-0">
                    <p className="font-semibold uppercase tracking-[0.18em] text-cyan-700">
                      Professional Yacht Library
                    </p>
                    <h2 className="text-3xl font-black sm:text-5xl">
                      {activeChecklistPackData?.title || "Checklist System"}
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                      {activeChecklistPackData?.subtitle ||
                        "Command, deck, engineering, interior, galley, safety, toys and guest operations are grouped for fast assignment without crowding the page."}
                    </p>
                  </div>
                </div>

                <div className="w-full rounded-3xl border border-cyan-100 bg-cyan-50 px-5 py-4 text-sm text-slate-600 sm:w-auto">
                  <p className="font-black text-slate-950">{operator.position}</p>
                  <p className="mt-1">
                    {availableTemplates.length === checklistTemplates.length
                      ? "Full captain access"
                      : `Allowed: ${assignableDepartments.join(", ") || operator.department}`}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid min-w-0 grid-cols-1 gap-2 rounded-[28px] border border-slate-200 bg-slate-50/80 p-2 min-[480px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
                {checklistLibraryPacks.map((pack) => (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => openChecklistPack(pack.id)}
                    className={`bd-focus flex min-w-0 items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                      activeChecklistPack === pack.id
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-950/12"
                        : "bg-white text-slate-600 hover:bg-cyan-50 hover:text-cyan-900"
                    }`}
                  >
                    <span className="shrink-0"><PackIcon packId={pack.id} /></span>
                    <span className="min-w-0 truncate">{pack.title}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-[28px] border border-cyan-100 bg-[linear-gradient(135deg,#f7fdff_0%,#ffffff_100%)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                      Active pack
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-950">
                      {activeChecklistPackData?.title}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.12em]">
                    <span className="rounded-full bg-cyan-100 px-3 py-1.5 text-cyan-900">
                      {activeChecklistPackData?.templateIds.length || 0} templates
                    </span>
                    <span className="rounded-full bg-slate-950 px-3 py-1.5 text-white">
                      {activeChecklistPackData?.cadence}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid min-w-0 gap-3 sm:mt-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] lg:gap-4">
                <label className="relative block min-w-0">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-700" />
                  <input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Search checklist, task or department"
                    className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-5 text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-300"
                  />
                </label>
                <select
                  value={templateDepartmentFilter}
                  onChange={(event) => setTemplateDepartmentFilter(event.target.value)}
                  className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none focus:border-cyan-300"
                >
                  <option value="All">All departments</option>
                  {yachtDepartments.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={templateFrequencyFilter}
                  onChange={(event) => setTemplateFrequencyFilter(event.target.value)}
                  className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-950 outline-none focus:border-cyan-300"
                >
                  <option value="All">All frequencies</option>
                  {checklistFrequencies
                    .filter((item) => item !== "Template default")
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <WorkflowCard
                  icon={<ShieldAlert />}
                  title="Critical checks"
                  text="Safety, machinery and departure routines stay visible before assignment."
                />
                <WorkflowCard
                  icon={<Camera />}
                  title="Proof ready"
                  text="Crew can attach before and after photos from the task portal."
                />
                <WorkflowCard
                  icon={<TimerReset />}
                  title="Recurring rhythm"
                  text="Daily, weekly, voyage and seasonal routines can be scheduled cleanly."
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.14em]">
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-500">
                  {visibleTemplates.length} visible
                </span>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-cyan-800">
                  {selectedTemplates.length} selected
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-500">
                  {availableTemplates.length} authorized
                </span>
              </div>

              <div className="mt-6 grid min-w-0 gap-4 sm:mt-8 md:grid-cols-2 2xl:grid-cols-3">
                {visibleTemplates.map((template) => {
                  const selected = selectedTemplates.includes(template.id);
                  const authorized = authorizedTemplateIds.has(template.id);
                  const taskPanelOpen = expandedTemplateTasks.includes(template.id);
                  const assignmentTasks = getTemplateAssignmentTasks(template);
                  const trimmedTasks = assignmentTasks.map((task) => task.trim()).filter(Boolean);

                  return (
                    <article
                      key={template.id}
                      className={`bd-checklist-template-card min-w-0 rounded-[24px] border p-4 text-left transition sm:rounded-[28px] sm:p-5 ${
                        selected
                          ? "border-cyan-400 bg-cyan-50 shadow-[0_18px_50px_rgba(8,145,178,0.12)]"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-950/10"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleTemplate(template.id)}
                            disabled={!authorized}
                            className={`bd-focus mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
                              selected
                                ? "border-cyan-600 bg-cyan-600 text-white shadow-lg shadow-cyan-700/20"
                                : authorized
                                  ? "border-slate-300 bg-white text-slate-300 hover:border-cyan-300 hover:text-cyan-700"
                                  : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
                            }`}
                            aria-pressed={selected}
                            title={selected ? "Remove from assignment" : "Select checklist"}
                          >
                            {selected ? <CheckCircle className="h-5 w-5" /> : <ClipboardList className="h-4 w-4" />}
                          </button>

                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                              {template.department} · {template.type}
                            </p>
                            <h3 className="mt-2 break-words text-xl font-black text-slate-950 sm:text-2xl">{template.title}</h3>
                          </div>
                        </div>

                        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                          {authorized ? template.frequency : "Locked"}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-500">{template.summary}</p>

                      {!authorized && (
                        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-slate-600">
                          Visible in the professional library, but outside your current assignment authority.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleTemplate(template.id)}
                        disabled={!authorized}
                        className={`bd-focus mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                          selected
                            ? "bg-cyan-700 text-white shadow-lg shadow-cyan-700/20 hover:bg-cyan-800"
                            : authorized
                              ? "border border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
                              : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                        }`}
                        aria-pressed={selected}
                      >
                        {selected ? <CheckCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {selected ? "Selected" : authorized ? "Add to assignment" : "Outside authority"}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleTemplateTaskPanel(template.id)}
                        className="bd-focus mt-4 inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-white px-3.5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 sm:w-auto sm:justify-start sm:rounded-full sm:py-2"
                        aria-expanded={taskPanelOpen}
                      >
                        <span>{trimmedTasks.length} tasks</span>
                        <span className="text-cyan-700">{taskPanelOpen ? "Close" : "Review"}</span>
                        <ChevronDown className={`h-4 w-4 transition ${taskPanelOpen ? "rotate-180" : ""}`} />
                      </button>

                      {taskPanelOpen && (
                        <div className="mt-5 rounded-3xl border border-cyan-100 bg-[#f8fcfd] p-3 shadow-inner shadow-cyan-950/5 sm:p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                              Assignment tasks
                            </p>
                            <button
                              type="button"
                              onClick={() => resetTemplateTasks(template.id)}
                              className="bd-focus rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-cyan-300 hover:text-cyan-800"
                            >
                              Reset
                            </button>
                          </div>

                          <div className="mt-4 space-y-2.5">
                            {assignmentTasks.map((task, index) => (
                              <div key={`${template.id}-${index}`} className="flex items-center gap-2">
                                <input
                                  value={task}
                                  onChange={(event) =>
                                    updateTemplateTask(template.id, template.tasks, index, event.target.value)
                                  }
                                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeTemplateTask(template.id, template.tasks, index)}
                                  className="bd-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-white text-[#b9423b] transition hover:border-rose-200 hover:bg-rose-50"
                                  title="Remove task"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}

                            {assignmentTasks.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                                Add at least one task before assigning this checklist.
                              </div>
                            )}
                          </div>

                          <div className="mt-4 flex gap-2">
                            <input
                              value={newTemplateTasks[template.id] || ""}
                              onChange={(event) =>
                                setNewTemplateTasks((current) => ({
                                  ...current,
                                  [template.id]: event.target.value,
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addTemplateTask(template.id, template.tasks);
                                }
                              }}
                              placeholder="New task"
                              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
                            />
                            <button
                              type="button"
                              onClick={() => addTemplateTask(template.id, template.tasks)}
                              className="bd-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/12 transition hover:bg-cyan-800"
                              title="Add task"
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}

                {visibleTemplates.length === 0 && (
                  <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-500">
                    No checklist matches this filter or your current hierarchy authority.
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
        )}

        {isChecklistSystem && checklistSection === "monitor" && (
          <section className="rounded-[34px] border border-slate-200 bg-white/90 p-5 shadow-2xl shadow-cyan-950/8 sm:rounded-[44px] sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-black uppercase tracking-[0.18em] text-cyan-700">
                  Sent Checklist Status
                </p>
                <h2 className="mt-2 text-4xl font-black text-slate-950 sm:text-5xl">
                  Crew completion board
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
                  Review every checklist sent to crew, completion percentage, due status, proof photos and captain notes.
                </p>
              </div>
              <button
                onClick={() => loadData()}
                className="bd-focus inline-flex items-center justify-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-3 font-black text-cyan-900 transition hover:border-cyan-300 hover:bg-cyan-100"
              >
                <RefreshCcw className="h-5 w-5" />
                Refresh
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MonitorMetric title="Open checklists" value={checklistInsights.openChecklists} icon={<ClipboardList />} tone="navy" />
              <MonitorMetric title="Completed" value={checklistInsights.completedChecklists} icon={<CheckCircle />} tone="green" />
              <MonitorMetric title="Due soon" value={checklistInsights.dueSoon} icon={<AlertTriangle />} tone="amber" />
              <MonitorMetric title="Proof records" value={checklistInsights.proofItems} icon={<Camera />} tone="blue" />
            </div>

            <div className="mt-8 grid gap-4">
              {monitorChecklists.map((item) => {
                const progress = getChecklistProgress(item);
                const tasks = item.yacht_checklist_items || [];
                const expanded = expandedProgress.includes(item.id);
                const crewName = getAssignedCrewLabel(item);
                const dueStatus = getChecklistDueStatus(item);
                const proofCount = tasks.filter((task: any) => getTaskPhoto(task, "before") || getTaskPhoto(task, "after")).length;

                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-950/8"
                  >
                    <button
                      type="button"
                      onClick={() => toggleProgressCard(item.id)}
                      className="bd-focus block w-full p-5 text-left sm:p-6"
                      aria-expanded={expanded}
                    >
                      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getStatusBadgeClass(item.status)}`}>
                              {item.status === "completed" ? "Completed" : "Open"}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${dueStatus.className}`}>
                              {dueStatus.label}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                              {proofCount} proof
                            </span>
                          </div>
                          <h3 className="mt-3 break-words text-2xl font-black text-slate-950">
                            {item.title || "Checklist"}
                          </h3>
                          <p className="mt-2 text-sm font-semibold text-cyan-800">
                            {item.department || "Yacht"} · {item.checklist_type || "Checklist"} · {getChecklistFrequency(item) || "One-time"}
                          </p>
                          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
                            <UserRound className="h-4 w-4 text-cyan-700" />
                            {crewName}
                            <span className="text-slate-300">/</span>
                            Sent {item.created_at ? formatDateTime(item.created_at) : "-"}
                          </p>
                        </div>

                        <div className="rounded-3xl border border-cyan-100 bg-[#f4fbfd] p-4">
                          <div className="flex items-center justify-between text-sm font-black text-slate-950">
                            <span>{progress.done}/{progress.total}</span>
                            <span>{progress.percent}%</span>
                          </div>
                          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#0e7490,#22d3ee)] transition-all"
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                            {expanded ? "Hide task details" : "View task details"}
                          </p>
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-5 pb-5 sm:px-6 sm:pb-6">
                        {getChecklistNote(item) && (
                          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-slate-700">
                            Captain note: {getChecklistNote(item)}
                          </div>
                        )}

                        <div className="mt-5 grid gap-3">
                          {tasks.map((task: any) => {
                            const beforePhoto = getTaskPhoto(task, "before");
                            const afterPhoto = getTaskPhoto(task, "after");

                            return (
                              <div
                                key={task.id}
                                className={`rounded-2xl border p-4 ${
                                  task.completed
                                    ? "border-emerald-200 bg-emerald-50"
                                    : "border-slate-200 bg-white"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                                      task.completed
                                        ? "border-emerald-500 bg-emerald-500 text-white"
                                        : "border-slate-300 bg-white text-slate-300"
                                    }`}
                                  >
                                    {task.completed && <CheckCircle className="h-5 w-5" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-slate-700">{task.task_text}</p>
                                    {task.completed && (
                                      <p className="mt-1 text-xs font-semibold text-slate-500">
                                        Done by {task.completed_by || crewName}
                                        {task.completed_at ? ` · ${formatDateTime(task.completed_at)}` : ""}
                                      </p>
                                    )}
                                    {(beforePhoto || afterPhoto) && (
                                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <TaskPhotoPreview label="Before" url={beforePhoto} onOpen={setPhotoPreview} />
                                        <TaskPhotoPreview label="After" url={afterPhoto} onOpen={setPhotoPreview} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}

              {monitorChecklists.length === 0 && (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-xl font-black text-slate-950">No checklist has been sent yet.</p>
                  <p className="mt-2 text-slate-500">Create and send one from the first section.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {isChecklistSystem && checklistSection === "archive" && (
          <section className="min-w-0 overflow-hidden rounded-[34px] border border-slate-200 bg-white/90 shadow-2xl shadow-cyan-950/8 sm:rounded-[44px]">
            <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)]">
              <div className="bg-[linear-gradient(135deg,#071827_0%,#0c3040_70%,#135e68_100%)] p-6 text-white sm:p-8">
                <p className="font-black uppercase tracking-[0.2em] text-cyan-200">
                  6-Month Record Vault
                </p>
                <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
                  Checklist archive
                </h2>
                <p className="mt-4 text-sm leading-7 text-cyan-50/82 sm:text-base">
                  BlueDeck keeps checklist records for the last 6 months. Older records are cleaned automatically
                  when the yacht checklist data is loaded.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <LibraryMetric label="Records" value={archiveStats.records} />
                  <LibraryMetric label="Tasks" value={archiveStats.tasks} />
                  <LibraryMetric label="Completed" value={archiveStats.completed} />
                  <LibraryMetric label="Proof" value={archiveStats.proofItems} />
                </div>

                <div className="mt-6 rounded-3xl border border-white/12 bg-white/10 p-4 text-sm leading-6 text-cyan-50/82">
                  <p className="font-black text-white">Retention</p>
                  <p className="mt-1">
                    {archiveRetention?.cutoff
                      ? `Records older than ${formatDateTime(archiveRetention.cutoff)} are removed.`
                      : "Records older than 6 months are removed automatically."}
                  </p>
                  {archiveRetention?.purged ? (
                    <p className="mt-2 font-bold text-cyan-100">
                      {archiveRetention.purged} old checklist record{archiveRetention.purged === 1 ? "" : "s"} cleaned on this load.
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={downloadChecklistArchivePdf}
                  className="bd-focus mt-6 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-300 px-5 py-4 text-lg font-black text-slate-950 shadow-xl shadow-cyan-950/18 transition hover:bg-white"
                >
                  <Download className="h-5 w-5" />
                  Download PDF Archive
                </button>
              </div>

              <div className="p-5 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">
                      Recent records
                    </p>
                    <h3 className="mt-1 text-3xl font-black text-slate-950">
                      Last 6 months
                    </h3>
                  </div>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-900">
                    Auto-clean enabled
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  {checklistRecords.map((item) => {
                    const progress = getChecklistProgress(item);
                    const proofCount = (item.yacht_checklist_items || []).filter((task: any) => getTaskPhoto(task, "before") || getTaskPhoto(task, "after")).length;

                    return (
                      <article
                        key={item.id}
                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <h4 className="truncate text-xl font-black text-slate-950">
                              {item.title || "Checklist"}
                            </h4>
                            <p className="mt-1 text-sm font-semibold text-cyan-800">
                              {getAssignedCrewLabel(item)} · {item.department || "Yacht"} · {formatDateTime(item.created_at)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${getStatusBadgeClass(item.status)}`}>
                              {item.status === "completed" ? "Completed" : "Open"}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">
                              {progress.percent}% done
                            </span>
                            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-cyan-900">
                              {proofCount} proof
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {checklistRecords.length === 0 && (
                    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <FileText className="mx-auto h-10 w-10 text-cyan-700" />
                      <p className="mt-3 text-xl font-black text-slate-950">No archived checklist records yet.</p>
                      <p className="mt-2 text-slate-500">Sent checklists will appear here for 6 months.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {photoPreview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => setPhotoPreview(null)}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl shadow-slate-950/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                  Task Photo
                </p>
                <h3 className="text-2xl font-black text-slate-950">{photoPreview.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
                aria-label="Close photo preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950">
              <img
                src={photoPreview.url}
                alt={`${photoPreview.label} task photo`}
                className="max-h-[78vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function LibraryMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/10 px-3 py-4 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/80">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function PackIcon({ packId }: { packId: string }) {
  if (packId.includes("departure")) return <ShipWheel className="h-5 w-5" />;
  if (packId.includes("charter")) return <RefreshCcw className="h-5 w-5" />;
  if (packId.includes("daily")) return <CheckSquare className="h-5 w-5" />;
  if (packId.includes("guest")) return <Anchor className="h-5 w-5" />;
  if (packId.includes("safety")) return <ShieldAlert className="h-5 w-5" />;
  if (packId.includes("engineering")) return <Wrench className="h-5 w-5" />;
  if (packId.includes("toys")) return <Waves className="h-5 w-5" />;
  if (packId.includes("season")) return <CalendarClock className="h-5 w-5" />;
  return <ClipboardList className="h-5 w-5" />;
}

function ActivityIcon() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute h-5 w-5 rounded-full border-2 border-current opacity-30" />
      <span className="h-2.5 w-2.5 rounded-full bg-current" />
    </span>
  );
}

function ChecklistSectionButton({
  active,
  icon,
  title,
  text,
  meta,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  text: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bd-focus rounded-[26px] border p-4 text-left transition ${
        active
          ? "border-cyan-400 bg-[linear-gradient(135deg,#071827_0%,#0d3143_100%)] text-white shadow-xl shadow-cyan-950/14"
          : "border-slate-200 bg-white text-slate-800 hover:border-cyan-300 hover:bg-cyan-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
          active ? "bg-cyan-300 text-slate-950" : "bg-cyan-50 text-cyan-800"
        }`}>
          {icon}
        </span>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
          active ? "bg-white/12 text-cyan-100" : "bg-slate-100 text-slate-500"
        }`}>
          {meta}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className={`mt-2 text-sm leading-6 ${active ? "text-cyan-50/78" : "text-slate-500"}`}>
        {text}
      </p>
    </button>
  );
}

function MonitorMetric({
  title,
  value,
  icon,
  tone,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  tone: "navy" | "green" | "amber" | "blue";
}) {
  const toneClass =
    tone === "navy"
      ? "border-slate-900 bg-slate-950 text-white"
      : tone === "green"
        ? "border-emerald-200 bg-emerald-50 text-slate-950"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-slate-950"
          : "border-cyan-200 bg-cyan-50 text-slate-950";

  return (
    <div className={`rounded-3xl border p-5 ${toneClass}`}>
      <div className="flex items-center justify-between gap-4">
        <span className={tone === "navy" ? "text-cyan-200" : "text-cyan-800"}>{icon}</span>
        <span className="text-3xl font-black">{value}</span>
      </div>
      <p className={`mt-3 text-xs font-black uppercase tracking-[0.16em] ${tone === "navy" ? "text-cyan-100/80" : "text-slate-500"}`}>
        {title}
      </p>
    </div>
  );
}

type ContractPreviewBlockData = {
  title: string;
  lines: string[];
};

type ContractPreviewLineData = {
  kind: "heading" | "body" | "space";
  text: string;
};

function getContractPreviewLineUnits(line: string) {
  return line ? Math.max(1, Math.ceil(line.length / 82)) : 1;
}

function getContractPreviewLines(lines: string[]) {
  return contractDisplayLines(lines).flatMap((line) => {
    if (!line) return [""];
    const chunks = line.match(/.{1,82}(?:\s|$)/g);
    return chunks?.map((chunk) => chunk.trim()).filter(Boolean) || [line];
  });
}

function getContractAnnexCPreviewLines(text: string, maxCharacters = 106) {
  return text.split("\n").flatMap((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];

    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (currentLine && nextLine.length > maxCharacters) {
        lines.push(currentLine);
        currentLine = word;
        return;
      }
      currentLine = nextLine;
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  });
}

function getContractAnnexCPreviewPages(maxUnits = 42) {
  const pages: ContractPreviewLineData[][] = [];
  let currentPage: ContractPreviewLineData[] = [];
  let currentUnits = 0;

  function pushPage() {
    if (!currentPage.length) return;
    pages.push(currentPage);
    currentPage = [];
    currentUnits = 0;
  }

  function addLine(line: ContractPreviewLineData, units: number) {
    if (currentPage.length && currentUnits + units > maxUnits) pushPage();
    currentPage.push(line);
    currentUnits += units;
  }

  contractAnnexCClauses.forEach((clause, clauseIndex) => {
    const heading = `${clause.number}. ${clause.title}`;
    getContractAnnexCPreviewLines(heading, 78).forEach((line, index) => {
      addLine({ kind: "heading", text: line }, index === 0 ? 1.45 : 1.18);
    });

    clause.body.forEach((paragraph) => {
      getContractAnnexCPreviewLines(paragraph).forEach((line) => {
        addLine({ kind: "body", text: line }, 1);
      });
    });

    if (clauseIndex < contractAnnexCClauses.length - 1) {
      addLine({ kind: "space", text: "" }, 0.7);
    }
  });

  pushPage();
  return pages.length ? pages : [[]];
}

function getContractSpecialConditionPreviewPages(value: string) {
  const lines = getContractPreviewLines([contractSheetValue(value)]);
  const pages: string[][] = [];
  let currentPage: string[] = [];
  let currentUnits = 0;

  function pushPage() {
    if (!currentPage.length) return;
    pages.push(currentPage);
    currentPage = [];
    currentUnits = 0;
  }

  lines.forEach((line) => {
    const limit = pages.length === 0 ? 12 : 38;
    const units = getContractPreviewLineUnits(line);
    if (currentPage.length && currentUnits + units > limit) pushPage();
    currentPage.push(line);
    currentUnits += units;
  });

  pushPage();
  return pages.length ? pages : [["-"]];
}

function ContractGeneratedPreview({
  draft,
  member,
  createPdfBlob,
}: {
  draft: ContractDraft;
  member?: ContractCrewMember;
  createPdfBlob: () => Promise<Blob>;
}) {
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const [pageScale, setPageScale] = useState(0.32);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewError, setPdfPreviewError] = useState("");
  const [isPdfPreviewLoading, setIsPdfPreviewLoading] = useState(true);
  const pdfGeneratorRef = useRef(createPdfBlob);
  const activePdfPreviewUrlRef = useRef<string | null>(null);
  const previewSourceKey = useMemo(() => JSON.stringify({ draft, member: member || null }), [draft, member]);
  const sections = getContractCoverSections(draft, member);
  const termsSections = getContractTermsSections(draft, member);
  const [annexB, annexC, annexD] = getContractDocumentSections(draft, member);
  const specialConditionPages = annexB ? getContractSpecialConditionPreviewPages(draft.specialConditions) : [];
  const annexBPageCount = annexB ? specialConditionPages.length : 0;
  const annexCPages = annexC ? getContractAnnexCPreviewPages() : [];
  const previewPages: Array<{
    blocks?: ContractPreviewBlockData[];
    annexCLines?: ContractPreviewLineData[];
    subtitle?: string;
  }> = [
    ...annexCPages.map((lines) => ({
      annexCLines: lines,
      subtitle: "ANNEX C - GENERAL TERMS & CONDITIONS",
    })),
    ...(annexD
      ? [
          {
            blocks: [{ title: annexD.title, lines: getContractPreviewLines(annexD.lines) }],
            subtitle: "ANNEX D - DECLARATION AND SIGNATURES",
          },
        ]
      : []),
  ];
  const totalPages = 2 + annexBPageCount + previewPages.length;

  useEffect(() => {
    pdfGeneratorRef.current = createPdfBlob;
  }, [createPdfBlob]);

  useEffect(() => {
    let disposed = false;
    let generatedUrl = "";

    setPdfPreviewError("");
    setIsPdfPreviewLoading(true);

    void (async () => {
      try {
        const pdfBlob = await pdfGeneratorRef.current();
        generatedUrl = URL.createObjectURL(pdfBlob);
        if (disposed) {
          URL.revokeObjectURL(generatedUrl);
          return;
        }

        const previousUrl = activePdfPreviewUrlRef.current;
        activePdfPreviewUrlRef.current = generatedUrl;
        setPdfPreviewUrl(generatedUrl);
        generatedUrl = "";
        if (previousUrl) URL.revokeObjectURL(previousUrl);
      } catch (error) {
        if (!disposed) {
          setPdfPreviewError(error instanceof Error ? error.message : "PDF preview could not be prepared.");
        }
      } finally {
        if (!disposed) setIsPdfPreviewLoading(false);
      }
    })();

    return () => {
      disposed = true;
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    };
  }, [previewSourceKey]);

  useEffect(() => {
    return () => {
      if (activePdfPreviewUrlRef.current) {
        URL.revokeObjectURL(activePdfPreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = previewFrameRef.current;
    if (!node) return;

    let animationFrame = 0;
    const updateScale = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const measuredWidth = node.getBoundingClientRect().width || node.clientWidth;
        const parentWidth = node.parentElement?.clientWidth || measuredWidth;
        const viewportWidth = Math.min(
          window.visualViewport?.width || Number.POSITIVE_INFINITY,
          window.innerWidth || Number.POSITIVE_INFINITY,
          document.documentElement.clientWidth || Number.POSITIVE_INFINITY,
        );
        const safeViewportWidth = Number.isFinite(viewportWidth)
          ? viewportWidth
          : measuredWidth;
        const availableWidth =
          safeViewportWidth < 768
            ? Math.max(220, safeViewportWidth - 32)
            : Math.max(220, Math.min(measuredWidth, parentWidth) - 2);
        const nextScale = Math.min(
          1,
          Math.max(0.2, availableWidth / CONTRACT_PREVIEW_PAGE_WIDTH)
        );
        setPageScale((current) => (Math.abs(current - nextScale) < 0.005 ? current : nextScale));
      });
    };

    updateScale();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScale);
    observer?.observe(node);
    window.addEventListener("resize", updateScale);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  const htmlPreviewFallback = (
    <>
      <ContractPreviewPage pageNo={1} totalPages={totalPages} subtitle="INTRODUCTORY NOTE" scale={pageScale}>
        <ContractIntroNote />
      </ContractPreviewPage>

      <ContractPreviewPage pageNo={2} totalPages={totalPages} subtitle="ANNEX A - PARTIES" scale={pageScale}>
        <div className="space-y-3">
          {sections.map((section) => (
            <ContractCoverSection key={section.title} {...section} />
          ))}
        </div>
      </ContractPreviewPage>

      {annexB
        ? specialConditionPages.map((specialLines, index) => (
            <ContractPreviewPage
              key={`annex-b-preview-page-${index}`}
              pageNo={3 + index}
              totalPages={totalPages}
              subtitle="ANNEX B - EMPLOYMENT TERMS"
              scale={pageScale}
            >
              <div className="space-y-3">
                {index === 0 ? (
                  <>
                    {termsSections.map((section) => (
                      <ContractCoverSection key={section.title} {...section} compact />
                    ))}
                    <ContractSpecialConditionsPreview lines={specialLines} showTitle />
                  </>
                ) : (
                  <ContractSpecialConditionsPreview lines={specialLines} />
                )}
              </div>
            </ContractPreviewPage>
          ))
        : null}

      {previewPages.map((page, index) => (
        <ContractPreviewPage
          key={`contract-body-page-${index}`}
          pageNo={index + 3 + annexBPageCount}
          totalPages={totalPages}
          subtitle={page.subtitle}
          scale={pageScale}
        >
          {page.annexCLines ? (
            <ContractAnnexCPreviewText lines={page.annexCLines} />
          ) : (
            <div className="space-y-6">
              {(page.blocks || []).map((block) => (
                <ContractPreviewBlockCard key={`${block.title}-${block.lines.join("|")}`} block={block} />
              ))}
            </div>
          )}
        </ContractPreviewPage>
      ))}
    </>
  );

  return (
    <div ref={previewFrameRef} className="bd-contract-preview-frame mt-5 w-full max-w-full min-w-0 space-y-5 overflow-hidden">
      {pdfPreviewUrl && !pdfPreviewError ? (
        <div className="w-full overflow-hidden rounded-[20px] border border-[#c4d9ee] bg-[#f4f8fc] shadow-sm shadow-blue-950/10">
          <iframe
            title="Exact contract PDF preview"
            src={`${pdfPreviewUrl}#view=FitH&toolbar=0&navpanes=0`}
            className="block h-[min(82dvh,1080px)] min-h-[620px] w-full border-0 bg-white"
          />
        </div>
      ) : isPdfPreviewLoading ? (
        <div className="flex min-h-[620px] w-full items-center justify-center rounded-[20px] border border-[#c4d9ee] bg-[#f8fbfe] p-8 text-center">
          <div>
            <RefreshCcw className="mx-auto h-7 w-7 animate-spin text-cyan-700" />
            <p className="mt-3 text-sm font-black text-[#082759]">Preparing the exact PDF preview</p>
          </div>
        </div>
      ) : (
        <>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {pdfPreviewError || "The PDF preview could not be prepared."}
          </p>
          {htmlPreviewFallback}
        </>
      )}
    </div>
  );
}

function ContractPreviewPage({
  pageNo,
  totalPages,
  subtitle,
  scale,
  children,
}: {
  pageNo: number;
  totalPages: number;
  subtitle?: string;
  scale: number;
  children: ReactNode;
}) {
  const isAnnexCPage = subtitle === "ANNEX C - GENERAL TERMS & CONDITIONS";
  const contentTop = isAnnexCPage ? "11.4%" : subtitle ? "13.8%" : "10.2%";

  return (
    <div
      className="bd-contract-preview-page-shell mx-auto max-w-full"
      style={{
        width: CONTRACT_PREVIEW_PAGE_WIDTH * scale,
        height: CONTRACT_PREVIEW_PAGE_HEIGHT * scale,
      }}
    >
      <div
        className="bd-contract-preview-page relative overflow-hidden bg-white px-[5.2%] pb-[7.4%] shadow-sm shadow-blue-950/8"
        style={{
          width: CONTRACT_PREVIEW_PAGE_WIDTH,
          height: CONTRACT_PREVIEW_PAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div className="absolute left-[5.2%] right-[5.2%] top-[3.2%] z-20 text-center">
          <p className="font-serif text-[24px] font-black uppercase tracking-[0.12em] text-[#082759]">
            Seafarer Employment Agreement
          </p>
          {subtitle ? <ContractAnnexSubtitle text={subtitle} /> : null}
        </div>
        <div className="relative z-10 flex h-full flex-col" style={{ paddingTop: contentTop }}>
          <div className="flex-1">{children}</div>
        </div>
        <p className="absolute bottom-[4.2%] right-[6.2%] z-10 text-xs font-black text-[#082759]">
          Page {pageNo} of {totalPages}
        </p>
      </div>
    </div>
  );
}

function ContractSpecialConditionsPreview({
  lines,
  showTitle = false,
}: {
  lines: string[];
  showTitle?: boolean;
}) {
  return (
    <section className="pt-1">
      {showTitle ? (
        <div className="mb-2 border-b border-[#b8d2ee] pb-2">
          <h4 className="font-serif text-lg font-black uppercase tracking-[0.02em] text-[#082759]">
            Special Conditions
          </h4>
        </div>
      ) : null}
      <div className="space-y-1.5 px-1 text-[12px] font-semibold leading-5 text-[#17233a]">
        {lines.map((line, index) =>
          line ? (
            <p key={`special-condition-${index}`}>{line}</p>
          ) : (
            <div key={`special-condition-${index}`} className="h-2" />
          )
        )}
      </div>
    </section>
  );
}

function ContractAnnexSubtitle({ text }: { text: string }) {
  return (
    <div className="mx-auto mt-2 flex max-w-[78%] items-center justify-center gap-3">
      <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent_0%,#9ec4ed_52%,#1e67bc_100%)]" />
      <span className="shrink-0 whitespace-nowrap text-[12px] font-black uppercase tracking-[0.24em] text-[#0d58ae]">
        {text}
      </span>
      <span className="h-px flex-1 bg-[linear-gradient(90deg,#1e67bc_0%,#9ec4ed_48%,transparent_100%)]" />
    </div>
  );
}

function ContractIntroNote() {
  return (
    <section className="mx-auto flex h-full w-[84%] flex-col text-[#17233a]">
      <div className="mt-11 space-y-4 text-[13.2px] font-semibold leading-[1.62]">
        {contractIntroParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}

        <div className="space-y-3">
          {contractIntroAnnexes.map((annex, index) => (
            <div key={annex.title} className="grid grid-cols-[20px_1fr] gap-2">
              <span className="font-black text-[#0d58ae]">
                {index + 1}.
              </span>
              <span>
                <span className="block text-[13.2px] font-black uppercase tracking-[0.08em] text-[#082759]">
                  {annex.title}
                </span>
                <span className="mt-2 block text-[#4f6680]">{annex.text}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="h-px bg-[#d8e7f5]" />

        {contractIntroClosingParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <p className="mt-auto border-t border-[#d8e7f5] pt-3 text-[9px] font-semibold leading-snug text-[#4f6680]">
        {contractIntroFooterNotice}
      </p>
    </section>
  );
}

function ContractCoverSection({
  title,
  rows,
  footer,
  wideFirstRows = 0,
  compact = false,
}: {
  number: string;
  title: string;
  note: string;
  rows: Array<[string, string | undefined | null]>;
  footer?: string;
  wideFirstRows?: number;
  compact?: boolean;
}) {
  const isSpecialConditions = title.toLowerCase().includes("special conditions");

  return (
    <section className="overflow-hidden rounded-[18px] border border-[#bfd8ea] bg-white/96">
      <div className={`flex flex-row items-center justify-between gap-2 border-b border-[#d9e8f3] bg-[#fbfdff]/92 px-4 ${compact ? "py-2" : "py-2.5"}`}>
        <div className="flex items-center gap-3">
          <h4 className={`font-serif font-black uppercase tracking-[0.02em] text-[#082759] ${compact ? "text-lg" : "text-xl"}`}>
            {title}
          </h4>
        </div>
      </div>
      {isSpecialConditions ? (
        <div className={compact ? "px-4 py-3" : "px-4 py-3.5"}>
          <p className={`min-h-[28px] whitespace-pre-line font-semibold leading-5 text-[#17233a] ${compact ? "text-xs" : "text-[13px]"}`}>
            {contractSheetValue(rows[0]?.[1])}
          </p>
        </div>
      ) : (
        <div className={`grid grid-cols-2 ${compact ? "gap-2 p-3" : "gap-2.5 p-3.5"}`}>
          {rows.map(([label, value], index) => (
            <div
              key={label}
              className={`rounded-xl border border-[#b9d5f0] bg-white px-3 ${compact ? "py-1" : "py-1.5"} ${
                index < wideFirstRows ? "col-span-2" : ""
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#0b3c77]">
                {label}
              </p>
              <p className={`mt-0.5 min-h-[18px] whitespace-pre-line font-semibold text-[#17233a] ${compact ? "text-xs" : "text-[13px]"}`}>
                {contractSheetValue(value)}
              </p>
            </div>
          ))}
        </div>
      )}
      {footer && (
        <p className="border-t border-[#e1edf7] px-4 py-2.5 text-xs font-semibold leading-5 text-slate-500">
          {footer}
        </p>
      )}
    </section>
  );
}

function ContractPreviewBlockCard({ block }: { block: ContractPreviewBlockData }) {
  return (
    <section>
      <h4 className="font-serif text-lg font-black uppercase tracking-[0.02em] text-[#082759]">
        {block.title}
      </h4>
      <div className="mt-3 rounded-2xl border border-[#d8e7f5] bg-white/92 p-4">
        {block.lines.map((line, lineIndex) =>
          line ? (
            <p key={`${block.title}-${lineIndex}`} className="text-[13px] font-medium leading-6 text-[#17233a]">
              {line}
            </p>
          ) : (
            <div key={`${block.title}-${lineIndex}`} className="h-3" />
          )
        )}
      </div>
    </section>
  );
}

function ContractAnnexCPreviewText({ lines }: { lines: ContractPreviewLineData[] }) {
  return (
    <section className="px-0 text-[#17233a]">
      {lines.map((line, index) => {
        if (line.kind === "space") {
          return <div key={`annex-c-space-${index}`} className="h-2" />;
        }

        if (line.kind === "heading") {
          return (
            <p
              key={`annex-c-heading-${index}`}
              className={`font-serif text-[17px] font-black uppercase leading-[1.24] tracking-[0.025em] text-[#082759] ${
                index ? "mt-3.5" : ""
              }`}
            >
              {line.text}
            </p>
          );
        }

        const subclause = splitContractSubclausePrefix(line.text);

        return (
          <p
            key={`annex-c-body-${index}`}
            className="mt-[3px] text-[14.2px] font-medium leading-[1.47] text-[#17233a]"
          >
            {subclause ? (
              <>
                <span className="font-extrabold text-[#082759]">{subclause.prefix}</span>
                {subclause.remainder}
              </>
            ) : (
              line.text
            )}
          </p>
        );
      })}
    </section>
  );
}

function ContractStepIcon({ step }: { step: ContractStudioStep }) {
  if (step === "parties") return <UserRound className="h-5 w-5" />;
  if (step === "terms") return <CalendarClock className="h-5 w-5" />;
  if (step === "clauses") return <FileText className="h-5 w-5" />;
  if (step === "signature") return <FileCheck2 className="h-5 w-5" />;
  return <Download className="h-5 w-5" />;
}

function ContractPanelTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-800">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
        {title}
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function ContractTermsBlock({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#bfd8ea] bg-white/96 shadow-sm shadow-blue-950/5">
      <div className="flex flex-col gap-2 border-b border-[#d9e8f3] bg-[#f8fbff]/95 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="font-serif text-xl font-black uppercase tracking-[0.02em] text-[#082759]">
          {title}
        </h4>
        {note ? (
          <span className="text-[11px] font-bold text-[#0d58ae]">{note}</span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ContractSectionSaveButton({
  saved,
  saving,
  onSave,
}: {
  saved: boolean;
  saving: boolean;
  onSave: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={saved || saving}
      onClick={onSave}
      className={`bd-focus inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-[0.08em] shadow-sm transition disabled:cursor-default ${
        saved
          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
          : "bg-[#5fd3e5] text-[#031923] hover:bg-[#84e6f3] disabled:opacity-70"
      }`}
    >
      {saving ? <Plus className="h-4 w-4" /> : saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {saving ? "Saving..." : saved ? "Saved" : "Save"}
    </button>
  );
}

function ContractSelectField({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-950 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
      >
        <option value="">-</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ContractReadOnlyField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`block ${className}`}>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <div className="mt-2 min-h-[58px] rounded-2xl border border-slate-200 bg-[#f8fbff] px-5 py-4 text-base font-semibold leading-6 text-slate-700">
        {value}
      </div>
    </div>
  );
}

function ContractDateField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        inputMode="numeric"
        maxLength={10}
        onChange={(event) => onChange(formatContractDateInput(event.target.value))}
        placeholder="DD/MM/YYYY"
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
      />
    </label>
  );
}

function ContractMoneyField({
  label,
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
}: {
  label: string;
  amount: string;
  currency: string;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <div className="mt-2 grid grid-cols-[1fr_104px] overflow-hidden rounded-2xl border border-slate-200 bg-white transition focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-500/10">
        <input
          value={amount}
          inputMode="numeric"
          onChange={(event) => onAmountChange(formatContractMoneyInput(event.target.value))}
          placeholder="0"
          className="min-w-0 border-0 bg-transparent px-5 py-4 text-base font-semibold text-slate-950 outline-none placeholder:text-slate-400"
        />
        <select
          value={currency || "EUR"}
          onChange={(event) => onCurrencyChange(event.target.value)}
          className="border-l border-slate-200 bg-[#f8fbff] px-3 py-4 text-sm font-black text-[#082759] outline-none"
        >
          {contractCurrencyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function ContractField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(normalizeInitialContractInput(event.target.value, value))}
        placeholder={placeholder}
        autoCapitalize="sentences"
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
      />
    </label>
  );
}

function ContractArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(normalizeInitialContractInput(event.target.value, value))}
        placeholder={placeholder}
        autoCapitalize="sentences"
        className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/10"
      />
    </label>
  );
}

function DepartmentIcon({ department }: any) {
  if (department === "Command") return <ShipWheel className="h-12 w-12 text-cyan-700" />;
  if (department === "Deck") return <ShipWheel className="h-12 w-12 text-cyan-700" />;
  if (department === "Interior") return <Utensils className="h-12 w-12 text-[#b9427b]" />;
  if (department === "Galley") return <Utensils className="h-12 w-12 text-[#c46d24]" />;
  if (department === "Engineering") return <Wrench className="h-12 w-12 text-[#c46d24]" />;
  if (department === "Toys") return <Waves className="h-12 w-12 text-blue-700" />;
  if (department === "Guest") return <Anchor className="h-12 w-12 text-[#1f6f8b]" />;
  if (department === "Purser") return <ClipboardList className="h-12 w-12 text-[#1f6f8b]" />;
  if (department === "Security") return <CheckSquare className="h-12 w-12 text-[#1f6f8b]" />;
  if (department === "Medical") return <LifeBuoy className="h-12 w-12 text-emerald-700" />;
  return <LifeBuoy className="h-12 w-12 text-[#b9423b]" />;
}

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function normalizeAccountRole(value?: unknown) {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["crew", "captain", "owner", "management"].includes(role) ? role : "";
}

function omitKeys<T extends Record<string, any>>(value: T, keys: string[]) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key))
  );
}

function isSchemaCacheError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return message.toLowerCase().includes("schema cache");
}

function getChecklistProgress(checklist: any) {
  const tasks = checklist?.yacht_checklist_items || [];
  const total = tasks.length;
  const done = tasks.filter((task: any) => task.completed).length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

function getStatusBadgeClass(status?: string) {
  return status === "completed"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-cyan-100 text-cyan-900";
}

function getChecklistDueStatus(checklist: any) {
  if (checklist.status === "completed") {
    return {
      label: "Closed",
      className: "bg-emerald-100 text-emerald-800",
    };
  }

  if (!checklist.due_date) {
    return {
      label: "No due date",
      className: "bg-slate-100 text-slate-500",
    };
  }

  const dueTime = new Date(checklist.due_date).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  const twoDays = 1000 * 60 * 60 * 24 * 2;

  if (dueTime < todayTime) {
    return {
      label: "Overdue",
      className: "bg-rose-100 text-rose-800",
    };
  }

  if (dueTime <= todayTime + twoDays) {
    return {
      label: "Due soon",
      className: "bg-amber-100 text-amber-800",
    };
  }

  return {
    label: "On schedule",
    className: "bg-cyan-100 text-cyan-900",
  };
}

function getChecklistFrequency(checklist: any) {
  return checklist?.frequency || checklist?.items?.frequency || "";
}

function getChecklistNote(checklist: any) {
  return checklist?.captain_note || checklist?.items?.captain_note || "";
}

function parseTaskNote(task: any) {
  if (!task?.note) return {};
  if (typeof task.note === "object") return task.note;

  try {
    return JSON.parse(task.note);
  } catch {
    return {};
  }
}

function getTaskPhoto(task: any, type: "before" | "after") {
  const note = parseTaskNote(task);
  return (
    task?.[`${type}_photo_url`] ||
    note?.[`${type}_photo_url`] ||
    note?.photos?.[type] ||
    ""
  );
}

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TaskPhotoPreview({
  label,
  url,
  onOpen,
}: {
  label: string;
  url?: string;
  onOpen: (photo: { label: string; url: string }) => void;
}) {
  if (!url) return null;

  return (
    <button
      type="button"
      onClick={() => onOpen({ label, url })}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-950/10"
    >
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500">
        <Camera className="h-3.5 w-3.5 text-cyan-700" />
        {label}
      </div>
      <img
        src={url}
        alt={`${label} task photo`}
        className="h-28 w-full object-cover transition group-hover:scale-[1.02]"
      />
    </button>
  );
}

function InsightCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone: "dark" | "aqua" | "amber" | "white";
}) {
  const toneClass =
    tone === "dark"
      ? "border-white/10 bg-white/10 text-white"
      : tone === "aqua"
        ? "border-cyan-200 bg-cyan-50 text-slate-950"
        : tone === "amber"
          ? "border-amber-200 bg-amber-50 text-slate-950"
          : "border-slate-200 bg-white text-slate-950";

  return (
    <div className={`rounded-3xl border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className={tone === "dark" ? "text-cyan-200" : "text-cyan-800"}>{icon}</span>
        <span className="text-2xl font-black">{value}</span>
      </div>
      <p className={`mt-3 text-xs font-black uppercase tracking-[0.15em] ${tone === "dark" ? "text-cyan-50/75" : "text-slate-500"}`}>
        {label}
      </p>
    </div>
  );
}

function WorkflowCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f3fbfc_100%)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-900 text-cyan-100 shadow-lg shadow-cyan-950/10">
          {icon}
        </div>
        <div>
          <p className="font-black text-slate-950">{title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-500">{text}</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value, icon }: any) {
  return (
    <div className="rounded-[30px] border border-slate-200 bg-white/85 p-6 shadow-xl shadow-cyan-950/5">
      <div className="flex items-center justify-between">
        <div className="text-cyan-700">{icon}</div>
        <div className="text-right">
          <p className="text-slate-500">{title}</p>
          <h2 className="mt-2 text-3xl font-black">{value}</h2>
        </div>
      </div>
    </div>
  );
}
