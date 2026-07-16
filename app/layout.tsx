import type { Metadata, Viewport } from "next";
import { AuthenticatedTopBar } from "./components/AuthenticatedTopBar";
import { LanguageProvider } from "./components/LanguageProvider";
import { PlatformBridge } from "./components/PlatformBridge";
import { BLUEDECK_SITE_URL } from "./lib/site";
import { BLUEDECK_SUPABASE_URL } from "./lib/supabaseConfig";
import "./globals.css";

const bluedeckLogoUrl = `${BLUEDECK_SITE_URL}/bluedeck-search-icon.png`;
const bluedeckSearchIconUrl = `${BLUEDECK_SITE_URL}/bluedeck-search-icon.png`;

export const metadata: Metadata = {
  metadataBase: new URL(BLUEDECK_SITE_URL),
  applicationName: "BlueDeck",
  title: {
    default: "BlueDeck | Yacht Jobs, Crew Careers & YACHT-OS",
    template: "%s | BlueDeck",
  },
  description:
    "Find professional yacht jobs, hire qualified crew and connect every successful placement to BlueDeck profiles, contracts, onboarding and yacht operations.",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    title: "BlueDeck",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "BlueDeck Yacht Jobs, Crew Careers & YACHT-OS",
    description:
      "Professional yacht recruitment and connected crew operations in one premium platform.",
    url: BLUEDECK_SITE_URL,
    siteName: "BlueDeck",
    images: [
      {
        url: bluedeckSearchIconUrl,
        width: 1024,
        height: 1024,
        alt: "BlueDeck",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "BlueDeck Yacht Jobs, Crew Careers & YACHT-OS",
    description:
      "Professional yacht recruitment and connected crew operations in one premium platform.",
    images: [bluedeckSearchIconUrl],
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
  themeColor: "#071631",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={BLUEDECK_SUPABASE_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={BLUEDECK_SUPABASE_URL} />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <LanguageProvider>
          <PlatformBridge />
          <AuthenticatedTopBar />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
