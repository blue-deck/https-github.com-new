"use client";

import { useEffect } from "react";

export default function AuthPage() {
  useEffect(() => {
    window.location.replace("/login");
  }, []);

  return (
    <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center p-6 text-slate-900">
      <div className="bd-ocean-content">Redirecting to secure login...</div>
    </main>
  );
}
