import type { OwnJobApplication } from "./jobApplications";
import type {
  JobEmploymentType,
  JobPostStatus,
} from "./jobPosts";
import type { MarketplaceAccountRole } from "./marketplaceCapabilities";

export type MyJobApplicationJob = {
  id: string;
  listingNumber: string;
  title: string;
  position: string;
  department: string;
  employmentType: JobEmploymentType;
  location: string;
  startDate: string | null;
  closesAt: string | null;
  status: JobPostStatus;
};

export type MyJobApplication = OwnJobApplication & {
  job: MyJobApplicationJob;
};

export type MyJobApplicationsResponse = {
  ok: true;
  role: MarketplaceAccountRole;
  eligible: boolean;
  applications: MyJobApplication[];
};
