import type { Metadata, Viewport } from "next";
import { AuthenticatedTopBar } from "./components/AuthenticatedTopBar";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bluedeck.app"),
  title: "BlueDeck YachtOS | Private Superyacht Operating System",
  description:
    "A private operating system for modern superyachts: owner experience, captain operations, crew workflows, bridge intelligence and engineering readiness.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BlueDeck",
  },
  openGraph: {
    title: "BlueDeck YachtOS",
    description:
      "Private superyacht operations, owner experience and captain-grade bridge intelligence in one premium interface.",
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
