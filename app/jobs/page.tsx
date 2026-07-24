import type { Metadata } from "next";
import { JobsClient } from "./JobsClient";

export const metadata: Metadata = {
  title: "Yacht Crew Jobs | BlueDeck",
  description:
    "Browse active yacht crew opportunities published through BlueDeck.",
  alternates: {
    canonical: "/jobs",
  },
};

export default function JobsPage() {
  return <JobsClient />;
}
