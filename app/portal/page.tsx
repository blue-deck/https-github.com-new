"use client";

import { useEffect } from "react";
import { BlueDeckLogoLink } from "../components/BlueDeckLogo";

export default function PortalPage() {
  useEffect(() => {
    const raw = localStorage.getItem("bluedeck_user");

    if (!raw) {
      window.location.href = "/login";
      return;
    }

    const user = JSON.parse(raw);

    if (user.role === "captain") {
      window.location.href = `/yachts/${user.yacht_id}/command`;
    } else if (user.role === "engineer") {
      window.location.href = `/yachts/${user.yacht_id}/engineer-mobile`;
    } else if (user.role === "crew") {
      window.location.href = `/yachts/${user.yacht_id}/crew-mobile`;
    } else if (user.role === "owner") {
      window.location.href = `/yachts/${user.yacht_id}/owner`;
    } else {
      window.location.href = "/login";
    }
  }, []);

  return (
    <main className="bd-ocean-shell flex min-h-screen items-center justify-center p-10 text-slate-900">
      <div className="bd-ocean-content text-center">
        <BlueDeckLogoLink href="/" className="mx-auto h-12 w-40 rounded-none border-0 bg-transparent shadow-none sm:w-52" imageClassName="object-contain p-0" />
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
          Opening BlueDeck
        </p>
      </div>
    </main>
  );
}
