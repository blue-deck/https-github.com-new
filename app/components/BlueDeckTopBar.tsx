"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Camera,
  ClipboardCheck,
  FileText,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Ship,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  dashboardPhotoFromMetadata,
  loadAccountIdentity,
  subscribeDashboardPhotoUpdates,
  type AccountIdentity,
} from "../lib/accountIdentity";
import { languages } from "../lib/i18n";
import { canUseCrewWorkspace } from "../lib/marketplaceCapabilities";
import { supabase } from "../lib/supabase";
import { BlueDeckLogoLink } from "./BlueDeckLogo";
import { useLanguage } from "./LanguageProvider";

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part.charAt(0).toLocaleUpperCase()).join("") || "BD";
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ensureMainContentTarget() {
  const existingTarget = document.getElementById("main-content");
  const target =
    existingTarget instanceof HTMLElement
      ? existingTarget
      : document.querySelector<HTMLElement>("main");

  if (!target) return null;
  if (!target.id) target.id = "main-content";
  if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
  return target;
}

export function BlueDeckTopBar() {
  const pathname = usePathname() || "/dashboard";
  const { language, setLanguage, t } = useLanguage();
  const [identity, setIdentity] = useState<AccountIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState("");
  const menuId = useId();
  const menuHeadingId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
  }, [pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      ensureMainContentTarget();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        window.setTimeout(() => menuButtonRef.current?.focus(), 0);
        return;
      }

      if (event.key !== "Tab" || !menuPanelRef.current) return;

      const focusableElements = Array.from(
        menuPanelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || !menuPanelRef.current.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const displayName = identity?.fullName || identity?.email || t("topbar.accountFallback");
  const photoUrl = identity?.dashboardPhotoUrl || "";
  const showPhoto = Boolean(photoUrl && failedPhotoUrl !== photoUrl);
  const normalizedRole = identity?.role?.trim().toLowerCase() || "crew";
  const hasCrewWorkspace = Boolean(
    identity && canUseCrewWorkspace(normalizedRole),
  );
  const canManageYachts = ["captain", "owner", "management"].includes(
    normalizedRole,
  );
  const canApplyToJobs = ["crew", "captain"].includes(normalizedRole);
  const roleLabel =
    normalizedRole === "captain"
      ? t("login.roleCaptain")
      : normalizedRole === "management"
        ? t("login.roleManagement")
        : normalizedRole === "owner"
          ? t("login.roleOwner")
          : normalizedRole === "crew"
            ? t("login.roleCrew")
            : identity?.role?.trim() || t("login.roleCrew");
  const navigationItems = [
    { href: "/dashboard", label: t("topbar.dashboard"), icon: LayoutDashboard },
    ...(hasCrewWorkspace
      ? [
          { href: "/profile", label: t("topbar.myProfile"), icon: UserRound },
          { href: "/my-blue", label: t("topbar.myBlue"), icon: Camera },
          { href: "/crew/tasks", label: t("topbar.myDeck"), icon: Ship },
        ]
      : []),
    ...(canApplyToJobs
      ? [{ href: "/jobs", label: t("nav.findJob"), icon: BriefcaseBusiness }]
      : []),
    ...(canApplyToJobs
      ? [
          {
            href: "/portal/applications",
            label: language === "tr" ? "Başvurularım" : "My Applications",
            icon: ClipboardCheck,
          },
        ]
      : []),
    ...(canManageYachts
      ? [{ href: "/hiring", label: t("topbar.hiring"), icon: BriefcaseBusiness }]
      : []),
    ...(canManageYachts
      ? [{ href: "/find-crew", label: t("nav.findCrew"), icon: UsersRound }]
      : []),
    ...(canManageYachts
      ? [{ href: "/yachts", label: t("topbar.captainWorkspace"), icon: Ship }]
      : []),
    ...(identity?.isAdmin
      ? [
          {
            href: "/admin/employer-access",
            label: t("topbar.employerApprovals"),
            icon: ShieldCheck,
          },
        ]
      : []),
    ...(hasCrewWorkspace
      ? [{ href: "/contracts", label: t("topbar.contracts"), icon: FileText }]
      : []),
    { href: "/settings", label: t("topbar.settings"), icon: Settings },
  ];

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header
      className="bd-app-topbar bd-account-topbar border-b border-white/10 shadow-2xl shadow-slate-950/22"
    >
      <a
        className="bd-skip-link"
        href="#main-content"
        onClick={(event) => {
          const target = ensureMainContentTarget();
          if (!target) return;

          event.preventDefault();
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "start" });
        }}
      >
        {language === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>
      <div className="bd-app-topbar-inner mx-auto flex h-[88px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <div className="bd-topbar-logo-area flex min-w-0 items-center gap-4">
          <BlueDeckLogoLink
            href="/"
            label="BlueDeck home"
            className="bd-topbar-logo h-12 w-48 shrink-0 sm:w-60"
            imageClassName="object-contain p-0"
          />

        </div>

        <div className="bd-topbar-account-area relative flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <div className="bd-topbar-user-copy min-w-0 text-right">
            <p
              data-i18n-ignore
              className="truncate text-sm font-extrabold tracking-[-0.01em] text-white"
              title={displayName}
            >
              {identityLoading ? "BlueDeck" : displayName}
            </p>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100/70">
              {identityLoading || !identity ? t("topbar.account") : roleLabel}
            </p>
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            aria-label={menuOpen ? t("topbar.closeMenu") : t("topbar.openMenu")}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((current) => !current)}
            className={`bd-focus bd-topbar-menu-button relative z-[60] inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/16 bg-white/7 text-white shadow-lg shadow-slate-950/16 transition hover:border-cyan-200 hover:bg-white/13 ${
              menuOpen ? "invisible pointer-events-none" : ""
            }`}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>

          {menuOpen ? (
            <>
              <div
                aria-hidden="true"
                className="bd-account-menu-backdrop fixed inset-0 z-[70] bg-[#020817]/48 backdrop-blur-[2px]"
                onPointerDown={() => {
                  setMenuOpen(false);
                  window.setTimeout(() => menuButtonRef.current?.focus(), 0);
                }}
              />

              <aside
                ref={menuPanelRef}
                id={menuId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={menuHeadingId}
                className="bd-account-menu-panel fixed inset-y-0 right-0 z-[80] flex w-[min(23rem,100vw)] flex-col overflow-hidden border-l border-slate-200 bg-[#f8fafc] text-[#071f3c] shadow-[-24px_0_70px_rgba(2,8,23,0.24)]"
              >
                <div className="bd-brand-rule h-1 shrink-0" />

                <div className="bd-account-drawer-header shrink-0 border-b border-slate-200 bg-white px-5 pb-5 pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">
                      {t("topbar.account")}
                    </p>
                    <button
                      ref={closeButtonRef}
                      type="button"
                      aria-label={t("topbar.closeMenu")}
                      onClick={() => {
                        setMenuOpen(false);
                        window.setTimeout(() => menuButtonRef.current?.focus(), 0);
                      }}
                      className="bd-focus inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:text-[#071f3c]"
                    >
                      <X className="h-5 w-5" aria-hidden />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-3.5">
                    <div
                      aria-hidden="true"
                      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-[#eef5f9] text-[#0a5465]"
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
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2
                        id={menuHeadingId}
                        data-i18n-ignore
                        className="truncate text-base font-black tracking-[-0.015em] text-[#071f3c]"
                      >
                        {displayName}
                      </h2>
                      <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">
                        {identityLoading || !identity ? t("topbar.account") : roleLabel}
                      </p>
                      <p data-i18n-ignore className="mt-1 truncate text-xs font-medium text-slate-500">
                        {identity?.email || ""}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bd-account-menu-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
                  <div className="px-2 pb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">
                      {t("topbar.allAreas")}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {t("topbar.menuSubtitle")}
                    </p>
                  </div>

                  <nav aria-label={t("topbar.navigation")} className="grid gap-1">
                    {navigationItems.map((item) => {
                      const Icon = item.icon;
                      const active = isRouteActive(pathname, item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMenuOpen(false)}
                          className={`bd-focus bd-account-menu-link flex min-h-12 items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-extrabold transition ${
                            active
                              ? "border-cyan-500 bg-cyan-50 text-[#071f3c]"
                              : "border-transparent text-[#26455f] hover:border-cyan-200 hover:bg-white hover:text-[#071f3c]"
                          }`}
                        >
                          <Icon
                            className={`h-[18px] w-[18px] shrink-0 ${active ? "text-cyan-700" : "text-slate-500"}`}
                            aria-hidden
                          />
                          <span data-i18n-ignore className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                <div className="bd-account-drawer-footer shrink-0 border-t border-slate-200 bg-white px-4 pb-4 pt-3">
                  <div className="flex min-h-12 items-center justify-between gap-3 px-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-[#26455f]">
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
                          className={`bd-focus inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-black transition ${
                            language === item.code
                              ? "bg-[#082643] text-white"
                              : "text-slate-600 hover:bg-slate-100 hover:text-[#071f3c]"
                          }`}
                        >
                          <span aria-hidden>{item.flag}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="bd-focus mt-1 flex min-h-12 w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-black text-rose-600 transition hover:border-rose-100 hover:bg-rose-50"
                  >
                    <LogOut className="h-[18px] w-[18px]" aria-hidden />
                    <span className="flex-1 text-left">{t("topbar.logout")}</span>
                  </button>
                </div>
              </aside>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
