import type { ReactNode } from "react";
import { privatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = privatePageMetadata;

export default function MyBlueLayout({ children }: { children: ReactNode }) {
  return children;
}
