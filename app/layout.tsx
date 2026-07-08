import type { Metadata, Viewport } from "next";
import { AuthenticatedTopBar } from "./components/AuthenticatedTopBar";
import { LanguageProvider } from "./components/LanguageProvider";
import { BLUEDECK_SITE_URL } from "./lib/site";
import "./globals.css";

const faviconVersion = "20260707-3";
const bluedeckLogoUrl = `${BLUEDECK_SITE_URL}/bluedeck-favicon.png`;
const bluedeckSearchIconUrl = `${BLUEDECK_SITE_URL}/bluedeck-search-icon.png`;

export const metadata: Metadata = {
  metadataBase: new URL(BLUEDECK_SITE_URL),
  applicationName: "BlueDeck",
  title: "BlueDeck | Yacht Management Platform",
  description:
    "A premium yacht management website for owners, captains and crew: profiles, documents, contracts, checklist workflows and private yacht readiness.",
  manifest: `/manifest.json?v=${faviconVersion}`,
  icons: {
    icon: [
      { url: `/bluedeck-search-icon.png?v=${faviconVersion}`, sizes: "96x96", type: "image/png" },
      { url: `/favicon.ico?v=${faviconVersion}`, sizes: "any" },
      { url: `/favicon-16x16.png?v=${faviconVersion}`, sizes: "16x16", type: "image/png" },
      { url: `/favicon-32x32.png?v=${faviconVersion}`, sizes: "32x32", type: "image/png" },
      { url: `/favicon-48x48.png?v=${faviconVersion}`, sizes: "48x48", type: "image/png" },
      { url: `/favicon-96x96.png?v=${faviconVersion}`, sizes: "96x96", type: "image/png" },
      { url: `/favicon-192x192.png?v=${faviconVersion}`, sizes: "192x192", type: "image/png" },
      { url: `/android-chrome-192x192.png?v=${faviconVersion}`, sizes: "192x192", type: "image/png" },
      { url: `/bluedeck-favicon.png?v=${faviconVersion}`, sizes: "512x512", type: "image/png" },
      { url: `/android-chrome-512x512.png?v=${faviconVersion}`, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: `/apple-touch-icon.png?v=${faviconVersion}`, sizes: "180x180", type: "image/png" },
    ],
    shortcut: [
      `/bluedeck-search-icon.png?v=${faviconVersion}`,
      `/favicon.ico?v=${faviconVersion}`,
    ],
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: `/apple-touch-icon-precomposed.png?v=${faviconVersion}`,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "BlueDeck",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "BlueDeck Yacht Management",
    description:
      "Private yacht operations, crew workflows, documents, contracts and readiness in one premium website.",
    siteName: "BlueDeck",
    images: ["/bluedeck-ocean-hero.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "BlueDeck",
    "msapplication-TileColor": "#071631",
    "msapplication-TileImage": `/mstile-150x150.png?v=${faviconVersion}`,
    "msapplication-config": `/browserconfig.xml?v=${faviconVersion}`,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BlueDeck",
  url: BLUEDECK_SITE_URL,
  logo: bluedeckLogoUrl,
  image: bluedeckSearchIconUrl,
};

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: "#071631",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <LanguageProvider>
          <AuthenticatedTopBar />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
