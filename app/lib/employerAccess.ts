import { marketplacePostingRoles } from "./marketplaceCapabilities";

export const platformAdminMetadataKey = "bluedeck_admin";
export const employerAccessNoteLimit = 240;

export const employerAccessStatuses = [
  "pending",
  "verified",
  "rejected",
  "suspended",
] as const;

export const employerRoles = marketplacePostingRoles;

export type EmployerAccessStatus = (typeof employerAccessStatuses)[number];
export type EmployerRole = (typeof employerRoles)[number];

export type EmployerAccessEntry = {
  requestId: string;
  yachtId: string;
  yachtName: string;
  yachtModel: string;
  role: EmployerRole;
  status: EmployerAccessStatus;
  applicantNote: string;
  requestedAt: string;
  updatedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  reviewNote: string;
};

export type EmployerAccessYacht = {
  id: string;
  name: string;
  model: string;
  flag: string;
  access: EmployerAccessEntry | null;
};

const employerAccessTransitions: Readonly<
  Record<EmployerAccessStatus, readonly EmployerAccessStatus[]>
> = {
  pending: ["verified", "rejected"],
  verified: ["suspended"],
  rejected: ["pending", "verified"],
  suspended: ["verified"],
};

export function isPlatformAdmin(
  metadata?: Record<string, unknown> | null,
) {
  return metadata?.[platformAdminMetadataKey] === true;
}

export function isEmployerRole(value: unknown): value is EmployerRole {
  return employerRoles.includes(value as EmployerRole);
}

export function isEmployerAccessStatus(
  value: unknown,
): value is EmployerAccessStatus {
  return employerAccessStatuses.includes(value as EmployerAccessStatus);
}

export function isAllowedEmployerAccessTransition(
  current: EmployerAccessStatus,
  next: EmployerAccessStatus,
) {
  return employerAccessTransitions[current].includes(next);
}
