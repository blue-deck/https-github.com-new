import type { ReactNode } from "react";
import { privatePageMetadata } from "../lib/privatePageMetadata";

export const metadata = privatePageMetadata;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
