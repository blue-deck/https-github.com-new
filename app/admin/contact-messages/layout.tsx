import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Contact Messages | BlueDeck",
  "Private BlueDeck contact inbox.",
);

export default function ContactMessagesLayout({ children }: { children: ReactNode }) {
  return children;
}
