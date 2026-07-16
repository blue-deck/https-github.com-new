import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login or Create an Account",
  description:
    "Sign in to BlueDeck or create a professional crew, captain, owner or yacht management account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
