import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hiring & Job Access | BlueDeck",
  description:
    "Publish yacht jobs directly or manage separately verified candidate outreach tools.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HiringLayout({ children }: { children: ReactNode }) {
  return children;
}
