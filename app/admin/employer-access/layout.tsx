import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Employer Access Review | BlueDeck",
  description: "Private BlueDeck employer-access review workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function EmployerAccessAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
