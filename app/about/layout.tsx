import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "About BlueDeck | Yachting Crew Management & Software";
const description =
  "BlueDeck Yachting Crew Management and Software brings professional crew management and purpose-built digital solutions together for yacht crew and teams.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title,
    description,
    url: "/about",
    siteName: "BlueDeck",
    type: "website",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
