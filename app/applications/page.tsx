import type { Metadata } from "next";
import { ApplicationsClient } from "./ApplicationsClient";

export const metadata: Metadata = {
  title: "My Yacht Job Applications",
  description: "Track your private BlueDeck yacht job applications.",
  robots: { index: false, follow: false },
};

export default function ApplicationsPage() {
  return <ApplicationsClient />;
}
