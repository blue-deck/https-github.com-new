import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms of Use | BlueDeck",
  description:
    "Read the terms for using BlueDeck accounts, crew services and private yacht workspaces.",
  alternates: { canonical: "/terms" },
};

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children;
}
