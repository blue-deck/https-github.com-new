"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, FileText, LogOut, Ship, UserRound } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
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
      <main className="min-h-screen bg-[#f4f0e8] p-10 text-slate-900">
        Loading dashboard...
      </main>
    );
  }

  const isCaptain =
    profile?.role === "captain" || profile?.role === "management";

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fbf7ef_0%,#eef7f8_48%,#f7efe0_100%)] px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-8 shadow-2xl shadow-slate-900/10 backdrop-blur">
          <p className="bd-kicker">My Dashboard</p>

          <h1 className="mt-4 text-4xl font-semibold text-slate-950 sm:text-5xl">
            Welcome, {profile?.full_name || profile?.email}
          </h1>

          <p className="mt-4 text-lg text-slate-600">Role: {profile?.role}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Link
            href="/profile"
            className="bd-focus rounded-2xl border border-white/70 bg-white/80 p-8 shadow-xl shadow-slate-900/5 transition hover:border-[#22d3ee]/45"
          >
            <UserRound className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold text-slate-950">My Profile</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Manage your crew ID, documents, expiry dates, portfolio and CV.
            </p>
          </Link>

          {isCaptain ? (
            <Link
              href="/yachts"
              className="bd-focus rounded-2xl border border-white/70 bg-white/80 p-8 shadow-xl shadow-slate-900/5 transition hover:border-[#22d3ee]/45"
            >
              <Ship className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">Captain Workspace</h2>
              <p className="mt-3 leading-7 text-slate-600">
                Manage yachts, crew, tasks, documents and maintenance.
              </p>
            </Link>
          ) : (
            <Link
              href="/crew/tasks"
              className="bd-focus rounded-2xl border border-white/70 bg-white/80 p-8 shadow-xl shadow-slate-900/5 transition hover:border-[#22d3ee]/45"
            >
              <ClipboardCheck className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">My YachtOS</h2>
              <p className="mt-3 leading-7 text-slate-600">
                View captain invitations, yacht duties and onboard checklists.
              </p>
            </Link>
          )}

          <Link
            href="/contracts"
            className="bd-focus rounded-2xl border border-white/70 bg-white/80 p-8 shadow-xl shadow-slate-900/5 transition hover:border-[#22d3ee]/45"
          >
            <FileText className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold text-slate-950">Contracts</h2>
            <p className="mt-3 leading-7 text-slate-600">Review yacht contracts assigned to your profile.</p>
          </Link>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="bd-focus rounded-2xl border border-[#ef776f]/30 bg-white/80 p-8 text-left text-[#b9423b] shadow-xl shadow-slate-900/5 transition hover:bg-[#fff6f5]"
          >
            <LogOut className="h-8 w-8" />
            <h2 className="mt-5 text-3xl font-semibold">Logout</h2>
            <p className="mt-3">Sign out from your BlueDeck account.</p>
          </button>
        </div>
      </div>
    </main>
  );
}
