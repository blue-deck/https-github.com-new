import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "BlueDeck Offline",
  "Reconnect to continue using your private BlueDeck workspace.",
);

export default function OfflineLayout({ children }: { children: ReactNode }) {
  return children;
}
