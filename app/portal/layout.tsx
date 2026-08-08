import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Crew Portal | BlueDeck",
  "Access your private yacht crew applications and career workspace.",
);

export default function PortalLayout({ children }: { children: ReactNode }) {
  return children;
}
