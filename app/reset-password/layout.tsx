import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privatePageMetadata } from "../lib/privatePageMetadata";

export const metadata: Metadata = {
  ...privatePageMetadata,
  title: "Choose a New Password | BlueDeck",
  description: "Securely choose a new password for your BlueDeck account.",
  alternates: { canonical: "/reset-password" },
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
