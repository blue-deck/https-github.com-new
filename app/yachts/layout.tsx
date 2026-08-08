import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "My Yachts | BlueDeck",
  "Manage your private yacht workspaces, crew and operational records.",
);

export default function YachtsLayout({ children }: { children: ReactNode }) {
  return children;
}
