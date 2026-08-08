import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Account Settings | BlueDeck",
  "Manage security, privacy and account preferences for your BlueDeck workspace.",
);

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
