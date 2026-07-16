import type { Metadata } from "next";
import {
  PublicFooter,
  PublicHeader,
} from "@/app/components/PublicSiteChrome";
import { absoluteSiteUrl } from "@/app/lib/site";

export const metadata: Metadata = {
  title: "Yacht Jobs & Crew Careers",
  description:
    "Browse published yacht jobs by position, department, employment type and location on BlueDeck.",
  alternates: {
    canonical: "/jobs",
  },
  openGraph: {
    title: "Yacht Jobs & Crew Careers | BlueDeck",
    description:
      "Explore published yacht opportunities for professional crew on BlueDeck.",
    url: absoluteSiteUrl("/jobs"),
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Yacht Jobs & Crew Careers | BlueDeck",
    description:
      "Explore published yacht opportunities for professional crew on BlueDeck.",
  },
};

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bd-site-shell min-h-screen bg-[#f4f8fc] text-[#071f3c]">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
