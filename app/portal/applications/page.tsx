import type { Metadata } from "next";
import { MyJobApplicationsPortal } from "./MyJobApplicationsPortal";

export const metadata: Metadata = {
  title: "My Job Applications | BlueDeck",
  description:
    "Track your BlueDeck yacht job applications and their current status.",
  robots: { index: false, follow: false },
};

export default function MyJobApplicationsPage() {
  return <MyJobApplicationsPortal />;
}
