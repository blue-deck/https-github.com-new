"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Ship,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useLanguage } from "../components/LanguageProvider";
import {
  dashboardPhotoFromMetadata,
  removeDashboardPhoto as clearDashboardPhoto,
  saveDashboardPhoto as persistDashboardPhoto,
  subscribeDashboardPhotoUpdates,
} from "../lib/accountIdentity";
import {
  loadAccountCapabilities,
  type AccountCapabilities,
} from "../lib/accountCapabilities";
import { supabase } from "../lib/supabase";

type DashboardProfile = {
  id?: string;
  crew_profile_id?: string;
  email?: string;
  full_name?: string;
  phone?: string;
  role?: string;
  is_admin?: boolean;
  profile_photo_url?: string;
  dashboard_photo_url?: string;
};

type DashboardYachtInvite = {
  id: string;
  yacht_id: string;
  yacht_name: string;
  position?: string;
  department?: string;
  public_crew_id?: string;
  invited_email?: string;
  created_at?: string;
  crew_profile_id?: string;
  sender_name?: string;
  sender_role?: string;
  token?: string;
};

type DashboardDeck = {
  id: string;
  yacht_id: string;
  yacht_name: string;
  position?: string;
  department?: string;
};

const dashboardCopy = {
  en: {
    profileDescription: "Manage your crew ID, documents, expiry dates and CV.",
    galleryDescription: "Open and manage your professional photo gallery.",
    inviteBadge: "Invite",
    inviteTitle: "Yacht Invite",
    invitedBy: "You are invited by",
    invitedFor: "for",
    crewDuty: "crew duty",
    sent: "Sent",
    from: "From",
    blueDeckCaptain: "BlueDeck captain",
    blueDeckYacht: "BlueDeck yacht",
    acceptingInvite: "Accepting...",
    acceptInvite: "Accept Yacht Invite",
    additionalDecks: (count: number) => `+${count} additional ${count === 1 ? "deck" : "decks"}`,
    captainWorkspaceDescription: "Manage yachts, crew, documents and onboard operations.",
    applicationsTitle: "My Applications",
    applicationsDescription: "Track the jobs you applied for and their latest status in one place.",
    contractsDescription: "Review yacht contracts assigned to your profile.",
    photoUpdateFailed: "Your photo could not be updated.",
    photoStorageUnavailable: "Photo storage is not ready yet. Please try again later.",
    photoRemoveFailed: "Your photo could not be removed.",
    inviteLinkIncomplete: "This invitation link is incomplete. Ask the sender to create a new invitation.",
    inviteAcceptFailed: "Invitation could not be accepted.",
  },
  tr: {
    profileDescription: "Mürettebat kimliğinizi, belgelerinizi, geçerlilik tarihlerinizi ve CV’nizi yönetin.",
    galleryDescription: "Profesyonel fotoğraf galerinizi açın ve yönetin.",
    inviteBadge: "Davet",
    inviteTitle: "Yat Daveti",
    invitedBy: "Şu yat tarafından davet edildiniz:",
    invitedFor: "Görev",
    crewDuty: "mürettebat görevi",
    sent: "Gönderildi",
    from: "Gönderen",
    blueDeckCaptain: "BlueDeck kaptanı",
    blueDeckYacht: "BlueDeck yatı",
    acceptingInvite: "Kabul ediliyor...",
    acceptInvite: "Yat Davetini Kabul Et",
    additionalDecks: (count: number) => `+${count} ek tekne`,
    captainWorkspaceDescription: "Yatları, mürettebatı, belgeleri ve tekne operasyonlarını yönetin.",
    applicationsTitle: "Başvurularım",
    applicationsDescription: "Başvurduğunuz ilanları ve güncel durumlarını tek ekrandan takip edin.",
    contractsDescription: "Profilinize atanmış yat kontratlarını inceleyin.",
    photoUpdateFailed: "Fotoğrafınız güncellenemedi.",
    photoStorageUnavailable: "Fotoğraf depolama alanı henüz hazır değil. Lütfen daha sonra tekrar deneyin.",
    photoRemoveFailed: "Fotoğrafınız kaldırılamadı.",
    inviteLinkIncomplete: "Bu davet bağlantısı eksik. Gönderenden yeni bir davet oluşturmasını isteyin.",
    inviteAcceptFailed: "Davet kabul edilemedi.",
  },
} as const;

function cleanDisplayName(profile?: DashboardProfile | null) {
  const name = profile?.full_name?.trim();
  if (name && name !== profile?.email) return name;
  return "";
}

function uniqueById<T extends { id?: string }>(items: T[]) {
  return items.filter(
    (item, index, list) =>
      Boolean(item.id) && list.findIndex((candidate) => candidate.id === item.id) === index
  );
}

function DashboardPhotoControl({
  url,
  photoAlt,
  addLabel,
  changeLabel,
  removeLabel,
  uploading,
  uploadingLabel,
  onChoose,
  onRemove,
}: {
  url?: string;
  photoAlt: string;
  addLabel: string;
  changeLabel: string;
  removeLabel: string;
  uploading: boolean;
  uploadingLabel: string;
  onChoose: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 sm:h-28 sm:w-28"
      aria-busy={uploading}
    >
      {url && (
        <img
          src={url}
          alt={photoAlt}
          className="h-full w-full object-cover transition duration-200 pointer-fine:group-hover:scale-[1.02] pointer-fine:group-hover:brightness-75 pointer-fine:group-hover:blur-[1px] group-focus-within:scale-[1.02] group-focus-within:brightness-75 group-focus-within:blur-[1px]"
        />
      )}

      {!url && !uploading && (
        <button
          type="button"
          onClick={onChoose}
          aria-label={addLabel}
          title={addLabel}
          className="absolute inset-0 flex cursor-pointer items-center justify-center text-cyan-800 transition hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-200 bg-white shadow-sm transition group-hover:scale-105 group-hover:border-cyan-300">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
        </button>
      )}

      {url && !uploading && (
        <>
          <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-slate-950/35 opacity-0 backdrop-blur-[1px] transition duration-200 group-hover:opacity-100 group-focus-within:opacity-100 pointer-fine:flex">
            <button
              type="button"
              onClick={onChoose}
              aria-label={changeLabel}
              title={changeLabel}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-cyan-800 shadow-lg">
                <Camera className="h-4 w-4" aria-hidden />
              </span>
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={removeLabel}
              title={removeLabel}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition hover:bg-rose-100/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-lg">
                <Trash2 className="h-4 w-4" aria-hidden />
              </span>
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-slate-950/60 via-slate-950/20 to-transparent px-0.5 pb-1 pt-4 pointer-fine:hidden">
            <button
              type="button"
              onClick={onChoose}
              aria-label={changeLabel}
              title={changeLabel}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-cyan-800 shadow-md">
                <Camera className="h-4 w-4" aria-hidden />
              </span>
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={removeLabel}
              title={removeLabel}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-md">
                <Trash2 className="h-4 w-4" aria-hidden />
              </span>
            </button>
          </div>
        </>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-cyan-800 backdrop-blur-[2px]">
          <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      )}

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {uploading ? uploadingLabel : ""}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { language, t } = useLanguage();
  const copy = dashboardCopy[language];
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [accountCapabilities, setAccountCapabilities] =
    useState<AccountCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [deckInvites, setDeckInvites] = useState<DashboardYachtInvite[]>([]);
  const [myDecks, setMyDecks] = useState<DashboardDeck[]>([]);
  const [acceptingInviteId, setAcceptingInviteId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function hydrateDeckAccess(crewProfile: any, userEmail?: string | null) {
    const normalizedEmail = (userEmail || crewProfile?.email || "").trim().toLowerCase();
    const inviteQueries = [];

    if (normalizedEmail) {
      inviteQueries.push(
        supabase
          .from("crew_invitations")
          .select("*")
          .eq("status", "pending")
          .eq("invited_email", normalizedEmail)
          .order("created_at", { ascending: false })
      );
    }

    if (crewProfile?.id) {
      inviteQueries.push(
        supabase
          .from("crew_invitations")
          .select("*")
          .eq("status", "pending")
          .eq("crew_profile_id", crewProfile.id)
          .order("created_at", { ascending: false })
      );
    }

    const inviteResponses = await Promise.all(inviteQueries);
    const inviteRows = uniqueById(inviteResponses.flatMap((response) => response.data || []));

    let membershipRows: any[] = [];
    if (crewProfile?.id) {
      const { data } = await supabase
        .from("yacht_crew_memberships")
        .select("*")
        .eq("crew_profile_id", crewProfile.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      membershipRows = data || [];
    }

    const yachtIds = Array.from(
      new Set([
        ...inviteRows.map((item) => item.yacht_id),
        ...membershipRows.map((item) => item.yacht_id),
      ].filter(Boolean))
    );

    let yachtMap = new Map<string, any>();
    let profileMap = new Map<string, any>();

    if (yachtIds.length) {
      const { data: yachts } = await supabase
        .from("yachts")
        .select("id, name, owner_id")
        .in("id", yachtIds);
      yachtMap = new Map((yachts || []).map((yacht: any) => [yacht.id, yacht]));

      const ownerIds = Array.from(new Set((yachts || []).map((yacht: any) => yacht.owner_id).filter(Boolean)));
      if (ownerIds.length) {
        const { data: senders } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .in("id", ownerIds);
        profileMap = new Map((senders || []).map((sender: any) => [sender.id, sender]));
      }
    }

    setDeckInvites(
      inviteRows.map((invite: any) => {
        const yacht = yachtMap.get(invite.yacht_id);
        const sender = yacht?.owner_id ? profileMap.get(yacht.owner_id) : null;
        return {
          ...invite,
          yacht_name: yacht?.name || "BlueDeck yacht",
          sender_name: cleanDisplayName(sender) || sender?.email || "BlueDeck captain",
          sender_role: sender?.role || "Captain",
        };
      })
    );

    setMyDecks(
      membershipRows.map((membership) => ({
        id: membership.id,
        yacht_id: membership.yacht_id,
        yacht_name: yachtMap.get(membership.yacht_id)?.name || "BlueDeck yacht",
        position: membership.position,
        department: membership.department,
      }))
    );
  }

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const [profileResult, capabilities] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle(),
      loadAccountCapabilities(),
    ]);

    let crewProfile: Record<string, any> | null = null;
    if (capabilities?.canUseCrewWorkspace === true) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        try {
          await fetch("/api/crew-profile/reconcile", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
        } catch {
          // Reconciliation is a safe, idempotent legacy bridge. The regular
          // dashboard can still load when it is temporarily unavailable.
        }
      }

      const crewProfileResult = await supabase
        .from("crew_profiles")
        .select("id, full_name, phone, email, profile_photo_url")
        .eq("user_id", user.id)
        .maybeSingle();
      crewProfile = crewProfileResult.data;
    }

    let profileData = profileResult.data;

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
          role: capabilities?.role || "crew",
        })
        .select()
        .single();

      profileData = newProfile;
    } else if (preferredName && profileData.full_name !== preferredName) {
      profileData = { ...profileData, full_name: preferredName };
    }

    const userMetadata = user.user_metadata as Record<string, unknown> | undefined;
    const dashboardPhotoUrl = dashboardPhotoFromMetadata(userMetadata, crewProfile?.profile_photo_url);
    if (!userMetadata || !Object.prototype.hasOwnProperty.call(userMetadata, "avatar_url")) {
      await supabase.auth.updateUser({ data: { avatar_url: dashboardPhotoUrl } });
    }

    setProfile({
      ...profileData,
      role: capabilities?.role || profileData?.role || "crew",
      crew_profile_id: crewProfile?.id,
      full_name: preferredName,
      email: profileData?.email || crewProfile?.email || user.email,
      phone: profileData?.phone || crewProfile?.phone || user.user_metadata?.phone || "",
      is_admin: user.app_metadata?.bluedeck_admin === true,
      profile_photo_url: crewProfile?.profile_photo_url || "",
      dashboard_photo_url: dashboardPhotoUrl,
    });
    setAccountCapabilities(capabilities);
    if (capabilities?.canUseCrewWorkspace === true) {
      await hydrateDeckAccess(
        crewProfile,
        profileData?.email || crewProfile?.email || user.email,
      );
    } else {
      setDeckInvites([]);
      setMyDecks([]);
    }
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

    try {
      const result = await persistDashboardPhoto({
        user,
        file,
        crewProfileId: profile?.crew_profile_id,
        email: profile?.email,
        fullName: profile?.full_name,
      });

      setProfile((current) => ({
        ...(current || {}),
        crew_profile_id: result.crewProfileId || current?.crew_profile_id,
        dashboard_photo_url: result.photoUrl,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.photoUpdateFailed;
      alert(
        message === "Bucket not found"
          ? copy.photoStorageUnavailable
          : message,
      );
    } finally {
      setPhotoUploading(false);
    }
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
    try {
      await clearDashboardPhoto({
        user,
        fullName: profile?.full_name,
      });
      setProfile((current) => ({ ...(current || {}), dashboard_photo_url: "" }));
    } catch (error) {
      alert(error instanceof Error ? error.message : copy.photoRemoveFailed);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function acceptDashboardInvite(invite: DashboardYachtInvite) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      window.location.href = "/login";
      return;
    }

    if (!invite.token) {
      alert(copy.inviteLinkIncomplete);
      return;
    }

    setAcceptingInviteId(invite.id);
    try {
      const response = await fetch(
        `/api/crew-invitations/${encodeURIComponent(invite.token)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );
      const payload: unknown = await response.json();
      const error =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>).error
          : null;

      if (!response.ok) {
        alert(
          typeof error === "string"
            ? error
            : copy.inviteAcceptFailed,
        );
        return;
      }

      await loadDashboard();
    } catch {
      alert(copy.inviteAcceptFailed);
    } finally {
      setAcceptingInviteId("");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(
    () =>
      subscribeDashboardPhotoUpdates((update) => {
        setProfile((current) => {
          if (!current || (current.id && current.id !== update.userId)) return current;

          return {
            ...current,
            crew_profile_id: update.crewProfileId || current.crew_profile_id,
            dashboard_photo_url: update.photoUrl,
            email: update.email || current.email,
            full_name: update.fullName || current.full_name,
            role: update.role || current.role,
          };
        });
      }),
    [],
  );

  if (loading) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="bd-app-page bd-ocean-shell min-h-screen p-10 text-slate-900"
      >
        <div className="bd-ocean-content">{t("dashboard.loading")}</div>
      </main>
    );
  }

  const normalizedRole = profile?.role?.trim().toLowerCase() || "crew";
  const canManageYachts =
    accountCapabilities?.canManageYachts ??
    ["captain", "owner", "management"].includes(normalizedRole);
  const canPostJobs = accountCapabilities?.canPostJobs === true;
  const canApplyToJobs =
    accountCapabilities?.canApplyToJobs ??
    ["crew", "captain"].includes(normalizedRole);
  const hasCrewWorkspace =
    accountCapabilities?.canUseCrewWorkspace === true;
  const roleLabel =
    normalizedRole === "captain"
      ? t("login.roleCaptain")
      : normalizedRole === "management"
        ? t("login.roleManagement")
          : normalizedRole === "owner"
            ? t("login.roleOwner")
            : t("login.roleCrew");
  const dashboardCardClass =
    "bd-focus bd-glass-card rounded-2xl p-6 transition-colors hover:border-cyan-300 [&>h2]:text-xl [&>h2]:tracking-[-0.02em] [&>p]:text-sm";
  const inviteSenderRole = deckInvites[0]?.sender_role?.trim().toLowerCase();
  const inviteSenderRoleLabel =
    inviteSenderRole === "owner"
      ? t("login.roleOwner")
      : inviteSenderRole === "management"
        ? t("login.roleManagement")
        : inviteSenderRole === "crew"
          ? t("login.roleCrew")
          : t("login.roleCaptain");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10"
    >
      <div className="bd-ocean-content mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bd-brand-rule h-0.5" />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5 sm:gap-8 sm:p-7">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">
                {t("dashboard.myDashboard")}
              </p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.025em] text-[#071f3c] sm:text-4xl">
                <span className="font-medium text-slate-500">{t("dashboard.welcome")}, </span>
                <span data-i18n-ignore>{profile?.full_name || profile?.email}</span>
              </h1>
              <div className="mt-3 inline-flex min-h-8 items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50/70 px-3 text-xs">
                <span className="font-semibold text-slate-500">{t("dashboard.role")}</span>
                <span data-i18n-ignore className="font-bold text-[#173f4a]">{roleLabel}</span>
              </div>
            </div>

            <DashboardPhotoControl
              url={profile?.dashboard_photo_url}
              photoAlt={`${profile?.full_name || t("topbar.accountFallback")} — ${t("dashboard.profilePhoto")}`}
              addLabel={`${t("topbar.addPhoto")} — ${t("dashboard.profilePhoto")}`}
              changeLabel={`${t("topbar.changePhoto")} — ${t("dashboard.profilePhoto")}`}
              removeLabel={`${t("topbar.removePhoto")} — ${t("dashboard.profilePhoto")}`}
              uploading={photoUploading}
              uploadingLabel={t("dashboard.updatingPhoto")}
              onChoose={() => fileInputRef.current?.click()}
              onRemove={() => void removeDashboardPhoto()}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              aria-label={
                profile?.dashboard_photo_url
                  ? `${t("topbar.changePhoto")} — ${t("dashboard.profilePhoto")}`
                  : `${t("topbar.addPhoto")} — ${t("dashboard.profilePhoto")}`
              }
              disabled={photoUploading}
              className="sr-only"
              tabIndex={-1}
              onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) await saveDashboardPhoto(file);
              }}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hasCrewWorkspace ? (
            <Link
              href="/profile"
              className={dashboardCardClass}
            >
              <UserRound className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {t("topbar.myProfile")}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                {copy.profileDescription}
              </p>
            </Link>
          ) : null}

          {hasCrewWorkspace ? (
            <Link
              href="/my-blue"
              className={dashboardCardClass}
            >
              <Camera className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {t("topbar.myBlue")}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                {copy.galleryDescription}
              </p>
            </Link>
          ) : null}

          {hasCrewWorkspace && deckInvites.length > 0 ? (
            <div className="bd-glass-card-strong rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-700 text-white shadow-lg shadow-cyan-950/15">
                  <UserPlus className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                  {copy.inviteBadge}
                </span>
              </div>
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {copy.inviteTitle}
              </h2>
              <div className="mt-4 rounded-2xl border border-cyan-100 bg-white/72 p-4">
                <p className="text-sm font-semibold leading-6 text-slate-600">
                  {language === "tr" ? (
                    <>
                      <span data-i18n-ignore className="font-black text-slate-950">
                        {deckInvites[0].yacht_name === "BlueDeck yacht"
                          ? copy.blueDeckYacht
                          : deckInvites[0].yacht_name}
                      </span>{" "}
                      tarafından{" "}
                      <span className="font-black text-cyan-800">
                        {deckInvites[0].position || copy.crewDuty}
                      </span>{" "}
                      görevi için davet edildiniz.
                    </>
                  ) : (
                    <>
                      {copy.invitedBy}{" "}
                      <span data-i18n-ignore className="font-black text-slate-950">
                        {deckInvites[0].yacht_name}
                      </span>{" "}
                      {copy.invitedFor}{" "}
                      <span className="font-black text-cyan-800">
                        {deckInvites[0].position || copy.crewDuty}
                      </span>
                      .
                    </>
                  )}
                </p>
                <div className="mt-3 space-y-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                  <p>
                    {copy.sent}:{" "}
                    {deckInvites[0].created_at
                      ? new Date(deckInvites[0].created_at).toLocaleDateString(
                          language === "tr" ? "tr-TR" : "en-GB",
                        )
                      : "-"}
                  </p>
                  <p>
                    {copy.from}:{" "}
                    <span data-i18n-ignore>
                      {inviteSenderRoleLabel} ·{" "}
                      {deckInvites[0].sender_name === "BlueDeck captain"
                        ? copy.blueDeckCaptain
                        : deckInvites[0].sender_name || copy.blueDeckCaptain}
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => acceptDashboardInvite(deckInvites[0])}
                disabled={acceptingInviteId === deckInvites[0].id}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-cyan-800 disabled:opacity-60"
              >
                <CheckCircle2 className="h-5 w-5" />
                {acceptingInviteId === deckInvites[0].id
                  ? copy.acceptingInvite
                  : copy.acceptInvite}
              </button>
            </div>
          ) : hasCrewWorkspace && myDecks.length > 0 ? (
            <Link
              href="/crew/tasks"
              className={dashboardCardClass}
            >
              <Ship className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {t("topbar.myDeck")}
              </h2>
              <p data-i18n-ignore className="mt-3 leading-7 text-slate-600">
                {myDecks[0].yacht_name === "BlueDeck yacht"
                  ? copy.blueDeckYacht
                  : myDecks[0].yacht_name}
                {myDecks[0].position ? ` · ${myDecks[0].position}` : ""}
              </p>
              {myDecks.length > 1 && (
                <p className="mt-3 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                  {copy.additionalDecks(myDecks.length - 1)}
                </p>
              )}
            </Link>
          ) : null}

          {canManageYachts ? (
            <Link
              href="/yachts"
              className={dashboardCardClass}
            >
              <Ship className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {t("topbar.captainWorkspace")}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                {copy.captainWorkspaceDescription}
              </p>
            </Link>
          ) : null}

          {canPostJobs ? (
            <Link
              href="/hiring"
              className={dashboardCardClass}
            >
              <BriefcaseBusiness className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {t("dashboard.hiring")}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                {t("dashboard.hiringText")}
              </p>
            </Link>
          ) : null}

          {canApplyToJobs ? (
            <Link
              href="/jobs"
              className={dashboardCardClass}
            >
              <BriefcaseBusiness className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {t("dashboard.findJob")}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                {t("dashboard.findJobText")}
              </p>
            </Link>
          ) : null}

          {canApplyToJobs ? (
            <Link
              href="/portal/applications"
              className={dashboardCardClass}
            >
              <ClipboardCheck className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {copy.applicationsTitle}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                {copy.applicationsDescription}
              </p>
            </Link>
          ) : null}

          {profile?.is_admin ? (
            <Link
              href="/admin/employer-access"
              className={dashboardCardClass}
            >
              <ShieldCheck className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {t("dashboard.employerApprovals")}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                {t("dashboard.employerApprovalsText")}
              </p>
            </Link>
          ) : null}

          {hasCrewWorkspace ? (
            <Link
              href="/contracts"
              className={dashboardCardClass}
            >
              <FileText className="h-8 w-8 text-cyan-700" />
              <h2 className="mt-5 text-3xl font-semibold text-slate-950">
                {t("topbar.contracts")}
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                {copy.contractsDescription}
              </p>
            </Link>
          ) : null}

        </div>
      </div>
    </main>
  );
}
