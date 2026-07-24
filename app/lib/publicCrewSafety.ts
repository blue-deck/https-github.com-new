import "server-only";

import {
  parseCrewDiscoverySettings,
  type CrewDiscoverySettings,
} from "./crewDiscovery";

const publicCrewIdPattern = /^[A-Z0-9_-]{1,64}$/;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phoneCandidatePattern = /(?:\+?\d[\d\s().-]{5,}\d)/g;
const contactWithheldText = "Contact details withheld";

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

export function getPublicCrewDiscoverySettings(
  notes: unknown,
): CrewDiscoverySettings | null {
  const settings = parseCrewDiscoverySettings(
    typeof notes === "string" ? notes : "",
  );

  if (!settings.discoverable || settings.contactVisibility === "hidden") {
    return null;
  }

  return settings;
}

export function redactPublicContactDetails(value: unknown, maxLength = 2_000) {
  if (typeof value !== "string") return "";

  const safeMaxLength = Math.max(0, Math.min(maxLength, 10_000));

  return value
    .trim()
    .replace(emailPattern, contactWithheldText)
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
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > 2_048
  ) {
    return "";
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
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
