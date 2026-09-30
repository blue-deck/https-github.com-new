"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Mail, MapPin, Menu, ShieldCheck, X } from "lucide-react";
import { languages, type TranslationKey } from "../lib/i18n";
import { BlueDeckLogoLink } from "./BlueDeckLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";
import styles from "./PublicSiteChrome.module.css";

const AccountMenu = dynamic(
  () => import("./AccountMenu").then((module) => module.AccountMenu),
  {
    ssr: false,
    loading: () => <span className="bd-site-account-trigger" aria-hidden />,
  },
);

const publicNavigation = [
  { labelKey: "nav.findJob", href: "/jobs", desktop: true },
  { labelKey: "nav.findCrew", href: "/find-crew", desktop: true },
  { labelKey: "nav.forYachts", href: "/yacht-os", desktop: true },
  { labelKey: "nav.blog", href: "/blog", desktop: true },
  { labelKey: "nav.about", href: "/about", desktop: true },
  { labelKey: "nav.trust", href: "/trust", desktop: false },
  { labelKey: "nav.contact", href: "/contact", desktop: true },
] satisfies Array<{ labelKey: TranslationKey; href: string; desktop: boolean }>;

function isCurrentRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function mainContentTarget() {
  const target =
    document.getElementById("main-content") || document.querySelector("main");
  if (!target) return null;
  if (!target.id) target.id = "main-content";
  if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
  return target;
}

/** One header is mounted in the root layout for both public and account routes. */
export function PublicHeader() {
  const pathname = usePathname() || "/";
  const { language, setLanguage, t } = useLanguage();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
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
        if (active) setSessionUser(session?.user || null);
      });
      unsubscribe = () => subscription.unsubscribe();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (active) setSessionUser(session?.user || null);
    }
    void watchSession().catch(() => {
      if (active) setSessionUser(null);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, sessionUser?.id]);

  useEffect(() => {
    const breakpoint = window.matchMedia("(max-width: 959px)");
    const closeMenu = () => setMenuOpen(false);
    breakpoint.addEventListener("change", closeMenu);
    return () => breakpoint.removeEventListener("change", closeMenu);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const frame = window.requestAnimationFrame(() => {
      menuPanelRef.current
        ?.querySelector<HTMLAnchorElement>("a[href]")
        ?.focus();
    });
    function onOutsideInteraction(event: PointerEvent | FocusEvent) {
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
      event.preventDefault();
      setMenuOpen(false);
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
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
  }, [menuOpen]);

  return (
    <header className={`bd-public-header ${styles.header}`}>
      <a
        className="bd-skip-link"
        href="#main-content"
        onClick={(event) => {
          const target = mainContentTarget();
          if (!target) return;
          event.preventDefault();
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: "start" });
        }}
      >
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
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen((current) => !current)}
            className="bd-focus bd-public-menu-button"
          >
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
          <BlueDeckLogoLink
            href="/"
            priority
            className="bd-public-brand"
            imageClassName="object-contain p-0"
          />
        </div>

        <nav
          className="bd-public-navigation"
          aria-label={language === "tr" ? "Ana gezinme" : "Primary navigation"}
        >
          {publicNavigation
            .filter((item) => item.desktop)
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  isCurrentRoute(pathname, item.href) ? "page" : undefined
                }
                className="bd-focus bd-public-nav-link"
              >
                {t(item.labelKey)}
              </Link>
            ))}
        </nav>

        <div className="bd-public-actions">
          <LanguageSwitcher size="compact" className="bd-public-language" />
          {sessionUser ? (
            <AccountMenu
              key={sessionUser.id}
              onOpen={() => setMenuOpen(false)}
            />
          ) : (
            <>
              <Link
                href="/login"
                className="bd-focus bd-public-action bd-public-action-quiet bd-public-auth-action bd-site-login"
              >
                {t("auth.login")}
              </Link>
              <Link
                href="/login?mode=signup"
                className="bd-focus bd-public-action bd-public-action-primary bd-public-auth-action bd-site-signup"
              >
                {t("auth.signUp")}
              </Link>
            </>
          )}
        </div>

        {menuOpen ? (
          <div
            ref={menuPanelRef}
            id={menuId}
            className="bd-public-mobile-panel"
          >
            <nav
              aria-label={
                language === "tr"
                  ? "Mobil ana gezinme"
                  : "Mobile primary navigation"
              }
            >
              {publicNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    isCurrentRoute(pathname, item.href) ? "page" : undefined
                  }
                  onClick={() => setMenuOpen(false)}
                  className="bd-focus bd-public-mobile-link"
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
            <div className="bd-public-mobile-utilities">
              <div className="bd-public-mobile-language-row">
                <span>{t("topbar.language")}</span>
                <div
                  data-i18n-ignore
                  role="group"
                  aria-label={t("language.select")}
                  className={styles.languageOptions}
                >
                  {languages.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      aria-label={item.name}
                      aria-pressed={language === item.code}
                      title={item.name}
                      onClick={() => setLanguage(item.code)}
                      className={`bd-focus ${styles.languageOption}`}
                    >
                      <span aria-hidden>{item.flag}</span>
                      <span aria-hidden>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {!sessionUser && (
                <Link
                  href="/login?mode=signup"
                  onClick={() => setMenuOpen(false)}
                  className="bd-focus bd-public-mobile-link"
                >
                  {t("auth.signUp")}
                </Link>
              )}
            </div>
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
          <nav
            aria-label={language === "tr" ? "Yasal bağlantılar" : "Legal links"}
          >
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
  title?: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bd-site-shell min-h-screen text-[#07182d]">
      <main id="main-content">
        <section className="bd-public-page-intro">
          <div className="bd-public-container bd-public-page-intro-inner">
            <p className="bd-kicker">{eyebrow}</p>
            {title && <h1>{title}</h1>}
            {intro && <p>{intro}</p>}
          </div>
        </section>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
