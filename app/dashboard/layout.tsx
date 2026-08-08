import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Dashboard | BlueDeck",
  "Open your private BlueDeck crew, hiring or yacht operations dashboard.",
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
