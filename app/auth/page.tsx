"use client";

import { useEffect } from "react";

export default function AuthPage() {
  useEffect(() => {
    window.location.replace("/login");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#020817] p-6 text-white">
      Redirecting to secure login...
    </main>
  );
}
