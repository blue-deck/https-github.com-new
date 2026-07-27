import type { Metadata } from "next";
import { JobPostsManager } from "./JobPostsManager";

export const metadata: Metadata = {
  title: "Create Job Post | BlueDeck",
  description:
    "Create a professional yacht crew job post with BlueDeck.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function HiringJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string | string[] }>;
}) {
  const requestedJob = (await searchParams).job;
  const initialJobId = (
    Array.isArray(requestedJob) ? requestedJob[0] : requestedJob || ""
  )
    .trim()
    .toLowerCase();

  return <JobPostsManager initialJobId={initialJobId} />;
}
