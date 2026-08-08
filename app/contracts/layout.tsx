import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "My Contracts | BlueDeck",
  "Review and securely accept yacht contracts assigned to your BlueDeck account.",
);

export default function ContractsLayout({ children }: { children: ReactNode }) {
  return children;
}
