import type { Metadata } from "next";
import { JobApplicationsManager } from "./JobApplicationsManager";

export const metadata: Metadata = {
  title: "Job Applications | BlueDeck",
  description: "Review and manage candidates for a BlueDeck job post.",
  robots: { index: false, follow: false },
};

export default async function JobApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobApplicationsManager jobId={id} />;
}
