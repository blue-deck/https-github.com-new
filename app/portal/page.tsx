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
    <main className="flex min-h-screen items-center justify-center bg-[#020817] p-10 text-white">
      <div className="text-center">
        <BlueDeckLogoLink href="/" className="mx-auto h-16 w-44 rounded-2xl" imageClassName="p-1" />
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Opening BlueDeck
        </p>
      </div>
    </main>
  );
}
