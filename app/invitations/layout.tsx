import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Crew Invitation | BlueDeck",
  "Review and securely accept a BlueDeck yacht crew invitation.",
);

export default function InvitationsLayout({ children }: { children: ReactNode }) {
  return children;
}
