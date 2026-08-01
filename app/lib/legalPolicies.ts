export const privacyPolicyVersion = "2026-08-01";
export const termsOfUseVersion = "2026-08-01";

export type LegalAcceptance = {
  accepted: true;
  privacyVersion: typeof privacyPolicyVersion;
  termsVersion: typeof termsOfUseVersion;
};

export function currentLegalAcceptance(): LegalAcceptance {
  return {
    accepted: true,
    privacyVersion: privacyPolicyVersion,
    termsVersion: termsOfUseVersion,
  };
}

export function isCurrentLegalAcceptance(
  value: unknown,
): value is LegalAcceptance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => !["accepted", "privacyVersion", "termsVersion"].includes(key),
    )
  ) {
    return false;
  }
  return (
    record.accepted === true &&
    record.privacyVersion === privacyPolicyVersion &&
    record.termsVersion === termsOfUseVersion
  );
}
