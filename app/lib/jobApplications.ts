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

export const jobApplicationJobAvailabilities = [
  "active",
  "expired",
  "cancelled",
  "unavailable",
] as const;

export const jobApplicationModes = ["individual", "team_couple"] as const;

export type JobApplicationStatus =
  (typeof jobApplicationStatuses)[number];
export type EmployerJobApplicationStatus =
  (typeof employerJobApplicationStatuses)[number];
export type JobApplicationJobAvailability =
  (typeof jobApplicationJobAvailabilities)[number];
export type JobApplicationMode = (typeof jobApplicationModes)[number];

export type EmployerJobApplicationCandidate = {
  displayName: string;
  initials: string;
  profilePhotoUrl: string;
  currentPosition: string;
  nationality: string;
  availabilityStatus: string;
  experienceYears: number;
  cvCompletionPercent: number;
  premiumProfile: boolean;
};

export type EmployerJobApplicationMember = {
  id: string;
  applicantRole: "crew" | "captain";
  isPrimary: boolean;
  candidate: EmployerJobApplicationCandidate;
};

export type OwnJobApplication = {
  id: string;
  jobPostId: string;
  applicationMode: JobApplicationMode;
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
  candidate: EmployerJobApplicationCandidate;
  members: EmployerJobApplicationMember[];
};

export type EmployerJobApplicationDetails = {
  applicationId: string;
  memberId: string;
  isPrimaryMember: boolean;
  candidate: {
    displayName: string;
    initials: string;
    profilePhotoUrl: string;
    currentPosition: string;
    nationality: string;
    location: string;
    gender: string;
    maritalStatus: string;
    heightCm: number | null;
    weightKg: number | null;
    smoker: string;
    visibleTattoos: string;
    professionalSummary: string;
    skills: string[];
    characteristics: string[];
    workPreferences: string[];
    seekingPositions: string[];
    employmentTypes: string[];
    preferredLocations: string[];
    languages: Array<{
      name: string;
      level: string;
    }>;
    galleryPhotos: string[];
    referenceCount: number;
    documentCount: number;
    experienceYears: number;
    publicCrewId: string;
    portalAvailable: boolean;
    cvCompletionPercent: number;
    premiumProfile: boolean;
  };
};

export type JobApplicationJobSummary = {
  id: string;
  listingNumber: string;
  title: string;
  position: string;
  startDate: string | null;
  status: "draft" | "published" | "closed";
  availability: JobApplicationJobAvailability;
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

export function isJobApplicationJobAvailability(
  value: unknown,
): value is JobApplicationJobAvailability {
  return jobApplicationJobAvailabilities.includes(
    value as JobApplicationJobAvailability,
  );
}

export function isJobApplicationMode(value: unknown): value is JobApplicationMode {
  return jobApplicationModes.includes(value as JobApplicationMode);
}

export function canWithdrawJobApplication(status: JobApplicationStatus) {
  return ["submitted", "reviewing", "shortlisted"].includes(status);
}
