export const jobPostStatuses = ["draft", "published", "closed"] as const;
export const jobEmploymentTypes = [
  "permanent",
  "temporary",
  "seasonal",
  "rotation",
  "daywork",
] as const;
export const jobCandidateTypes = ["individual", "team", "couple"] as const;
export const jobSmokerPolicies = [
  "no_preference",
  "non_smoker",
  "smoker_accepted",
] as const;
export const jobVisibleTattooPolicies = [
  "no_preference",
  "not_accepted",
  "accepted",
] as const;
export const jobRequiredLanguages = [
  "English",
  "Turkish",
  "French",
  "Italian",
  "Spanish",
  "German",
  "Greek",
  "Portuguese",
  "Russian",
  "Ukrainian",
  "Arabic",
] as const;
export const jobSkillOptions = [
  "Navigation",
  "Cruise planning",
  "COLREG",
  "Crew management",
  "Guest service",
  "Tender driving",
  "Water sports",
  "Deck maintenance",
  "Line handling",
  "Mooring operations",
  "Watchkeeping",
  "Safety management",
  "Refit and repair",
  "Engine room checks",
  "Administration",
  "Budgeting",
  "Interior service",
  "Table service",
  "Laundry",
  "Galley support",
] as const;
export const jobCharacteristicOptions = [
  "Calm under pressure",
  "Reliable",
  "Safety-focused",
  "Discreet",
  "Guest-oriented",
  "Team player",
  "Leadership",
  "Adaptable",
  "Organized",
  "Hard-working",
  "Positive attitude",
  "Detail-oriented",
  "Stress-resistant",
  "Communicative",
  "Motivated",
] as const;
export const jobCertificateOptions = [
  "Valid Passport",
  "Seafarer's Book",
  "STCW Basic Safety Training",
  "ENG1 Medical Certificate",
  "Security Awareness",
  "Designated Security Duties (PDSD)",
  "RYA Powerboat Level 2",
  "RYA Yachtmaster Offshore",
  "RYA Yachtmaster Ocean",
  "Certificate of Competency (CoC)",
  "GMDSS GOC",
  "AEC 1",
  "AEC 2",
  "Advanced Fire Fighting",
  "Medical First Aid",
  "Food Safety Level 2",
  "PWC Instructor",
] as const;
export const jobVisaOptions = [
  "Schengen Visa",
  "US B1/B2 Visa",
  "US C1/D Visa",
  "UK Visa",
  "Australian Maritime Crew Visa (Subclass 988)",
] as const;
export const maximumJobSkillSelections = 5;
export const maximumJobCharacteristicSelections = 5;
export const maximumJobCertificateSelections = jobCertificateOptions.length;
export const maximumJobVisaSelections = jobVisaOptions.length;
export const jobSalaryPeriods = ["day", "week", "month", "year"] as const;
export const jobSalaryCurrencyOptions = [
  "EUR",
  "USD",
  "GBP",
  "AUD",
  "TRY",
] as const;
// Keep NZD readable for listings created before the five-option salary picker.
export const jobSalaryCurrencies = [
  ...jobSalaryCurrencyOptions,
  "NZD",
] as const;
export const jobClosureReasons = ["expired", "cancelled"] as const;
export const jobYachtTypes = [
  "motor_yacht",
  "sailing_yacht",
  "catamaran",
  "motor_catamaran",
  "gulet",
  "expedition_yacht",
  "classic_yacht",
  "support_vessel",
  "chase_boat",
  "commercial_vessel",
  "new_build",
] as const;
export const jobYachtLengthUnits = ["m", "ft"] as const;
export const jobMinimumYachtExperiences = [
  "0_6_months",
  "1_year",
  "2_years",
  "3_years",
  "1_3_years",
  "3_5_years",
  "5_plus_years",
  "5_10_years",
  "10_plus_years",
  "15_plus_years",
  "20_plus_years",
] as const;

export type JobPostStatus = (typeof jobPostStatuses)[number];
export type JobEmploymentType = (typeof jobEmploymentTypes)[number];
export type JobCandidateType = (typeof jobCandidateTypes)[number];
export type JobSmokerPolicy = (typeof jobSmokerPolicies)[number];
export type JobVisibleTattooPolicy =
  (typeof jobVisibleTattooPolicies)[number];
export type JobRequiredLanguage = (typeof jobRequiredLanguages)[number];
export type JobSkill = (typeof jobSkillOptions)[number];
export type JobCharacteristic = (typeof jobCharacteristicOptions)[number];
export type JobCertificate = (typeof jobCertificateOptions)[number];
export type JobVisa = (typeof jobVisaOptions)[number];
export type JobSalaryPeriod = (typeof jobSalaryPeriods)[number];
export type JobSalaryCurrencyOption =
  (typeof jobSalaryCurrencyOptions)[number];
export type JobSalaryCurrency = (typeof jobSalaryCurrencies)[number];
export type JobClosureReason = (typeof jobClosureReasons)[number];
export type JobYachtType = (typeof jobYachtTypes)[number];
export type JobYachtLengthUnit = (typeof jobYachtLengthUnits)[number];
export type JobMinimumYachtExperience =
  (typeof jobMinimumYachtExperiences)[number];

export type JobSalary = {
  min: number | null;
  max: number | null;
  currency: JobSalaryCurrency;
  period: JobSalaryPeriod;
};

export type JobYachtSummary = {
  name: string;
  model: string | null;
  flag: string | null;
};

export type PublicJobPost = {
  id: string;
  listingNumber: string;
  title: string;
  position: string;
  department: string;
  employmentType: JobEmploymentType;
  candidateType: JobCandidateType;
  smokerPolicy: JobSmokerPolicy;
  visibleTattooPolicy: JobVisibleTattooPolicy;
  requiredLanguages: JobRequiredLanguage[];
  requiredSkills: JobSkill[];
  requiredCharacteristics: JobCharacteristic[];
  requiredCertificates: JobCertificate[];
  requiredVisas: JobVisa[];
  yachtBrand: string | null;
  yachtFlagCountryCode: string | null;
  yachtBuildYear: number | null;
  yachtType: JobYachtType | null;
  yachtLength: number | null;
  yachtLengthUnit: JobYachtLengthUnit | null;
  crewMemberCount: number | null;
  minimumYachtExperience: JobMinimumYachtExperience | null;
  location: string;
  startDate: string | null;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  salary: JobSalary | null;
  yacht: JobYachtSummary;
  publishedAt: string;
};

export type EmployerJobPost = Omit<PublicJobPost, "publishedAt"> & {
  yachtId: string;
  status: JobPostStatus;
  salaryVisible: boolean;
  showYachtName: boolean;
  version: number;
  publishedAt: string | null;
  expiresAt: string | null;
  closureReason: JobClosureReason | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VerifiedEmployerYacht = JobYachtSummary & {
  id: string;
};

const jobListingNumberPattern = /^[1-9][0-9]{4}$/;
const legacyJobListingNumberPattern = /^BDJ-[0-9]{4}-[1-9][0-9]{5,}$/;

export function isJobListingNumber(value: unknown): value is string {
  return typeof value === "string" && jobListingNumberPattern.test(value);
}

// Keep legacy references readable during a zero-downtime database migration.
// The database only issues five-digit values after the migration is applied.
export function isSupportedJobListingNumber(value: unknown): value is string {
  return (
    isJobListingNumber(value) ||
    (typeof value === "string" && legacyJobListingNumberPattern.test(value))
  );
}

export function formatJobListingNumber(value: string) {
  return isJobListingNumber(value) ? `#${value}` : value;
}

export function isJobPostStatus(value: unknown): value is JobPostStatus {
  return jobPostStatuses.includes(value as JobPostStatus);
}

export function isJobEmploymentType(
  value: unknown,
): value is JobEmploymentType {
  return jobEmploymentTypes.includes(value as JobEmploymentType);
}

export function isJobCandidateType(value: unknown): value is JobCandidateType {
  return jobCandidateTypes.includes(value as JobCandidateType);
}

export function isJobSmokerPolicy(value: unknown): value is JobSmokerPolicy {
  return jobSmokerPolicies.includes(value as JobSmokerPolicy);
}

export function isJobVisibleTattooPolicy(
  value: unknown,
): value is JobVisibleTattooPolicy {
  return jobVisibleTattooPolicies.includes(value as JobVisibleTattooPolicy);
}

export function isJobRequiredLanguage(
  value: unknown,
): value is JobRequiredLanguage {
  return jobRequiredLanguages.includes(value as JobRequiredLanguage);
}

export function isJobSkill(value: unknown): value is JobSkill {
  return jobSkillOptions.includes(value as JobSkill);
}

export function isJobCharacteristic(
  value: unknown,
): value is JobCharacteristic {
  return jobCharacteristicOptions.includes(value as JobCharacteristic);
}

export function isJobCertificate(value: unknown): value is JobCertificate {
  return jobCertificateOptions.includes(value as JobCertificate);
}

export function isJobVisa(value: unknown): value is JobVisa {
  return jobVisaOptions.includes(value as JobVisa);
}

export function isJobSalaryPeriod(
  value: unknown,
): value is JobSalaryPeriod {
  return jobSalaryPeriods.includes(value as JobSalaryPeriod);
}

export function isJobSalaryCurrency(
  value: unknown,
): value is JobSalaryCurrency {
  return jobSalaryCurrencies.includes(value as JobSalaryCurrency);
}

export function isJobSalaryCurrencyOption(
  value: unknown,
): value is JobSalaryCurrencyOption {
  return jobSalaryCurrencyOptions.includes(value as JobSalaryCurrencyOption);
}

export function isJobClosureReason(
  value: unknown,
): value is JobClosureReason {
  return jobClosureReasons.includes(value as JobClosureReason);
}

export function isJobYachtType(value: unknown): value is JobYachtType {
  return jobYachtTypes.includes(value as JobYachtType);
}

export function isJobYachtLengthUnit(
  value: unknown,
): value is JobYachtLengthUnit {
  return jobYachtLengthUnits.includes(value as JobYachtLengthUnit);
}

export function isJobMinimumYachtExperience(
  value: unknown,
): value is JobMinimumYachtExperience {
  return jobMinimumYachtExperiences.includes(
    value as JobMinimumYachtExperience,
  );
}

const jobYachtTypeLabels: Record<
  JobYachtType,
  { en: string; tr: string }
> = {
  motor_yacht: { en: "Motor yacht", tr: "Motor yat" },
  sailing_yacht: { en: "Sailing yacht", tr: "Yelkenli yat" },
  catamaran: { en: "Catamaran", tr: "Katamaran" },
  motor_catamaran: { en: "Motor catamaran", tr: "Motor katamaran" },
  gulet: { en: "Gulet", tr: "Gulet" },
  expedition_yacht: { en: "Expedition yacht", tr: "Expedition yat" },
  classic_yacht: { en: "Classic yacht", tr: "Klasik yat" },
  support_vessel: { en: "Support vessel", tr: "Destek teknesi" },
  chase_boat: { en: "Chase boat", tr: "Takip botu" },
  commercial_vessel: { en: "Commercial vessel", tr: "Ticari tekne" },
  new_build: { en: "New build", tr: "Yeni inşa" },
};

export function formatJobSmokerPolicy(
  value: JobSmokerPolicy,
  language: "en" | "tr",
) {
  const labels: Record<JobSmokerPolicy, { en: string; tr: string }> = {
    no_preference: { en: "No preference", tr: "Tercih yok" },
    non_smoker: { en: "Non-smoker required", tr: "Sigara içmeyen" },
    smoker_accepted: { en: "Smokers accepted", tr: "Sigara içen kabul edilir" },
  };
  return labels[value][language];
}

export function formatJobVisibleTattooPolicy(
  value: JobVisibleTattooPolicy,
  language: "en" | "tr",
) {
  const labels: Record<JobVisibleTattooPolicy, { en: string; tr: string }> = {
    no_preference: { en: "No preference", tr: "Tercih yok" },
    not_accepted: { en: "No visible tattoos", tr: "Görünür dövme olmamalı" },
    accepted: { en: "Visible tattoos accepted", tr: "Görünür dövme kabul edilir" },
  };
  return labels[value][language];
}

export function formatJobRequiredLanguage(
  value: JobRequiredLanguage,
  language: "en" | "tr",
) {
  const labels: Record<JobRequiredLanguage, { en: string; tr: string }> = {
    English: { en: "English", tr: "İngilizce" },
    Turkish: { en: "Turkish", tr: "Türkçe" },
    French: { en: "French", tr: "Fransızca" },
    Italian: { en: "Italian", tr: "İtalyanca" },
    Spanish: { en: "Spanish", tr: "İspanyolca" },
    German: { en: "German", tr: "Almanca" },
    Greek: { en: "Greek", tr: "Yunanca" },
    Portuguese: { en: "Portuguese", tr: "Portekizce" },
    Russian: { en: "Russian", tr: "Rusça" },
    Ukrainian: { en: "Ukrainian", tr: "Ukraynaca" },
    Arabic: { en: "Arabic", tr: "Arapça" },
  };
  return labels[value][language];
}

export function formatJobVisa(value: JobVisa) {
  if (value === "Schengen Visa") {
    return "Schengen Visa / Residence Permit";
  }
  if (value === "US B1/B2 Visa") {
    return "B1/B2";
  }
  return value;
}

export function formatJobYachtType(
  value: JobYachtType,
  language: "en" | "tr",
) {
  return jobYachtTypeLabels[value][language];
}

export function formatJobYachtLength(
  value: number,
  unit: JobYachtLengthUnit,
  language: "en" | "tr",
) {
  const formatted = new Intl.NumberFormat(language === "tr" ? "tr-TR" : "en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${unit}`;
}

export function formatJobCrewMemberCount(
  value: number,
  language: "en" | "tr",
) {
  if (language === "tr") return `${value} mürettebat`;
  return `${value} ${value === 1 ? "crew member" : "crew members"}`;
}

export function formatJobYachtBuildYear(
  value: number,
  language: "en" | "tr",
) {
  return language === "tr" ? `Yapım ${value}` : `Built ${value}`;
}

const jobMinimumYachtExperienceLabels: Record<
  JobMinimumYachtExperience,
  { en: string; tr: string }
> = {
  "0_6_months": { en: "0–6 months", tr: "0–6 ay" },
  "1_year": { en: "1 year", tr: "1 yıl" },
  "2_years": { en: "2 years", tr: "2 yıl" },
  "3_years": { en: "3 years", tr: "3 yıl" },
  "1_3_years": { en: "1–3 years", tr: "1–3 yıl" },
  "3_5_years": { en: "3–5 years", tr: "3–5 yıl" },
  "5_plus_years": { en: "5+ years", tr: "5+ yıl" },
  "5_10_years": { en: "5–10 years", tr: "5–10 yıl" },
  "10_plus_years": { en: "10+ years", tr: "10+ yıl" },
  "15_plus_years": { en: "15+ years", tr: "15+ yıl" },
  "20_plus_years": { en: "20+ years", tr: "20+ yıl" },
};

export function formatJobMinimumYachtExperience(
  value: JobMinimumYachtExperience,
  language: "en" | "tr",
) {
  return jobMinimumYachtExperienceLabels[value][language];
}

export function isEmployerJobPostExpired(
  job: EmployerJobPost,
  at = Date.now(),
) {
  if (job.closureReason === "expired") return true;
  if (job.closureReason === "cancelled" || !job.expiresAt) return false;

  const expiresAt = Date.parse(job.expiresAt);
  return !Number.isNaN(expiresAt) && expiresAt <= at;
}
