import type { Metadata } from "next";
import { HiringClient } from "./HiringClient";

export const metadata: Metadata = {
  title: "Yacht Crew Hiring Desk",
  description:
    "Create professional yacht job listings and manage your private BlueDeck hiring workspace.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function HiringPage() {
  return <HiringClient />;
}
