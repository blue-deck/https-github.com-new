"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    let { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profileData) {
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.email,
          role: "crew",
        })
        .select()
        .single();

      profileData = newProfile;
    }

    setProfile(profileData);
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#081120] p-10 text-white">
        Loading dashboard...
      </main>
    );
  }

  const isCaptain =
    profile?.role === "captain" || profile?.role === "management";

  return (
    <main className="min-h-screen bg-[#081120] p-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl bg-white/5 p-8">
          <p className="text-gray-400">BlueDeck Dashboard</p>

          <h1 className="mt-3 text-5xl font-bold">
            Welcome, {profile?.full_name || profile?.email}
          </h1>

          <p className="mt-4 text-xl text-gray-400">Role: {profile?.role}</p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {isCaptain ? (
            <a
              href="/yachts"
              className="rounded-3xl border border-white/10 bg-white/5 p-8 transition hover:border-blue-400/40"
            >
              <h2 className="text-3xl font-bold">Captain Workspace</h2>
              <p className="mt-3 text-gray-400">
                Manage yachts, crew, tasks, documents and maintenance.
              </p>
            </a>
          ) : (
            <a
              href="/crew"
              className="rounded-3xl border border-white/10 bg-white/5 p-8 transition hover:border-blue-400/40"
            >
              <h2 className="text-3xl font-bold">My Crew Portal</h2>
              <p className="mt-3 text-gray-400">
                View your assigned tasks and onboard checklists.
              </p>
            </a>
          )}

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-left text-red-300 transition hover:bg-red-500/20"
          >
            <h2 className="text-3xl font-bold">Logout</h2>
            <p className="mt-3">Sign out from your BlueDeck account.</p>
          </button>
        </div>
      </div>
    </main>
  );
}