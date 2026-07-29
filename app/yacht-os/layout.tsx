import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Yacht-OS | Private Yacht Operations | BlueDeck",
  description:
    "Run crew records, documents, readiness and daily private yacht operations from one connected BlueDeck workspace.",
  alternates: { canonical: "/yacht-os" },
  openGraph: {
    title: "Yacht-OS | Private Yacht Operations | BlueDeck",
    description:
      "A connected workspace for crew records, documents, readiness and daily private yacht operations.",
    url: "/yacht-os",
    siteName: "BlueDeck",
    type: "website",
    images: ["/og.png"],
  },
};

export default function YachtOsLayout({ children }: { children: ReactNode }) {
  return children;
}
