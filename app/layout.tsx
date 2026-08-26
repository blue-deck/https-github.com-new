import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AuthenticatedTopBar } from "./components/AuthenticatedTopBar";
import { LanguageProvider } from "./components/LanguageProvider";
import { PlatformBridge } from "./components/PlatformBridge";
import { WebSessionInactivityGuard } from "./components/WebSessionInactivityGuard";
import { BLUEDECK_SITE_URL } from "./lib/site";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-geist-sans",
});

const bluedeckLogoUrl = `${BLUEDECK_SITE_URL}/bluedeck-logo-wide-premium-transparent.png`;
const bluedeckSearchIconUrl = `${BLUEDECK_SITE_URL}/bluedeck-search-icon.png`;
const bluedeckSocialCardUrl = `${BLUEDECK_SITE_URL}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(BLUEDECK_SITE_URL),
  applicationName: "BlueDeck",
  title: "BlueDeck | Yacht Careers, Crew & Operations",
  description:
    "Discover yacht jobs, find professional crew and run private yacht operations through one connected BlueDeck platform.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BlueDeck",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "BlueDeck | Yacht Careers, Crew & Operations",
    description:
      "Discover yacht jobs, find professional crew and run private yacht operations through one connected platform.",
    url: BLUEDECK_SITE_URL,
    siteName: "BlueDeck",
    type: "website",
    images: [
      {
        url: bluedeckSocialCardUrl,
        width: 1200,
        height: 630,
        alt: "BlueDeck — Yacht careers, crew and operations",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BlueDeck | Yacht Careers, Crew & Operations",
    description:
      "Discover yacht jobs, find professional crew and run private yacht operations through one connected platform.",
    images: [bluedeckSocialCardUrl],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "BlueDeck",
    "msapplication-TileColor": "#071631",
    "msapplication-TileImage": "/mstile-150x150.png",
    "msapplication-config": "/browserconfig.xml",
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
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <LanguageProvider>
          <PlatformBridge />
          <WebSessionInactivityGuard />
          <AuthenticatedTopBar />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
