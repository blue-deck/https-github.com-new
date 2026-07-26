export const jobPostStatuses = ["draft", "published", "closed"] as const;
export const jobEmploymentTypes = [
  "permanent",
  "temporary",
  "seasonal",
  "rotation",
  "daywork",
] as const;
export const jobSalaryPeriods = ["day", "week", "month", "year"] as const;
export const jobSalaryCurrencies = ["EUR", "USD", "GBP", "AUD", "NZD"] as const;
export const jobClosureReasons = ["expired", "cancelled"] as const;

export type JobPostStatus = (typeof jobPostStatuses)[number];
export type JobEmploymentType = (typeof jobEmploymentTypes)[number];
export type JobSalaryPeriod = (typeof jobSalaryPeriods)[number];
export type JobSalaryCurrency = (typeof jobSalaryCurrencies)[number];
export type JobClosureReason = (typeof jobClosureReasons)[number];

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

export function isEmployerJobPostExpired(
  job: EmployerJobPost,
  at = Date.now(),
) {
  if (job.closureReason === "expired") return true;
  if (job.closureReason === "cancelled" || !job.expiresAt) return false;

  const expiresAt = Date.parse(job.expiresAt);
  return !Number.isNaN(expiresAt) && expiresAt <= at;
}
