"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import type { AccountIdentity } from "../lib/accountIdentity";
import { type TranslationKey } from "../lib/i18n";
import { endWebBrowserSession } from "../lib/webBrowserSession";
import { BlueDeckLogoLink } from "./BlueDeckLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";
import styles from "./PublicSiteChrome.module.css";

const publicNavigation = [
  { labelKey: "nav.findJob", href: "/jobs", desktop: true },
  { labelKey: "nav.findCrew", href: "/find-crew", desktop: true },
  { labelKey: "nav.forYachts", href: "/yacht-os", desktop: true },
  { labelKey: "nav.about", href: "/about", desktop: true },
  { labelKey: "nav.trust", href: "/trust", desktop: false },
  { labelKey: "nav.contact", href: "/contact", desktop: true },
] satisfies Array<{
  labelKey: TranslationKey;
  href: string;
  desktop: boolean;
}>;

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function accountInitials(name: string) {
  return (
    name
      .split("@")[0]
      .trim()
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toLocaleUpperCase())
      .join("") || "BD"
  );
}

type PublicHeaderProps = {
  mobileVariant?: "default" | "cinematic";
};

export function PublicHeader({ mobileVariant = "default" }: PublicHeaderProps = {}) {
  const pathname = usePathname() || "/";
  const { language, t } = useLanguage();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [identity, setIdentity] = useState<AccountIdentity | null>(null);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState("");
  const [phoneViewport, setPhoneViewport] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuId = useId();
  const accountId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const sessionEmail = sessionUser?.email || "";
  const currentIdentity = identity?.userId === sessionUser?.id ? identity : null;
  const metadataName = sessionUser?.user_metadata?.full_name;
  const displayName =
    currentIdentity?.fullName ||
    (typeof metadataName === "string" ? metadataName.trim() : "") ||
    sessionEmail.split("@")[0] ||
    t("topbar.account");
  const photoUrl = currentIdentity?.dashboardPhotoUrl || "";

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function watchSession() {
      const { supabase } = await import("../lib/supabase");
      if (!active) return;

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setSessionUser(session?.user || null);
      });
      unsubscribe = () => subscription.unsubscribe();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active) setSessionUser(session?.user || null);
    }

    void watchSession();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (mobileVariant !== "cinematic" || !phoneViewport || !sessionUser) {
      setIdentity(null);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function refreshIdentity() {
      const { loadAccountIdentity, subscribeDashboardPhotoUpdates } =
        await import("../lib/accountIdentity");
      if (!active) return;

      unsubscribe = subscribeDashboardPhotoUpdates((update) => {
        if (!active || update.userId !== sessionUser?.id) return;
        setIdentity((current) =>
          current?.userId === update.userId
            ? {
                ...current,
                dashboardPhotoUrl: update.photoUrl,
                fullName: update.fullName || current.fullName,
                email: update.email || current.email,
              }
            : current,
        );
      });

      try {
        const nextIdentity = await loadAccountIdentity();
        if (active && nextIdentity?.userId === sessionUser?.id) {
          setIdentity(nextIdentity);
        }
      } catch {
        // Session initials remain usable when the optional profile cannot load.
      }
    }

    void refreshIdentity();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [mobileVariant, phoneViewport, sessionUser]);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [sessionUser?.id]);

  useEffect(() => {
    const phoneBreakpoint = window.matchMedia("(max-width: 640px)");
    setPhoneViewport(phoneBreakpoint.matches);
    const breakpoints = [
      phoneBreakpoint,
      window.matchMedia("(max-width: 1040px)"),
    ];
    function closeMenus() {
      setPhoneViewport(phoneBreakpoint.matches);
      setMenuOpen(false);
      setAccountOpen(false);
    }
    breakpoints.forEach((breakpoint) =>
      breakpoint.addEventListener("change", closeMenus),
    );
    return () => breakpoints.forEach((breakpoint) =>
      breakpoint.removeEventListener("change", closeMenus),
    );
  }, [mobileVariant]);

  useEffect(() => {
    if (!menuOpen && !accountOpen) return;

    const panelRef = accountOpen ? accountPanelRef : menuPanelRef;
    const buttonRef = accountOpen ? accountButtonRef : menuButtonRef;
    function closePanel() {
      if (accountOpen) setAccountOpen(false);
      else setMenuOpen(false);
    }

    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    });

    function onOutsideInteraction(event: PointerEvent | FocusEvent) {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        closePanel();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (panelRef.current?.querySelector('[role="menu"]')) return;
      event.preventDefault();
      closePanel();
      window.setTimeout(() => buttonRef.current?.focus(), 0);
    }

    document.addEventListener("pointerdown", onOutsideInteraction);
    document.addEventListener("focusin", onOutsideInteraction);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onOutsideInteraction);
      document.removeEventListener("focusin", onOutsideInteraction);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, accountOpen]);

  async function logout() {
    setMenuOpen(false);
    setAccountOpen(false);
    const ended = await endWebBrowserSession("manual");
    if (ended) window.location.replace("/login");
    else window.location.reload();
  }

  const menuButton = (
    <button
      ref={menuButtonRef}
      type="button"
      aria-label={
        menuOpen
          ? language === "tr"
            ? "Menüyü kapat"
            : "Close menu"
          : language === "tr"
            ? "Menüyü aç"
            : "Open menu"
      }
      aria-expanded={menuOpen}
      aria-controls={menuOpen ? menuId : undefined}
      onClick={() => {
        setAccountOpen(false);
        setMenuOpen((current) => !current);
      }}
      className="bd-focus bd-public-menu-button"
    >
      {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
    </button>
  );

  return (
    <header className="bd-public-header" data-mobile-variant={mobileVariant}>
      <a className="bd-skip-link" href="#main-content">
        {language === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>

      <div className="bd-public-header-inner">
        <div className="bd-public-brand-group">
          {menuButton}

          <BlueDeckLogoLink
            href="/"
            priority
            className="bd-public-brand"
            imageClassName="object-contain object-left p-0"
          />
          {mobileVariant === "cinematic" ? (
            <div className="bd-public-mobile-account">
              {sessionUser ? (
                <>
                  <button
                    ref={accountButtonRef}
                    type="button"
                    aria-label={language === "tr" ? "Hesap menüsü" : "Account menu"}
                    aria-expanded={accountOpen}
                    aria-controls={accountOpen ? accountId : undefined}
                    onClick={() => {
                      setMenuOpen(false);
                      setAccountOpen((current) => !current);
                    }}
                    className="bd-focus bd-public-account-trigger"
                  >
                    {photoUrl && failedPhotoUrl !== photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt=""
                        width={44}
                        height={44}
                        unoptimized
                        onError={() => setFailedPhotoUrl(photoUrl)}
                        className="bd-public-account-avatar"
                      />
                    ) : (
                      <span
                        aria-hidden
                        data-i18n-ignore
                        className="bd-public-account-avatar"
                      >
                        {accountInitials(displayName)}
                      </span>
                    )}
                  </button>
                  {accountOpen ? (
                    <div
                      ref={accountPanelRef}
                      id={accountId}
                      className="bd-public-account-panel"
                    >
                      <div data-i18n-ignore className="bd-public-account-identity">
                        <strong>{displayName}</strong>
                        <span>{sessionEmail}</span>
                      </div>
                      <nav aria-label={language === "tr" ? "Hesap" : "Account"}>
                        <Link
                          href="/dashboard"
                          onClick={() => setAccountOpen(false)}
                          className="bd-focus bd-public-account-link"
                        >
                          <LayoutDashboard aria-hidden />
                          <span>{t("topbar.dashboard")}</span>
                        </Link>
                        <Link
                          href="/settings"
                          onClick={() => setAccountOpen(false)}
                          className="bd-focus bd-public-account-link"
                        >
                          <Settings aria-hidden />
                          <span>{t("topbar.settings")}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => void logout()}
                          className="bd-focus bd-public-account-link"
                        >
                          <LogOut aria-hidden />
                          <span>{t("topbar.logout")}</span>
                        </button>
                      </nav>
                    </div>
                  ) : null}
                </>
              ) : (
                <Link href="/login" className="bd-focus bd-public-mobile-login">
                  {language === "tr" ? "Giriş yap" : "Log in"}
                </Link>
              )}
            </div>
          ) : null}
        </div>

        <nav
          className="bd-public-navigation"
          aria-label={language === "tr" ? "Ana gezinme" : "Primary navigation"}
        >
          {publicNavigation
            .filter((item) => item.desktop)
            .map((item) => {
              const active = isCurrentRoute(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="bd-focus bd-public-nav-link"
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
        </nav>

        <div className="bd-public-actions">
          {sessionEmail ? (
            <>
              <Link
                href="/dashboard"
                className="bd-focus bd-public-action bd-public-action-solid"
                title={sessionEmail}
              >
                <LayoutDashboard aria-hidden />
                <span>{t("topbar.dashboard")}</span>
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="bd-focus bd-public-action bd-public-action-outline bd-public-session-action"
                aria-label={t("topbar.logout")}
              >
                <LogOut aria-hidden />
                <span>{t("topbar.logout")}</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="bd-focus bd-public-action bd-public-action-quiet bd-public-auth-action"
              >
                {t("auth.login")}
              </Link>
              <Link
                href="/login?mode=signup"
                className="bd-focus bd-public-action bd-public-action-primary bd-public-auth-action"
              >
                {t("auth.signUp")}
              </Link>
            </>
          )}
          <LanguageSwitcher size="compact" className="bd-public-language" />
        </div>

        {menuOpen ? (
          <div
            ref={menuPanelRef}
            id={menuId}
            className="bd-public-mobile-panel"
          >
            <nav aria-label={language === "tr" ? "Mobil ana gezinme" : "Mobile primary navigation"}>
              {publicNavigation.map((item) => {
                const active = isCurrentRoute(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className="bd-focus bd-public-mobile-link"
                  >
                    {t(item.labelKey)}
                  </Link>
                );
              })}
              {!sessionEmail ? (
                <div
                  className="bd-public-mobile-auth"
                  role="group"
                  aria-label={language === "tr" ? "Hesap" : "Account"}
                >
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="bd-focus bd-public-mobile-link bd-public-mobile-auth-link"
                  >
                    {t("auth.login")}
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    onClick={() => setMenuOpen(false)}
                    className="bd-focus bd-public-mobile-link bd-public-mobile-auth-link bd-public-mobile-auth-primary"
                  >
                    {t("auth.signUp")}
                  </Link>
                </div>
              ) : null}
            </nav>
            {mobileVariant === "cinematic" ? (
              <div className="bd-public-mobile-utilities">
                <div className="bd-public-mobile-language-row">
                  <span>{language === "tr" ? "Dil" : "Language"}</span>
                  <LanguageSwitcher
                    size="compact"
                    className="bd-public-mobile-language"
                  />
                </div>
                {sessionEmail ? (
                  <div
                    className="bd-public-mobile-auth"
                    role="group"
                    aria-label={language === "tr" ? "Hesap" : "Account"}
                  >
                    <Link
                      href="/dashboard"
                      title={sessionEmail}
                      onClick={() => setMenuOpen(false)}
                      className="bd-focus bd-public-mobile-link bd-public-mobile-auth-link"
                    >
                      {t("topbar.dashboard")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void logout()}
                      className="bd-focus bd-public-mobile-link bd-public-mobile-auth-link"
                    >
                      {t("topbar.logout")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function PublicFooter() {
  const { language, t } = useLanguage();

  return (
    <footer className="bd-public-footer">
      <div className={`bd-public-footer-grid ${styles.footerGrid}`}>
        <div className="bd-public-footer-brand">
          <BlueDeckLogoLink
            href="/"
            className="h-12 w-48"
            imageClassName="object-contain object-left p-0"
          />
          <p>{t("footer.description")}</p>
        </div>

        <FooterColumn
          title={t("footer.platform")}
          links={[
            [t("nav.forYachts"), "/yacht-os"],
            [t("nav.findJob"), "/jobs"],
            [t("nav.findCrew"), "/find-crew"],
          ]}
        />
        <FooterColumn
          title={t("footer.company")}
          links={[
            [t("nav.about"), "/about"],
            [t("nav.trust"), "/trust"],
            [t("nav.contact"), "/contact"],
          ]}
        />
        <div className="bd-public-footer-contact">
          <p className="bd-public-footer-title">{t("footer.contact")}</p>
          <a href="mailto:info@bluedeck.app">
            <Mail aria-hidden />
            info@bluedeck.app
          </a>
          <p>
            <MapPin aria-hidden />
            {t("footer.operations")}
          </p>
          <p>
            <ShieldCheck aria-hidden />
            {t("footer.secureAccess")}
          </p>
        </div>
      </div>

      <div className="bd-public-footer-bottom">
        <div>
          <p>
            © {new Date().getFullYear()} BlueDeck. {t("footer.rights")}
          </p>
          <nav aria-label={language === "tr" ? "Yasal bağlantılar" : "Legal links"}>
            <Link href="/privacy">{t("footer.privacy")}</Link>
            <Link href="/terms">{t("footer.terms")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<[string, string]>;
}) {
  return (
    <div>
      <p className="bd-public-footer-title">{title}</p>
      <nav className="bd-public-footer-links" aria-label={title}>
        {links.map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PublicPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bd-site-shell min-h-screen text-[#07182d]">
      <PublicHeader />
      <main id="main-content">
        <section className="bd-public-page-intro">
          <div className="bd-public-container bd-public-page-intro-inner">
            <p className="bd-kicker">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{intro}</p>
          </div>
        </section>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
