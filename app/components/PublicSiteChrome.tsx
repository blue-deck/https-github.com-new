"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, LayoutDashboard, LogOut, Mail, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { type TranslationKey } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { BlueDeckLogoLink } from "./BlueDeckLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

const publicNavigation = [
  { labelKey: "nav.yachts", href: "/#yacht-platform" },
  { labelKey: "nav.services", href: "/services" },
  { labelKey: "nav.management", href: "/management" },
  { labelKey: "nav.trust", href: "/trust" },
  { labelKey: "nav.about", href: "/about" },
  { labelKey: "nav.contact", href: "/contact" },
] satisfies Array<{ labelKey: TranslationKey; href: string }>;

const homepagePrimaryNavigation = [
  { labelKey: "nav.findJob", href: "/login?mode=signup&role=crew" },
  { labelKey: "nav.findCrew", href: "/login?mode=signup&role=management" },
] satisfies Array<{ labelKey: TranslationKey; href: string }>;

const homepageMoreNavigation = [
  { labelKey: "nav.yachts", href: "/#yacht-platform" },
  { labelKey: "nav.services", href: "/services" },
  { labelKey: "nav.management", href: "/management" },
  { labelKey: "nav.trust", href: "/trust" },
] satisfies Array<{ labelKey: TranslationKey; href: string }>;

const homepageTrailingNavigation = [
  { labelKey: "nav.about", href: "/about" },
  { labelKey: "nav.contact", href: "/contact" },
] satisfies Array<{ labelKey: TranslationKey; href: string }>;

export function PublicHeader({ homepageNavigation = false }: { homepageNavigation?: boolean }) {
  const { t } = useLanguage();
  const [sessionEmail, setSessionEmail] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      setSessionEmail(session?.user?.email || "");
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email || "");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className={`bd-public-header ${homepageNavigation ? "bd-public-header-home" : ""}`}>
      <div className="bd-public-header-inner">
        <BlueDeckLogoLink
          href="/"
          priority
          className="bd-public-brand"
          imageClassName="object-contain object-left p-0"
        />

        <nav className="bd-public-shortcuts" aria-label="BlueDeck public navigation">
          {homepageNavigation ? (
            <>
              {homepagePrimaryNavigation.map((item) => (
                <Link key={item.href} href={item.href} className="bd-focus bd-public-shortcut-button">
                  {t(item.labelKey)}
                </Link>
              ))}
              <HomepageMoreMenu items={homepageMoreNavigation} />
              {homepageTrailingNavigation.map((item) => (
                <Link key={item.href} href={item.href} className="bd-focus transition hover:text-cyan-200">
                  {t(item.labelKey)}
                </Link>
              ))}
            </>
          ) : (
            publicNavigation.map((item) => (
              <Link key={item.href} href={item.href} className="bd-focus transition hover:text-cyan-200">
                {t(item.labelKey)}
              </Link>
            ))
          )}
        </nav>

        <div className="bd-public-actions">
          {homepageNavigation && !sessionEmail ? (
            <HomepageMoreMenu
              items={[
                ...homepagePrimaryNavigation,
                ...homepageMoreNavigation,
                ...homepageTrailingNavigation,
              ]}
              mobile
            />
          ) : null}
          {sessionEmail ? (
            <>
              <Link
                href="/dashboard"
                className="bd-focus bd-public-action bd-public-action-outline bd-public-session-action"
                title={sessionEmail}
                aria-label={t("topbar.dashboard")}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>{t("topbar.dashboard")}</span>
              </Link>
              <Link
                href="/profile"
                className="bd-focus bd-public-action bd-public-action-solid bd-public-session-action"
                title={sessionEmail}
                aria-label={t("topbar.profile")}
              >
                <UserRound className="h-4 w-4" />
                <span>{t("topbar.profile")}</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="bd-focus bd-public-action bd-public-action-outline bd-public-session-action"
                aria-label={t("topbar.logout")}
              >
                <LogOut className="h-4 w-4" />
                <span>{t("topbar.logout")}</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="bd-focus bd-public-action bd-public-action-outline"
              >
                {t("auth.login")}
              </Link>
              <Link
                href="/login?mode=signup"
                className="bd-focus bd-public-action bd-public-action-primary"
              >
                {t("auth.signUp")}
              </Link>
            </>
          )}
          <LanguageSwitcher size="compact" className="bd-public-language" />
        </div>
      </div>
    </header>
  );
}

function HomepageMoreMenu({
  items,
  mobile = false,
}: {
  items: Array<{ labelKey: TranslationKey; href: string }>;
  mobile?: boolean;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={menuRef}
      className={`bd-public-more-menu ${mobile ? "bd-public-more-menu-mobile" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className={`bd-focus bd-public-more-trigger ${
          mobile ? "bd-public-action bd-public-action-outline" : ""
        }`}
      >
        {t("nav.more")}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div id={panelId} aria-label={t("nav.more")} className="bd-public-more-panel">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="bd-focus bd-public-more-item"
            >
              {t(item.labelKey)}
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PublicFooter() {
  const { t } = useLanguage();

  return (
    <footer className="bd-public-footer border-t border-[#071f3c]/10 bg-[#06172b] text-white">
      <div className="mx-auto grid max-w-[1500px] gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr] lg:px-12">
        <div>
          <BlueDeckLogoLink
            href="/"
            className="h-16 w-56"
            imageClassName="object-contain p-0"
          />
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/62">
            {t("footer.description")}
          </p>
        </div>

        <FooterColumn
          title={t("footer.company")}
          links={[
            [t("nav.about"), "/about"],
            [t("footer.vision"), "/about#vision"],
            [t("nav.services"), "/services"],
            [t("nav.contact"), "/contact"],
          ]}
        />
        <FooterColumn
          title={t("footer.platform")}
          links={[
            [t("nav.yachts"), "/#yacht-platform"],
            [t("nav.management"), "/management"],
            [t("nav.trust"), "/trust"],
            [t("footer.clientLogin"), "/login"],
          ]}
        />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">{t("footer.contact")}</p>
          <div className="mt-5 space-y-4 text-sm text-white/68">
            <a href="mailto:info@bluedeck.app" className="flex items-center gap-3 transition hover:text-white">
              <Mail className="h-4 w-4 text-cyan-200" />
              info@bluedeck.app
            </a>
            <p className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-cyan-200" />
              {t("footer.operations")}
            </p>
            <p className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-cyan-200" />
              {t("footer.secureAccess")}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-5 py-5 text-xs text-white/50 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <p>© {new Date().getFullYear()} BlueDeck. {t("footer.rights")}</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-white">{t("footer.privacy")}</Link>
            <Link href="/terms" className="hover:text-white">{t("footer.terms")}</Link>
            <Link href="/contact" className="hover:text-white">{t("nav.contact")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">{title}</p>
      <div className="mt-5 grid gap-3 text-sm text-white/68">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className="inline-flex items-center gap-2 transition hover:text-white">
            {label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ))}
      </div>
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
    <main className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />
      <section className="bd-public-page-intro">
        <div className="mx-auto max-w-[1500px] px-5 pb-14 pt-16 sm:px-8 lg:px-12 lg:pt-24">
          <p className="bd-kicker">{eyebrow}</p>
          <h1 className="bd-serif mt-5 max-w-5xl text-5xl leading-[1.02] text-[#071f3c] sm:text-7xl">
            {title}
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[#5b7088]">{intro}</p>
        </div>
      </section>
      {children}
      <PublicFooter />
    </main>
  );
}
