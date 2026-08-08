import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Secure Account Access | BlueDeck",
  "Complete a secure BlueDeck account access flow.",
);

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
