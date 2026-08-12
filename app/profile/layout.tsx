import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "My Crew Profile & CV | BlueDeck",
  "Manage your professional yacht crew profile, private credentials, portfolio and BlueDeck CV.",
);

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
