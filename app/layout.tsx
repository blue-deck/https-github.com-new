import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlueDeck YachtOS",
  description: "Enterprise Superyacht Operating Platform",
  manifest: "/manifest.json",
  themeColor: "#06b6d4",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BlueDeck",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}