import type { ReactNode } from "react";
import { createPrivatePageMetadata } from "../../lib/privatePageMetadata";

export const metadata = createPrivatePageMetadata(
  "Blog Studio | BlueDeck",
  "Private BlueDeck blog publishing workspace.",
);

export default function BlogAdminLayout({ children }: { children: ReactNode }) {
  return children;
}
