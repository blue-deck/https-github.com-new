import type { Metadata, Viewport } from "next";
import { AuthenticatedTopBar } from "./components/AuthenticatedTopBar";
import { LanguageProvider } from "./components/LanguageProvider";
import { BLUEDECK_SITE_URL } from "./lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BLUEDECK_SITE_URL),
  title: "BlueDeck | Yacht Management Platform",
  description:
    "A premium yacht management website for owners, captains and crew: profiles, documents, contracts, checklist workflows and private yacht readiness.",
  openGraph: {
    title: "BlueDeck Yacht Management",
    description:
      "Private yacht operations, crew workflows, documents, contracts and readiness in one premium website.",
    siteName: "BlueDeck",
    images: ["/bluedeck-ocean-hero.png"],
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: "#f5fbff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <AuthenticatedTopBar />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
