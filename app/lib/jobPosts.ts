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

export type JobPostStatus = (typeof jobPostStatuses)[number];
export type JobEmploymentType = (typeof jobEmploymentTypes)[number];
export type JobSalaryPeriod = (typeof jobSalaryPeriods)[number];
export type JobSalaryCurrency = (typeof jobSalaryCurrencies)[number];

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
  closesAt: string | null;
};

export type EmployerJobPost = Omit<PublicJobPost, "publishedAt"> & {
  yachtId: string;
  status: JobPostStatus;
  salaryVisible: boolean;
  showYachtName: boolean;
  version: number;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VerifiedEmployerYacht = JobYachtSummary & {
  id: string;
};

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
