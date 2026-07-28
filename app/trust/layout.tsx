import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Trust & Security | BlueDeck",
  description:
    "See how BlueDeck approaches privacy, role-based access and secure yacht and crew workflows.",
  alternates: { canonical: "/trust" },
  openGraph: {
    title: "Trust & Security | BlueDeck",
    description:
      "Privacy, controlled access and traceable workflows for professional yacht teams.",
    url: "/trust",
    siteName: "BlueDeck",
    type: "website",
    images: ["/og.png"],
  },
};

export default function TrustLayout({ children }: { children: ReactNode }) {
  return children;
}
