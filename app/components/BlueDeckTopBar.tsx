"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  ChevronRight,
  FileText,
  Languages,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Settings,
  Ship,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  dashboardPhotoFromMetadata,
  loadAccountIdentity,
  removeDashboardPhoto,
  saveDashboardPhoto,
  subscribeDashboardPhotoUpdates,
  type AccountIdentity,
} from "../lib/accountIdentity";
import { languages } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { BlueDeckLogoLink } from "./BlueDeckLogo";
import { useLanguage } from "./LanguageProvider";

type BlueDeckTopBarProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

type PhotoNotice = {
  tone: "success" | "error";
  message: string;
};

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part.charAt(0).toLocaleUpperCase()).join("") || "BD";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Bucket not found") {
      return "Photo storage is not ready yet. Please try again later.";
    }
    return error.message;
  }

  return "Your photo could not be updated. Please try again.";
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BlueDeckTopBar({
  title = "BlueDeck",
  subtitle = "YACHT-OS",
  className = "",
}: BlueDeckTopBarProps) {
  const pathname = usePathname() || "/dashboard";
  const { language, setLanguage, t } = useLanguage();
  const [identity, setIdentity] = useState<AccountIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<PhotoNotice | null>(null);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState("");
  const menuId = useId();
  const menuHeadingId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const accountAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function refreshIdentity() {
      try {
        const nextIdentity = await loadAccountIdentity();
        if (active) setIdentity(nextIdentity);
      } catch {
        if (active) setIdentity(null);
      } finally {
        if (active) setIdentityLoading(false);
      }
    }

    void refreshIdentity();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (active) setIdentity(null);
        return;
      }

      if (event === "USER_UPDATED" && session?.user) {
        const metadata = session.user.user_metadata as Record<string, unknown> | undefined;

        setIdentity((current) => {
          if (!current || current.userId !== session.user.id) return current;

          const nextName =
            typeof metadata?.full_name === "string" && metadata.full_name.trim()
              ? metadata.full_name.trim()
              : current.fullName;
          return {
            ...current,
            fullName: nextName,
            dashboardPhotoUrl: dashboardPhotoFromMetadata(
              metadata,
              current.profilePhotoUrl,
            ),
          };
        });
        return;
      }

      if (event === "SIGNED_IN") {
        window.setTimeout(() => void refreshIdentity(), 0);
      }
    });

    const unsubscribePhotoUpdates = subscribeDashboardPhotoUpdates((update) => {
      if (!active) return;

      setIdentity((current) => {
        if (!current || current.userId !== update.userId) return current;

        return {
          ...current,
          crewProfileId: update.crewProfileId || current.crewProfileId,
          dashboardPhotoUrl: update.photoUrl,
          email: update.email || current.email,
          fullName: update.fullName || current.fullName,
          role: update.role || current.role,
        };
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      unsubscribePhotoUpdates();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setPhotoNotice(null);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!accountAreaRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const displayName = identity?.fullName || identity?.email || t("topbar.accountFallback");
  const photoUrl = identity?.dashboardPhotoUrl || "";
  const showPhoto = Boolean(photoUrl && failedPhotoUrl !== photoUrl);
  const normalizedRole = identity?.role?.trim().toLowerCase() || "crew";
  const isCaptain = normalizedRole === "captain" || normalizedRole === "management";
  const roleLabel =
    normalizedRole === "captain"
      ? t("login.roleCaptain")
      : normalizedRole === "management"
        ? t("login.roleManagement")
        : normalizedRole === "owner"
          ? t("login.roleOwner")
          : t("login.roleCrew");
  const photoActionLabel = photoUrl ? t("topbar.changePhoto") : t("topbar.addPhoto");

  const navigationItems = [
    { href: "/dashboard", label: t("topbar.dashboard"), icon: LayoutDashboard },
    { href: "/profile", label: t("topbar.myProfile"), icon: UserRound },
    { href: "/my-blue", label: t("topbar.myBlue"), icon: Camera },
    { href: "/crew/tasks", label: t("topbar.myDeck"), icon: Ship },
    ...(isCaptain
      ? [{ href: "/yachts", label: t("topbar.captainWorkspace"), icon: Ship }]
      : []),
    { href: "/contracts", label: t("topbar.contracts"), icon: FileText },
    { href: "/settings", label: t("topbar.settings"), icon: Settings },
  ];

  function choosePhoto() {
    if (!photoBusy && identity) fileInputRef.current?.click();
  }

  async function handlePhotoFile(file: File) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setPhotoBusy(true);
    setPhotoNotice(null);

    try {
      const result = await saveDashboardPhoto({
        user,
        file,
        crewProfileId: identity?.crewProfileId,
        email: identity?.email,
        fullName: identity?.fullName,
      });

      setIdentity((current) =>
        current
          ? {
              ...current,
              crewProfileId: result.crewProfileId || current.crewProfileId,
              dashboardPhotoUrl: result.photoUrl,
            }
          : current,
      );
      setPhotoNotice({ tone: "success", message: t("topbar.photoUpdated") });
    } catch (error) {
      setPhotoNotice({ tone: "error", message: getErrorMessage(error) });
      setMenuOpen(true);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handlePhotoRemove() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setPhotoBusy(true);
    setPhotoNotice(null);

    try {
      await removeDashboardPhoto({ user, fullName: identity?.fullName });
      setIdentity((current) =>
        current ? { ...current, dashboardPhotoUrl: "" } : current,
      );
      setPhotoNotice({ tone: "success", message: t("topbar.photoUpdated") });
    } catch (error) {
      setPhotoNotice({ tone: "error", message: getErrorMessage(error) });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header
      className={`bd-app-topbar bd-account-topbar border-b border-white/10 shadow-2xl shadow-slate-950/22 ${className}`}
    >
      <div className="bd-app-topbar-inner mx-auto flex h-[88px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <div className="bd-topbar-logo-area flex min-w-0 items-center gap-4">
          <BlueDeckLogoLink
            href="/dashboard"
            label="BlueDeck Dashboard"
            className="bd-topbar-logo h-12 w-48 shrink-0 sm:w-60"
            imageClassName="object-contain p-0"
          />

          <div className="hidden min-w-0 border-l border-white/10 pl-4 md:block">
            <p className="truncate text-sm font-black tracking-[0.05em] text-cyan-200">
              {title}
            </p>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
              {subtitle}
            </p>
          </div>
        </div>

        <div
          ref={accountAreaRef}
          className="bd-topbar-account-area relative flex min-w-0 shrink-0 items-center gap-2 sm:gap-3"
        >
          <div className="bd-topbar-user-copy min-w-0 text-right">
            <p
              data-i18n-ignore
              className="truncate text-sm font-extrabold tracking-[-0.01em] text-white"
              title={displayName}
            >
              {identityLoading ? "BlueDeck" : displayName}
            </p>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100/58">
              {t("topbar.account")}
            </p>
          </div>

          <button
            type="button"
            onClick={choosePhoto}
            disabled={photoBusy || !identity}
            aria-label={photoActionLabel}
            title={photoActionLabel}
            className="bd-focus bd-topbar-avatar-button group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-visible rounded-full border border-white/18 bg-white/9 text-white shadow-lg shadow-slate-950/22 transition hover:border-cyan-200 hover:bg-white/14 disabled:cursor-wait disabled:opacity-70"
          >
            <span className="absolute inset-[3px] overflow-hidden rounded-full bg-[#0b2746]">
              {showPhoto ? (
                <img
                  src={photoUrl}
                  alt=""
                  onError={() => setFailedPhotoUrl(photoUrl)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  data-i18n-ignore
                  className="flex h-full w-full items-center justify-center text-xs font-black tracking-[0.08em] text-cyan-50"
                >
                  {getInitials(displayName)}
                </span>
              )}
              {photoBusy ? (
                <span className="absolute inset-0 flex items-center justify-center bg-[#06172b]/78">
                  <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                </span>
              ) : null}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#071631] bg-cyan-300 text-[#071631] shadow-md transition group-hover:bg-white">
              <Camera className="h-2.5 w-2.5" aria-hidden />
            </span>
          </button>

          <button
            ref={menuButtonRef}
            type="button"
            aria-label={menuOpen ? t("topbar.closeMenu") : t("topbar.openMenu")}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => {
              setMenuOpen((current) => !current);
              setPhotoNotice(null);
            }}
            className="bd-focus bd-topbar-menu-button relative z-[90] inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/16 bg-white/7 text-white shadow-lg shadow-slate-950/16 transition hover:border-cyan-200 hover:bg-white/13"
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            aria-label={photoActionLabel}
            disabled={photoBusy}
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void handlePhotoFile(file);
            }}
          />

          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {photoBusy ? t("topbar.updatingPhoto") : photoNotice?.message || ""}
          </span>

          {menuOpen ? (
            <section
              id={menuId}
              aria-labelledby={menuHeadingId}
              className="bd-account-menu-panel absolute right-0 top-[calc(100%+0.8rem)] z-[80] w-[min(25rem,calc(100vw-1.25rem))] overflow-hidden rounded-[26px] border border-slate-200/90 bg-white text-[#071f3c] shadow-[0_30px_90px_rgba(2,8,23,0.34)]"
            >
                <div className="bd-brand-rule h-0.5" />
                <div className="bd-account-menu-scroll max-h-[calc(100dvh-var(--topbar-height)-var(--safe-area-top)-1.5rem)] overflow-y-auto overscroll-contain p-3 sm:p-4">
                  <div className="rounded-[22px] border border-slate-200/80 bg-[#f3f7fb] p-3.5">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={choosePhoto}
                        disabled={photoBusy || !identity}
                        aria-label={photoActionLabel}
                        className="bd-focus relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-950/10 bg-white text-[#0a5465] shadow-sm disabled:cursor-wait disabled:opacity-65"
                      >
                        {showPhoto ? (
                          <img
                            src={photoUrl}
                            alt=""
                            onError={() => setFailedPhotoUrl(photoUrl)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span data-i18n-ignore className="text-sm font-black tracking-[0.08em]">
                            {getInitials(displayName)}
                          </span>
                        )}
                        {photoBusy ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-white/82 text-cyan-800">
                            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                          </span>
                        ) : null}
                      </button>

                      <div className="min-w-0 flex-1">
                        <h2
                          id={menuHeadingId}
                          data-i18n-ignore
                          className="truncate text-base font-black tracking-[-0.015em] text-[#071f3c]"
                        >
                          {displayName}
                        </h2>
                        <p data-i18n-ignore className="mt-0.5 truncate text-xs font-medium text-slate-600">
                          {identity?.email || roleLabel}
                        </p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.13em] text-cyan-700">
                          {roleLabel}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={choosePhoto}
                        disabled={photoBusy || !identity}
                        className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-900/10 bg-white px-3 text-xs font-black text-[#0b5263] transition hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Camera className="h-3.5 w-3.5" aria-hidden />
                        <span>{photoActionLabel}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePhotoRemove()}
                        disabled={photoBusy || !photoUrl}
                        className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200/80 bg-white px-3 text-xs font-black text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span>{t("topbar.removePhoto")}</span>
                      </button>
                    </div>

                    <div
                      className={`overflow-hidden text-xs font-semibold transition-all ${
                        photoNotice ? "mt-2.5 max-h-20" : "max-h-0"
                      } ${photoNotice?.tone === "error" ? "text-rose-600" : "text-emerald-700"}`}
                    >
                      {photoNotice?.message || ""}
                    </div>
                  </div>

                  <div className="px-1 pb-1 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-700">
                      {t("topbar.allAreas")}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {t("topbar.menuSubtitle")}
                    </p>
                  </div>

                  <nav aria-label={t("topbar.navigation")} className="mt-2 grid gap-1">
                    {navigationItems.map((item) => {
                      const Icon = item.icon;
                      const active = isRouteActive(pathname, item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMenuOpen(false)}
                          className={`bd-focus bd-account-menu-link group flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-extrabold transition ${
                            active
                              ? "bg-[#082643] text-white shadow-md shadow-cyan-950/12"
                              : "text-[#173b58] hover:bg-cyan-50 hover:text-[#071f3c]"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition ${
                              active
                                ? "border-cyan-200/18 bg-white/10 text-cyan-200"
                                : "border-cyan-900/8 bg-[#eef5f9] text-cyan-700 group-hover:bg-white"
                            }`}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 ${active ? "text-cyan-200/75" : "text-slate-400"}`}
                            aria-hidden
                          />
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="mt-3 rounded-2xl border border-slate-200/85 bg-[#f8fafc] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2 text-sm font-black text-[#173b58]">
                        <Languages className="h-4 w-4 shrink-0 text-cyan-700" aria-hidden />
                        <span>{t("topbar.language")}</span>
                      </div>
                      <div data-i18n-ignore role="group" aria-label={t("topbar.language")} className="flex gap-1">
                        {languages.map((item) => (
                          <button
                            key={item.code}
                            type="button"
                            aria-pressed={language === item.code}
                            aria-label={item.name}
                            onClick={() => setLanguage(item.code)}
                            className={`bd-focus inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-black transition ${
                              language === item.code
                                ? "bg-[#082643] text-white shadow-sm"
                                : "text-slate-600 hover:bg-white hover:text-[#071f3c]"
                            }`}
                          >
                            <span aria-hidden>{item.flag}</span>
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="bd-focus mt-2 flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm font-black text-rose-600 transition hover:bg-rose-50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-100 bg-rose-50">
                      <LogOut className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="flex-1 text-left">{t("topbar.logout")}</span>
                  </button>
                </div>
            </section>
          ) : null}
        </div>
      </div>
    </header>
  );
}
