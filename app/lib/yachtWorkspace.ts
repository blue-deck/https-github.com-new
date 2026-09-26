import { isBlueDeckCountryCode } from "./countries";
import { isJobYachtType, type JobYachtType } from "./jobPosts";

export const maximumYachtPhotoBytes = 4 * 1024 * 1024;
export const yachtPhotoMimeTypes = [
  "image/jpeg", "image/png", "image/webp", "image/avif",
] as const;

export type YachtWorkspaceCard = {
  id: string;
  name: string;
  yachtType: JobYachtType | null;
  model: string | null;
  crewSize: number | null;
  flag: string | null;
  photoUrl: string | null;
};

export type YachtWorkspaceDetails = {
  name: string;
  yachtType: JobYachtType;
  model: string;
  crewSize: number;
  flag: string;
};

export function parseYachtWorkspaceDetails(
  input: Record<string, unknown>,
  existingFlag?: string | null,
): { ok: true; value: YachtWorkspaceDetails } | { ok: false; error: string; code: string } {
  const name = cleanText(input.name);
  const model = cleanText(input.model);
  const yachtType = cleanText(input.yachtType);
  const rawCrewSize = typeof input.crewSize === "number"
    ? String(input.crewSize)
    : cleanText(input.crewSize);
  const rawFlag = cleanText(input.flag);
  const flag = isBlueDeckCountryCode(rawFlag)
    ? rawFlag.toUpperCase()
    : existingFlag && rawFlag === existingFlag.trim() ? existingFlag : rawFlag;

  if (!name || name.length > 120) {
    return { ok: false, error: "Enter a yacht name of 1 to 120 characters.", code: "invalid_name" };
  }
  if (!isJobYachtType(yachtType)) {
    return { ok: false, error: "Choose a yacht type.", code: "invalid_yacht_type" };
  }
  if (!model || model.length > 120) {
    return { ok: false, error: "Enter a model of 1 to 120 characters.", code: "invalid_model" };
  }
  if (!/^\d{1,3}$/.test(rawCrewSize)) {
    return { ok: false, error: "Enter a crew size from 0 to 999.", code: "invalid_crew_size" };
  }
  // Historical yachts stored free-text flags. Keep an unchanged legacy value
  // readable/editable, while requiring the shared country picker for new flags.
  if (!isBlueDeckCountryCode(flag) && (!existingFlag || flag !== existingFlag)) {
    return { ok: false, error: "Choose a yacht flag.", code: "invalid_flag" };
  }
  return { ok: true, value: { name, yachtType, model, crewSize: Number(rawCrewSize), flag } };
}

export function isYachtPhotoPath(path: unknown, ownerId: string, yachtId: string): path is string {
  if (typeof path !== "string") return false;
  const prefix = `${ownerId}/${yachtId}/`;
  return path.startsWith(prefix) && /^[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(path.slice(prefix.length));
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
