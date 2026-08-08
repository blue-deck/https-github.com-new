import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Create Your BlueDeck Account",
  "Create a secure BlueDeck account for yacht careers, hiring or private operations.",
);

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
