import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "BlueDeck terms for yacht job listings, crew applications, employer review, onboarding and connected yacht operations.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
