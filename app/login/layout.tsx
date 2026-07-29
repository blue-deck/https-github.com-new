import type { Metadata } from "next";
import type { ReactNode } from "react";
import { privatePageMetadata } from "../lib/privatePageMetadata";

export const metadata: Metadata = {
  ...privatePageMetadata,
  title: "Log In or Create an Account | BlueDeck",
  description:
    "Access your BlueDeck crew, recruitment or private yacht operations workspace.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
