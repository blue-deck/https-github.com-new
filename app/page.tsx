import type { Metadata } from "next";
import localFont from "next/font/local";
import HomePageClient from "./HomePageClient";

const heroFont = localFont({
  src: "./fonts/michroma/Michroma-Regular.ttf",
  weight: "400",
  display: "swap",
  variable: "--font-bluedeck-display",
});

export const metadata: Metadata = {
  title: "BlueDeck | Yacht Careers, Crew & Operations",
  description:
    "Discover yacht jobs, find professional crew and manage private yacht operations through one connected BlueDeck platform.",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return <HomePageClient heroFontClassName={heroFont.variable} />;
}
