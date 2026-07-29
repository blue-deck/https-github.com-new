import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy | BlueDeck",
  description:
    "Read how BlueDeck handles account, crew, yacht, document and operational information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
