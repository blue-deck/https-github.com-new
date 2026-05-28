import type { Metadata, Viewport } from "next";
import { AuthenticatedTopBar } from "./components/AuthenticatedTopBar";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bluedeck.app"),
  title: "BlueDeck | Private Yacht Management Platform",
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
        <AuthenticatedTopBar />
        {children}
      </body>
    </html>
  );
}
