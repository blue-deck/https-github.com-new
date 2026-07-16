import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BlueDeck handles account, yacht recruitment, crew profile, application and onboard operations data.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
