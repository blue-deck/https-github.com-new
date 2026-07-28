import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact BlueDeck | Yacht Careers & Operations",
  description:
    "Contact BlueDeck about yacht careers, crew recruitment, account support or private yacht operations.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact BlueDeck",
    description:
      "Talk to BlueDeck about yacht careers, crew recruitment, account support or private yacht operations.",
    url: "/contact",
    siteName: "BlueDeck",
    type: "website",
    images: ["/og.png"],
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
