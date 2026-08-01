"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { type TranslationKey } from "../lib/i18n";
import { clearLegacySensitiveClientStorage } from "../lib/clientStorageSecurity";
import { BlueDeckLogoLink } from "./BlueDeckLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

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

export function PublicHeader() {
  const pathname = usePathname() || "/";
  const { language, t } = useLanguage();
  const [sessionEmail, setSessionEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function watchSession() {
      const { supabase } = await import("../lib/supabase");
      if (!active) return;

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setSessionEmail(session?.user?.email || "");
      });
      unsubscribe = () => subscription.unsubscribe();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (active) setSessionEmail(session?.user?.email || "");
    }

    void watchSession();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const frame = window.requestAnimationFrame(() => {
      menuPanelRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    });

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menuPanelRef.current?.contains(target) &&
        !menuButtonRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      window.setTimeout(() => menuButtonRef.current?.focus(), 0);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function logout() {
    clearLegacySensitiveClientStorage();
    const { supabase } = await import("../lib/supabase");
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <header className="bd-public-header">
      <a className="bd-skip-link" href="#main-content">
        {language === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>

      <div className="bd-public-header-inner">
        <div className="bd-public-brand-group">
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
            aria-controls={menuId}
            onClick={() => setMenuOpen((current) => !current)}
            className="bd-focus bd-public-menu-button"
          >
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>

          <BlueDeckLogoLink
            href="/"
            priority
            className="bd-public-brand"
            imageClassName="object-contain object-left p-0"
          />
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
      <div className="bd-public-footer-grid">
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
