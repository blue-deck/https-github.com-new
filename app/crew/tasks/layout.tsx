import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Crew Tasks | BlueDeck",
  "Manage assigned yacht tasks, checklists and operational responsibilities.",
);

export default function CrewTasksLayout({ children }: { children: ReactNode }) {
  return children;
}
