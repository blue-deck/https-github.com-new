import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "BlueDeck Homepage Concepts",
    template: "%s | BlueDeck Homepage Concepts",
  },
  description: "Private design study for BlueDeck homepage directions.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HomepageConceptsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
