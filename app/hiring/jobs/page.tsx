import type { Metadata } from "next";
import { JobPostsManager } from "./JobPostsManager";

export const metadata: Metadata = {
  title: "Manage Job Posts | BlueDeck",
  description:
    "Create and manage yacht crew job posts for verified BlueDeck employers.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HiringJobsPage() {
  return <JobPostsManager />;
}
