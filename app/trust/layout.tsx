import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust & Recruitment Safety",
  description:
    "How BlueDeck protects professional yacht recruitment with privacy controls, employer review, data minimization and scam-safety guidance.",
  alternates: {
    canonical: "/trust",
  },
};

export default function TrustLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
