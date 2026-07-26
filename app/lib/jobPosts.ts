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
export const jobSalaryPeriods = ["day", "week", "month", "year"] as const;
export const jobSalaryCurrencies = ["EUR", "USD", "GBP", "AUD", "NZD"] as const;
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

export type JobPostStatus = (typeof jobPostStatuses)[number];
export type JobEmploymentType = (typeof jobEmploymentTypes)[number];
export type JobCandidateType = (typeof jobCandidateTypes)[number];
export type JobSmokerPolicy = (typeof jobSmokerPolicies)[number];
export type JobVisibleTattooPolicy =
  (typeof jobVisibleTattooPolicies)[number];
export type JobSalaryPeriod = (typeof jobSalaryPeriods)[number];
export type JobSalaryCurrency = (typeof jobSalaryCurrencies)[number];
export type JobClosureReason = (typeof jobClosureReasons)[number];
export type JobYachtType = (typeof jobYachtTypes)[number];
export type JobYachtLengthUnit = (typeof jobYachtLengthUnits)[number];

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
  requiredLanguages: string[];
  yachtType: JobYachtType | null;
  yachtLength: number | null;
  yachtLengthUnit: JobYachtLengthUnit | null;
  minimumYachtExperienceYears: number | null;
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

const jobCandidateTypeLabels: Record<
  JobCandidateType,
  { en: string; tr: string }
> = {
  individual: { en: "Individual", tr: "Bireysel" },
  team: { en: "Team", tr: "Ekip" },
  couple: { en: "Couple", tr: "Çift" },
};

export function formatJobCandidateType(
  value: JobCandidateType,
  language: "en" | "tr",
) {
  return jobCandidateTypeLabels[value][language];
}

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

export function formatJobMinimumYachtExperience(
  value: number,
  language: "en" | "tr",
) {
  if (value === 0) {
    return language === "tr"
      ? "Yat deneyimi şartı yok"
      : "No minimum yacht experience";
  }

  if (language === "tr") return `En az ${value} yıl yat deneyimi`;
  return `Minimum ${value} ${value === 1 ? "year" : "years"} of yacht experience`;
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
