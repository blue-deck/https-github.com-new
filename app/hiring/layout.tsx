import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privatePageMetadata } from "../lib/privatePageMetadata";

export const metadata: Metadata = {
  ...privatePageMetadata,
  title: "My Job Postings & Hiring | BlueDeck",
  description:
    "Manage yacht job postings, review applicants and organize hiring decisions from one private BlueDeck workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HiringLayout({ children }: { children: ReactNode }) {
  return children;
}
