import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privatePageMetadata } from "../../lib/privatePageMetadata";

export const metadata: Metadata = {
  ...privatePageMetadata,
  title: "Confirm Your Account | BlueDeck",
  description: "Securely confirm your BlueDeck account.",
  alternates: { canonical: "/auth/confirm" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConfirmAuthLayout({ children }: { children: ReactNode }) {
  return children;
}
