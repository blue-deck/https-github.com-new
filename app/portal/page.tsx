"use client";

import { useEffect } from "react";

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
    <main className="min-h-screen bg-[#020817] p-10 text-white">
      Opening BlueDeck...
    </main>
  );
}