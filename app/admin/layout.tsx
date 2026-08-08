import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Employer Access Administration | BlueDeck",
  "Review and manage employer access inside the private BlueDeck administration workspace.",
);

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
