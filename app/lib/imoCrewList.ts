export const IMO_CREW_LIST_MAX_ROWS = 200;
export const IMO_CREW_LIST_MAX_FIELD_LENGTH = 120;
export const IMO_CREW_LIST_MAX_FILE_BYTES = 1_048_576;

export type ImoCrewRow = {
  id: string;
  familyName: string;
  givenNames: string;
  rank: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  gender: string;
  documentType: string;
  documentNumber: string;
  issuingState: string;
  documentExpiry: string;
};

export type ImoCrewListDraft = {
  version: 1;
  yachtId: string;
  voyage: {
    shipName: string;
    imoNumber: string;
    callSign: string;
    voyageNumber: string;
    portOfArrivalDeparture: string;
    arrivalDepartureDate: string;
    flagState: string;
    lastPort: string;
    masterName: string;
    declarationDate: string;
    movement: "arrival" | "departure";
  };
  crew: ImoCrewRow[];
};

export type ImoCrewListIssue = {
  field: string;
  rowId?: string;
  kind: "missing" | "invalid" | "expired";
};

const rowFields = [
  "familyName",
  "givenNames",
  "rank",
  "nationality",
  "dateOfBirth",
  "placeOfBirth",
  "gender",
  "documentType",
  "documentNumber",
  "issuingState",
  "documentExpiry",
] as const;

const voyageFields = [
  "shipName",
  "imoNumber",
  "callSign",
  "voyageNumber",
  "portOfArrivalDeparture",
  "arrivalDepartureDate",
  "flagState",
  "lastPort",
  "masterName",
  "declarationDate",
] as const;

const dateFields = new Set<string>([
  "dateOfBirth",
  "documentExpiry",
  "arrivalDepartureDate",
  "declarationDate",
]);

// These fields are single-line form values. Control and direction-override
// characters must not be able to disguise a document number or date on export.
const unsafeCharacters = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/u;
const unsafeCharactersGlobal = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/gu;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sourceText(value: unknown): string {
  if (typeof value !== "string") return "";
  return Array.from(value.replace(unsafeCharactersGlobal, " ").trim())
    .slice(0, IMO_CREW_LIST_MAX_FIELD_LENGTH)
    .join("");
}

function sourceDate(value: unknown): string {
  const text = sourceText(value);
  return isDate(text) ? text : "";
}

function sourceName(value: unknown): string {
  const name = sourceText(value).replace(/\s+/gu, " ");
  return name.includes("@") ? "" : name;
}

function fieldText(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    Array.from(value).length > IMO_CREW_LIST_MAX_FIELD_LENGTH ||
    unsafeCharacters.test(value)
  ) {
    throw new Error(`Invalid crew list field: ${field}.`);
  }
  const text = value.trim();
  if (dateFields.has(field) && text !== "" && !isDate(text)) {
    throw new Error(`Invalid crew list date: ${field}. Use YYYY-MM-DD.`);
  }
  return text;
}

function newRowId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `crew-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createEmptyImoCrewRow(): ImoCrewRow {
  return {
    id: newRowId(),
    familyName: "",
    givenNames: "",
    rank: "",
    nationality: "",
    dateOfBirth: "",
    placeOfBirth: "",
    gender: "",
    documentType: "",
    documentNumber: "",
    issuingState: "",
    documentExpiry: "",
  };
}

export function createImoCrewListDraft(
  yachtId: string,
  yacht: unknown,
  crew: unknown[],
): ImoCrewListDraft {
  const yachtRecord = record(yacht) ?? {};
  const activeCrew = crew
    .map(record)
    .filter((member): member is Record<string, unknown> =>
      typeof member?.status === "string" && member.status.trim().toLowerCase() === "active",
    );

  if (activeCrew.length > IMO_CREW_LIST_MAX_ROWS) {
    throw new Error(`A crew list can contain at most ${IMO_CREW_LIST_MAX_ROWS} people.`);
  }

  const rows = activeCrew.map((member) => {
    const profile = record(member.crew_profiles) ?? {};
    const nameParts = sourceName(profile.full_name).split(" ").filter(Boolean);
    const documentNumber = sourceText(profile.passport_number);
    const documentExpiry = sourceDate(profile.passport_expiry);
    return {
      ...createEmptyImoCrewRow(),
      familyName: nameParts.pop() ?? "",
      givenNames: nameParts.join(" "),
      rank: sourceText(member.position) || sourceText(profile.current_position),
      nationality: sourceText(profile.nationality),
      dateOfBirth: sourceDate(profile.date_of_birth),
      gender: sourceText(profile.gender),
      documentType: documentNumber || documentExpiry ? "Passport" : "",
      documentNumber,
      documentExpiry,
    };
  });

  const master = activeCrew.find((member) => {
    const profile = record(member.crew_profiles) ?? {};
    const rank = sourceText(member.position) || sourceText(profile.current_position);
    return /^(captain|master)$/i.test(rank) && sourceName(profile.full_name) !== "";
  });

  return {
    version: 1,
    yachtId: fieldText(yachtId, "yachtId"),
    voyage: {
      shipName: sourceText(yachtRecord.name),
      imoNumber: sourceText(yachtRecord.imo_number),
      callSign: sourceText(yachtRecord.call_sign),
      voyageNumber: "",
      portOfArrivalDeparture: "",
      arrivalDepartureDate: "",
      flagState: sourceText(yachtRecord.flag),
      lastPort: "",
      masterName: sourceName(record(master?.crew_profiles)?.full_name),
      declarationDate: "",
      movement: "arrival",
    },
    crew: rows,
  };
}

export function parseImoCrewListDraft(text: string, yachtId: string): ImoCrewListDraft {
  if (
    typeof text !== "string" ||
    text.length > IMO_CREW_LIST_MAX_FILE_BYTES ||
    new TextEncoder().encode(text).byteLength > IMO_CREW_LIST_MAX_FILE_BYTES
  ) {
    throw new Error("The crew list file is too large.");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error("The crew list file must contain valid JSON.");
  }
  const input = record(decoded);
  if (!input || input.version !== 1) {
    throw new Error("This crew list file format is not supported.");
  }
  const importedYachtId = fieldText(input.yachtId, "yachtId");
  if (!importedYachtId || importedYachtId !== yachtId) {
    throw new Error("This crew list belongs to a different yacht.");
  }
  const voyageInput = record(input.voyage);
  if (
    !voyageInput ||
    (voyageInput.movement !== "arrival" && voyageInput.movement !== "departure") ||
    !Array.isArray(input.crew) ||
    input.crew.length > IMO_CREW_LIST_MAX_ROWS
  ) {
    throw new Error("The crew list has an invalid voyage or crew collection.");
  }

  const voyage = { movement: voyageInput.movement } as ImoCrewListDraft["voyage"];
  for (const field of voyageFields) {
    voyage[field] = fieldText(voyageInput[field], field);
  }

  const usedIds = new Set<string>();
  const crew = input.crew.map((value) => {
    const rowInput = record(value);
    if (!rowInput) throw new Error("The crew list contains an invalid crew member.");
    const row = createEmptyImoCrewRow();
    const inputId = rowInput.id;
    if (
      typeof inputId === "string" &&
      /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(inputId) &&
      !usedIds.has(inputId)
    ) {
      row.id = inputId;
    }
    while (usedIds.has(row.id)) row.id = newRowId();
    usedIds.add(row.id);
    for (const field of rowFields) {
      row[field] = fieldText(rowInput[field], field);
    }
    return row;
  });

  // Build a fresh, allowlisted object: extra properties from a local file must
  // never become application state, even when the declared version matches.
  return { version: 1, yachtId: importedYachtId, voyage, crew };
}

export function serializeImoCrewListDraft(draft: ImoCrewListDraft): string {
  return JSON.stringify(parseImoCrewListDraft(JSON.stringify(draft), draft.yachtId), null, 2);
}

export function getImoCrewListFilename(
  draft: ImoCrewListDraft,
  extension: "pdf" | "json",
): string {
  const shipSlug = draft.voyage.shipName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "") || "yacht";
  const date = isDate(draft.voyage.arrivalDepartureDate)
    ? draft.voyage.arrivalDepartureDate
    : "undated";
  return `imo-crew-list-${shipSlug}-${draft.voyage.movement}-${date}.${extension}`;
}

export function getImoCrewListIssues(draft: ImoCrewListDraft): ImoCrewListIssue[] {
  const issues: ImoCrewListIssue[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const voyageDate = isDate(draft.voyage.arrivalDepartureDate)
    ? draft.voyage.arrivalDepartureDate
    : today;

  // IMO number, call sign and voyage number are conditional identifiers: an
  // unassigned identifier should be left blank for the captain to review.
  const requiredVoyageFields = [
    "shipName", "portOfArrivalDeparture", "arrivalDepartureDate", "flagState",
    "lastPort", "masterName", "declarationDate",
  ] as const;
  for (const field of requiredVoyageFields) {
    if (!draft.voyage[field].trim()) issues.push({ field, kind: "missing" });
  }
  for (const field of ["arrivalDepartureDate", "declarationDate"] as const) {
    if (draft.voyage[field] && !isDate(draft.voyage[field])) {
      issues.push({ field, kind: "invalid" });
    }
  }
  const imoNumber = draft.voyage.imoNumber.trim().replace(/^IMO\s*/i, "");
  if (imoNumber) {
    const checksum = Array.from(imoNumber.slice(0, 6))
      .reduce((total, digit, index) => total + Number(digit) * (7 - index), 0) % 10;
    if (!/^\d{7}$/.test(imoNumber) || checksum !== Number(imoNumber[6])) {
      issues.push({ field: "imoNumber", kind: "invalid" });
    }
  }
  if (draft.crew.length === 0) issues.push({ field: "crew", kind: "missing" });
  for (const row of draft.crew) {
    for (const field of rowFields) {
      if (!row[field].trim()) {
        issues.push({ rowId: row.id, field, kind: "missing" });
      }
    }
    if (row.dateOfBirth && (!isDate(row.dateOfBirth) || row.dateOfBirth > voyageDate)) {
      issues.push({ rowId: row.id, field: "dateOfBirth", kind: "invalid" });
    }
    if (row.documentExpiry) {
      if (!isDate(row.documentExpiry)) {
        issues.push({ rowId: row.id, field: "documentExpiry", kind: "invalid" });
      } else if (row.documentExpiry < voyageDate) {
        issues.push({ rowId: row.id, field: "documentExpiry", kind: "expired" });
      }
    }
  }
  return issues;
}
