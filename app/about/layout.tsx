import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About BlueDeck | Yacht Careers & Operations",
  description:
    "Learn how BlueDeck connects yacht careers, professional crew recruitment and private yacht operations in one trusted platform.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About BlueDeck | Yacht Careers & Operations",
    description:
      "A connected platform for yacht careers, professional crew recruitment and private yacht operations.",
    url: "/about",
    siteName: "BlueDeck",
    type: "website",
    images: ["/og.png"],
  },
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
