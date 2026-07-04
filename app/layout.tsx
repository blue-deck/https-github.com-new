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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/bluedeck-favicon.png?v=20260704-2", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico?v=20260704-2", sizes: "any" },
      { url: "/favicon-16x16.png?v=20260704-2", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=20260704-2", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192x192.png?v=20260704-2", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=20260704-2", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico?v=20260704-2"],
  },
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
