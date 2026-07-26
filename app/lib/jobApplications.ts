export const jobApplicationStatuses = [
  "submitted",
  "reviewing",
  "shortlisted",
  "rejected",
  "hired",
  "withdrawn",
] as const;

export const employerJobApplicationStatuses = [
  "reviewing",
  "shortlisted",
  "rejected",
  "hired",
] as const;

export type JobApplicationStatus =
  (typeof jobApplicationStatuses)[number];
export type EmployerJobApplicationStatus =
  (typeof employerJobApplicationStatuses)[number];

export type OwnJobApplication = {
  id: string;
  jobPostId: string;
  status: JobApplicationStatus;
  coverNote: string;
  submittedAt: string;
  updatedAt: string;
  withdrawnAt: string | null;
  version: number;
};

export type EmployerJobApplication = OwnJobApplication & {
  applicantRole: "crew" | "captain";
  privateNoteAvailable: boolean;
  candidate: {
    fullName: string;
    profilePhotoUrl: string;
    currentPosition: string;
    location: string;
    nationality: string;
    seekingPositions: string[];
  };
};

export type JobApplicationJobSummary = {
  id: string;
  listingNumber: string;
  title: string;
  position: string;
  startDate: string | null;
  status: "draft" | "published" | "closed";
};

export function isJobApplicationStatus(
  value: unknown,
): value is JobApplicationStatus {
  return jobApplicationStatuses.includes(value as JobApplicationStatus);
}

export function isEmployerJobApplicationStatus(
  value: unknown,
): value is EmployerJobApplicationStatus {
  return employerJobApplicationStatuses.includes(
    value as EmployerJobApplicationStatus,
  );
}

export function canWithdrawJobApplication(status: JobApplicationStatus) {
  return ["submitted", "reviewing", "shortlisted"].includes(status);
}
