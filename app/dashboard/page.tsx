"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ClipboardCheck, FileText, LogOut, Settings, Ship, Trash2, Upload, UserRound } from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";
import { BLUEDECK } from "../config";
import { saveCrewProfileByUserId } from "../lib/crewProfiles";
import { supabase } from "../lib/supabase";

type DashboardProfile = {
  id?: string;
  crew_profile_id?: string;
  email?: string;
  full_name?: string;
  phone?: string;
  role?: string;
  profile_photo_url?: string;
};

function cleanDisplayName(profile?: DashboardProfile | null) {
  const name = profile?.full_name?.trim();
  if (name && name !== profile?.email) return name;
  return "";
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const { data: crewProfile } = await supabase
      .from("crew_profiles")
      .select("id, full_name, phone, email, profile_photo_url")
      .eq("user_id", user.id)
      .maybeSingle();

    const preferredName =
      cleanDisplayName(profileData) ||
      cleanDisplayName(crewProfile) ||
      (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
      user.email;

    if (!profileData) {
      const { data: newProfile } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: preferredName,
          phone: crewProfile?.phone || user.user_metadata?.phone || "",
          role: user.user_metadata?.role || "crew",
        })
        .select()
        .single();

      profileData = newProfile;
    } else if (preferredName && profileData.full_name !== preferredName) {
      profileData = { ...profileData, full_name: preferredName };
    }

    setProfile({
      ...profileData,
      crew_profile_id: crewProfile?.id,
      full_name: preferredName,
      email: profileData?.email || crewProfile?.email || user.email,
      phone: profileData?.phone || crewProfile?.phone || user.user_metadata?.phone || "",
      profile_photo_url:
        crewProfile?.profile_photo_url ||
        (typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : ""),
    });
    setLoading(false);
  }

  async function saveDashboardPhoto(file: File) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setPhotoUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
    const path = `${profile?.crew_profile_id || user.id}/dashboard-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("crew-portfolio").upload(path, file, {
      upsert: false,
    });

    if (uploadError) {
      setPhotoUploading(false);
      alert(uploadError.message === "Bucket not found" ? "Photo storage is not ready yet. Please create the crew-portfolio bucket in Supabase." : uploadError.message);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("crew-portfolio").getPublicUrl(path);
    const photoUrl = publicUrl.publicUrl;

    const { data: crewProfile, error: profileError } = await saveCrewProfileByUserId<{
      id?: string;
      profile_photo_url?: string;
    }>(
      supabase,
      user.id,
      {
        email: profile?.email || user.email,
        full_name: profile?.full_name || user.user_metadata?.full_name || user.email,
        phone: profile?.phone || user.user_metadata?.phone || "",
        profile_photo_url: photoUrl,
        public_crew_id: user.id.slice(0, 8).toUpperCase(),
      },
      "id, profile_photo_url"
    );

    await supabase.auth.updateUser({
      data: {
        full_name: profile?.full_name || user.user_metadata?.full_name || user.email,
        phone: profile?.phone || user.user_metadata?.phone || "",
        avatar_url: photoUrl,
      },
    });

    setPhotoUploading(false);
    setPhotoMenuOpen(false);

    if (profileError) {
      alert(profileError.message);
      return;
    }

    setProfile((current) => ({
      ...(current || {}),
      crew_profile_id: crewProfile?.id || current?.crew_profile_id,
      profile_photo_url: photoUrl,
    }));
  }

  async function removeDashboardPhoto() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setPhotoUploading(true);
    const { error } = await supabase
      .from("crew_profiles")
      .update({ profile_photo_url: "" })
      .eq("user_id", user.id);

    await supabase.auth.updateUser({
      data: {
        avatar_url: "",
        full_name: profile?.full_name || user.user_metadata?.full_name || user.email,
        phone: profile?.phone || user.user_metadata?.phone || "",
      },
    });

    setPhotoUploading(false);
    setPhotoMenuOpen(false);

    if (error) {
      alert(error.message);
      return;
    }

    setProfile((current) => ({ ...(current || {}), profile_photo_url: "" }));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <main className="bd-ocean-shell min-h-screen p-10 text-slate-900">
        <div className="bd-ocean-content">{t("dashboard.loading")}</div>
      </main>
    );
  }

  const isCaptain =
    profile?.role === "captain" || profile?.role === "management";

  return (
    <main className="bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-7xl">
        <div className="bd-glass-card-strong relative rounded-[34px] p-6 sm:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="bd-kicker">{t("dashboard.myDashboard")}</p>

              <h1 className="bd-serif mt-4 text-5xl font-normal text-[#071f3c] sm:text-6xl">
                {t("dashboard.welcome")}, {profile?.full_name || profile?.email}
              </h1>

              <p className="mt-4 text-lg text-slate-600">{t("dashboard.role")}: {profile?.role}</p>
            </div>

            <div className="relative z-30 flex shrink-0 flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setPhotoMenuOpen((open) => !open)}
                className="bd-focus group relative h-32 w-32 overflow-hidden rounded-full border border-cyan-200 bg-white shadow-2xl shadow-cyan-950/12 transition hover:border-cyan-400"
                aria-label="Manage dashboard profile photo"
              >
                {profile?.profile_photo_url ? (
                  <img src={profile.profile_photo_url} alt={profile.full_name || "Profile"} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f8fafc,#dff8fb)] text-cyan-700">
                    <UserRound className="h-12 w-12" />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-950/72 py-2 text-xs font-black text-white opacity-0 transition group-hover:opacity-100">
                  <Camera className="h-3.5 w-3.5" />
                  Photo
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await saveDashboardPhoto(file);
                  event.target.value = "";
                }}
              />

              <p className="text-xs font-semibold text-slate-500">
                {photoUploading ? t("dashboard.updatingPhoto") : t("dashboard.profilePhoto")}
              </p>

              {photoMenuOpen && (
                <div className="absolute right-1/2 top-[calc(100%+10px)] z-50 w-56 translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-2xl shadow-slate-900/18 lg:right-0 lg:translate-x-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-semibold text-slate-700 transition hover:bg-cyan-50"
                  >
                    <Upload className="h-4 w-4 text-cyan-700" />
                    {profile?.profile_photo_url ? "Change photo" : "Upload photo"}
                  </button>
                  {profile?.profile_photo_url && (
                    <button
                      type="button"
                      onClick={removeDashboardPhoto}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 font-semibold text-[#b9423b] transition hover:bg-[#fff6f5]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove photo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/profile"
            className="bd-focus bd-glass-card rounded-[28px] p-8 transition hover:-translate-y-1 hover:bg-white/90"
          >
            <UserRound className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold text-slate-950">My Profile</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Manage your crew ID, documents, expiry dates, portfolio and CV.
            </p>
          </Link>

          {isCaptain ? (
            <>
              <Link
                href="/yachts"
                className="bd-focus bd-glass-card rounded-[28px] p-8 transition hover:-translate-y-1 hover:bg-white/90"
              >
                <Ship className="h-8 w-8 text-cyan-700" />
                <h2 className="mt-5 text-3xl font-semibold text-slate-950">Captain Workspace</h2>
                <p className="mt-3 leading-7 text-slate-600">
                  Manage yachts, crew, documents and onboard operations.
                </p>
              </Link>

              <Link
                href={`/yachts/${BLUEDECK.yachtId}/checklists`}
                className="bd-focus bd-glass-card rounded-[28px] p-8 transition hover:-translate-y-1 hover:bg-white/90"
              >
                <ClipboardCheck className="h-8 w-8 text-cyan-700" />
                <h2 className="mt-5 text-3xl font-semibold text-slate-950">Checklist System</h2>
                <p className="mt-3 leading-7 text-slate-600">
                  Assign checklist duties, review crew progress and inspect task proof.
                </p>
              </Link>
            </>
          ) : (
            <Link
              href="/crew/tasks"
              className="bd-focus bd-glass-card rounded-[28px] p-8 transition hover:-translate-y-1 hover:bg-white/90"
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
            className="bd-focus bd-glass-card rounded-[28px] p-8 transition hover:-translate-y-1 hover:bg-white/90"
          >
            <FileText className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold text-slate-950">Contracts</h2>
            <p className="mt-3 leading-7 text-slate-600">Review yacht contracts assigned to your profile.</p>
          </Link>

          <Link
            href="/settings"
            className="bd-focus bd-glass-card rounded-[28px] p-8 transition hover:-translate-y-1 hover:bg-white/90"
          >
            <Settings className="h-8 w-8 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-semibold text-slate-950">Settings</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Update account details, phone, email, password and security access.
            </p>
          </Link>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="bd-focus rounded-[28px] border border-[#ef776f]/30 bg-white/70 p-8 text-left text-[#b9423b] shadow-xl shadow-slate-900/5 backdrop-blur transition hover:bg-[#fff6f5]"
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
