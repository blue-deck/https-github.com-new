import type { Metadata } from "next";
import HomePageClient from "./HomePageClient";
import { absoluteSiteUrl } from "./lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "BlueDeck | Yacht Jobs, Crew Hiring & YACHT-OS",
  },
  description:
    "Find professional yacht jobs, hire qualified crew and connect each successful placement to BlueDeck profiles, contracts, onboarding and yacht operations.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BlueDeck | Yacht Jobs, Crew Hiring & YACHT-OS",
    description:
      "Search yacht careers, recruit professional crew and continue directly into connected yacht operations.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "BlueDeck | Yacht Jobs, Crew Hiring & YACHT-OS",
    description:
      "Search yacht careers, recruit professional crew and continue directly into connected yacht operations.",
  },
};

export default function HomePage() {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BlueDeck",
    url: absoluteSiteUrl("/"),
    description:
      "Professional yacht jobs, crew hiring and connected yacht operations.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteSiteUrl("/jobs")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <HomePageClient />
    </>
  );
}
