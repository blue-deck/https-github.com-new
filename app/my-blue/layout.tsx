import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "My BlueDeck",
  "Access your personal BlueDeck workspace and account shortcuts.",
);

export default function MyBlueLayout({ children }: { children: ReactNode }) {
  return children;
}
