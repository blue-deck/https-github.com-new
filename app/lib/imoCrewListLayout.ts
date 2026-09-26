import type { ImoCrewRow } from "./imoCrewList";

export type ImoCrewListColumn = {
  key: Exclude<keyof ImoCrewRow, "id"> | "sequence";
  label: string;
  /** Printed width in millimetres, shared with the document editor. */
  width: number;
};

export const IMO_CREW_LIST_CONTENT_WIDTH = 277;
export const IMO_CREW_LIST_DOCUMENT_COLUMN_INDEX = 7;
export const IMO_CREW_LIST_DOCUMENT_GROUP_LABEL = "Identity document";
export const IMO_CREW_LIST_SIGNATURE_LABEL = "16. Date and signature by master, authorized agent or officer";

export const IMO_CREW_LIST_COLUMNS = [
  { key: "sequence", label: "6. No.", width: 9 },
  { key: "fullName", label: "7. Full name", width: 55 },
  { key: "rank", label: "8. Rank or rating", width: 27 },
  { key: "nationality", label: "9. Nationality", width: 26 },
  { key: "dateOfBirth", label: "10. Date of birth", width: 25 },
  { key: "placeOfBirth", label: "11. Place of birth", width: 32 },
  { key: "gender", label: "12. Gender", width: 15 },
  { key: "documentType", label: "13. Type", width: 26 },
  { key: "documentNumber", label: "14. Number", width: 37 },
  { key: "documentExpiry", label: "15. Expiry date", width: 25 },
] as const satisfies readonly ImoCrewListColumn[];
