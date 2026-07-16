import type { YachtDepartmentId } from "../yachtOperations";

export type JobEmploymentType =
  | "permanent"
  | "seasonal"
  | "rotational"
  | "temporary"
  | "delivery"
  | "daywork"
  | "freelance";

export type JobSalaryPeriod =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "contract";

export type JobSort = "newest" | "starting-soon";

export type EmployerVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

export type PlatformEmployerReviewYacht = {
  id: string;
  name: string;
  model: string | null;
  flag: string | null;
};

export type PlatformEmployerReview = {
  id: string;
  displayName: string;
  companyName: string | null;
  employerType: string;
  countryCode: string | null;
  description: string;
  verificationStatus: "pending";
  createdAt: string | null;
  updatedAt: string | null;
  yachtCount: number;
  yachts: PlatformEmployerReviewYacht[];
  jobCount: number;
};

export type JobSalary = {
  currency: string;
  minimum: number | null;
  maximum: number | null;
  period: JobSalaryPeriod;
};

export type JobEmployerSummary = {
  name: string | null;
  verified: boolean;
};

export type PublicJobListItem = {
  id: string;
  slug: string;
  title: string;
  position: string;
  department: YachtDepartmentId | null;
  employmentType: JobEmploymentType | null;
  employer: JobEmployerSummary;
  location: string | null;
  countryCode: string | null;
  yachtName: string | null;
  yachtType: string | null;
  yachtLengthMetres: number | null;
  yachtProgram: string | null;
  rotation: string | null;
  startDate: string | null;
  endDate: string | null;
  applicationDeadline: string | null;
  openingsCount: number;
  summary: string | null;
  salary: JobSalary | null;
  featured: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
};

export type PublicJobDetail = PublicJobListItem & {
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  certifications: string[];
  visas: string[];
  languages: string[];
  minimumExperienceYears: number | null;
  applicationInstructions: string | null;
};

export type JobsFilters = {
  query: string;
  department: YachtDepartmentId | "";
  position: string;
  employmentType: JobEmploymentType | "";
  location: string;
  sort: JobSort;
  page: number;
  pageSize: number;
};

export type JobsDataState = "ready" | "unavailable";

export type PublicJobsResult = {
  jobs: PublicJobListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  state: JobsDataState;
};

export type PublicJobResult = {
  job: PublicJobDetail | null;
  state: JobsDataState;
};

export type JobsSearchParams = Record<
  string,
  string | string[] | undefined
>;
