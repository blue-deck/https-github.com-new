import "server-only";

import {
  parseCrewDiscoverySettings,
  type CrewDiscoverySettings,
} from "./crewDiscovery";
import { normalizeCrewPortfolioStoragePath } from "./crewPortfolioStorage";
import { resolveSupabaseUrl } from "./supabaseConfig";

const publicCrewIdPattern = /^[A-Z0-9_-]{1,64}$/;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const obfuscatedEmailPattern = /\b[A-Z0-9._%+-]+\s*(?:\[at\]|\(at\)|\{at\}|\bat\b)\s*[A-Z0-9.-]+\s*(?:\[dot\]|\(dot\)|\{dot\}|\bdot\b|\.)\s*[A-Z]{2,}\b/gi;
const flexibleEmailPattern = /\b[A-Z0-9._%+-]{1,64}\s*(?:@|\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}|\bat\b)\s*[A-Z0-9-]{1,63}(?:\s*(?:\.|\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\bdot\b)\s*[A-Z0-9-]{1,63})*\s*(?:\.|\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\bdot\b)\s*[A-Z]{2,24}\b/gi;
const phoneCandidatePattern = /(?:\+?\d[\d\s().-]{5,}\d)/g;
const publicUrlPattern = /\b(?:https?:\/\/|www\.)[^\s<>{}\[\]]+/gi;
const schemelessDomainPattern = /\b(?:[A-Z0-9-]{1,63}\s*(?:\.|\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\s+dot\s+)\s*)+(?:COM|NET|ORG|ME|IO|CO|APP|DEV|EU|TR|UK|DE|FR|ES|IT)\b(?:\s*\/\s*[A-Z0-9._~!$&'()*+,;=:@%/-]{1,200})?/gi;
const genericSchemelessDomainPattern = /\b(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}\b(?:\/[A-Z0-9._~!$&'()*+,;=:@%/-]{1,200})?/gi;
const socialHandlePattern = /(^|[^A-Z0-9._%+-])@[A-Z0-9._-]{2,64}\b/gi;
const labelledSocialHandlePattern = /\b(?:instagram|telegram|whatsapp|linkedin|facebook|signal|wechat|skype|discord|ig)\b\s*(?:(?:is|at|on|user(?:name)?|handle|account|profile)\s*)*(?:(?::|=|\-|\/)\s*)?@?[A-Z0-9._+-]{2,64}\b/gi;
const structuredContactKeywordPattern = /\b(?:contact|discord|dm|email|facebook|handle|ig|instagram|linkedin|mail|message|mobile|phone|profile|signal|skype|snapchat|telegram|threads|tiktok|twitter|user(?:name)?|wechat|whatsapp)\b/i;
const structuredIdentifierPattern = /[A-Z0-9][._][A-Z0-9]/i;
const structuredUnsafeSymbolPattern = /[@:=#<>\[\]{}|\\]/;
const contactWithheldText = "Contact details withheld";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizePublicCrewId(value: string) {
  let decoded = "";

  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "";
  }

  const normalized = decoded.trim().toUpperCase();
  return publicCrewIdPattern.test(normalized) ? normalized : "";
}

export function publicCrewMediaUrl(
  crewId: string,
  kind: "avatar" | "gallery",
  slot?: number,
) {
  const normalizedCrewId = normalizePublicCrewId(crewId);
  if (
    !normalizedCrewId ||
    (kind !== "avatar" && kind !== "gallery") ||
    (kind === "avatar" && slot !== undefined) ||
    (kind === "gallery" &&
      (slot === undefined ||
        !Number.isSafeInteger(slot) ||
        slot < 0 ||
        slot > 3))
  ) {
    return "";
  }

  const search = new URLSearchParams({ kind });
  if (kind === "gallery") search.set("slot", String(slot));
  return `/api/find-crew/${encodeURIComponent(normalizedCrewId)}/media?${search.toString()}`;
}

export function getPublicCrewDiscoverySettings(
  notes: unknown,
): CrewDiscoverySettings {
  return parseCrewDiscoverySettings(
    typeof notes === "string" ? notes : "",
  );
}

export function redactPublicContactDetails(value: unknown, maxLength = 2_000) {
  if (typeof value !== "string") return "";

  const safeMaxLength = Math.max(0, Math.min(maxLength, 10_000));

  return value
    .trim()
    .replace(flexibleEmailPattern, contactWithheldText)
    .replace(obfuscatedEmailPattern, contactWithheldText)
    .replace(emailPattern, contactWithheldText)
    .replace(publicUrlPattern, contactWithheldText)
    .replace(schemelessDomainPattern, contactWithheldText)
    .replace(genericSchemelessDomainPattern, contactWithheldText)
    .replace(labelledSocialHandlePattern, contactWithheldText)
    .replace(socialHandlePattern, (_match, prefix: string) =>
      `${prefix}${contactWithheldText}`,
    )
    .replace(phoneCandidatePattern, (candidate) => {
      const digits = candidate.replace(/\D/g, "");
      const separators = (candidate.match(/[\s().-]/g) || []).length;
      const compact = candidate.trim();
      const looksLikePhone =
        digits.length >= 7 &&
        (compact.startsWith("+") ||
          separators >= 1 ||
          /^\d{7,}$/.test(compact));

      return looksLikePhone ? contactWithheldText : candidate;
    })
    .replace(
      new RegExp(`(?:${contactWithheldText}\\s*){2,}`, "gi"),
      contactWithheldText,
    )
    .slice(0, safeMaxLength)
    .trim();
}

export function safePublicMediaUrl(value: unknown) {
  return (
    normalizeCrewPortfolioStoragePath(
      value,
      [],
      resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    ) || ""
  );
}

export function safeOwnedPublicMediaUrl(
  value: unknown,
  ownerIds: unknown[],
) {
  if (!ownerIds.some((ownerId) => typeof ownerId === "string" && uuidPattern.test(ownerId.trim()))) {
    return "";
  }

  return (
    normalizeCrewPortfolioStoragePath(
      value,
      ownerIds,
      resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    ) || ""
  );
}

export function selectPublicCrewGallerySources(
  rows: unknown[],
  selectionSeed: string,
) {
  return selectCrewGallerySources(rows, selectionSeed, safePublicMediaUrl);
}

export function selectOwnedPublicCrewGallerySources(
  rows: unknown[],
  selectionSeed: string,
  ownerIds: unknown[],
) {
  return selectCrewGallerySources(rows, selectionSeed, (value) =>
    safeOwnedPublicMediaUrl(value, ownerIds),
  );
}

function selectCrewGallerySources(
  rows: unknown[],
  selectionSeed: string,
  safeMediaUrl: (value: unknown) => string,
) {
  if (!selectionSeed.trim()) return [];

  const originalOrder = Array.from(
    new Set(
      rows
        .map((row) =>
          row && typeof row === "object" && !Array.isArray(row)
            ? safeMediaUrl((row as Record<string, unknown>).image_url)
            : "",
        )
        .filter(Boolean),
    ),
  );
  const selected = [...originalOrder]
    .sort(
      (left, right) =>
        stablePublicTextHash(`${selectionSeed}:${left}`) -
        stablePublicTextHash(`${selectionSeed}:${right}`),
    )
    .slice(0, 4);

  if (
    originalOrder.length > 4 &&
    selected.every((photo) => originalOrder.slice(0, 4).includes(photo))
  ) {
    return [originalOrder[4], ...selected.slice(0, 3)].filter(Boolean);
  }

  return selected;
}

export function publicStructuredProfileField(
  value: unknown,
  maxLength = 120,
) {
  const redacted = redactPublicContactDetails(value, maxLength);
  if (
    !redacted ||
    redacted.includes(contactWithheldText) ||
    structuredContactKeywordPattern.test(redacted) ||
    structuredIdentifierPattern.test(redacted) ||
    structuredUnsafeSymbolPattern.test(redacted)
  ) {
    return "";
  }

  return redacted;
}

export function publicStructuredStringArray(
  value: unknown,
  limit = 18,
  maxItemLength = 120,
) {
  if (!Array.isArray(value)) return [];

  const safeLimit = Math.max(0, Math.min(limit, 50));
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => publicStructuredProfileField(item, maxItemLength))
        .filter(Boolean),
    ),
  ).slice(0, safeLimit);
}

export function publicStringArray(
  value: unknown,
  limit = 18,
  maxItemLength = 120,
) {
  if (!Array.isArray(value)) return [];

  const safeLimit = Math.max(0, Math.min(limit, 50));

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) =>
          redactPublicContactDetails(item, maxItemLength),
        )
        .filter(Boolean),
    ),
  ).slice(0, safeLimit);
}

function stablePublicTextHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
