import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hiring Access | BlueDeck",
  description:
    "Request and review secure hiring access for yachts connected to your BlueDeck account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HiringLayout({ children }: { children: ReactNode }) {
  return children;
}
