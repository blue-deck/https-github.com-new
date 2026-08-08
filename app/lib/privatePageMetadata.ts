import type { Metadata } from "next";

export const privatePageMetadata = {
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
} satisfies Metadata;

export function createPrivatePageMetadata(
  title: string,
  description: string,
): Metadata {
  return {
    ...privatePageMetadata,
    title,
    description,
  };
}
