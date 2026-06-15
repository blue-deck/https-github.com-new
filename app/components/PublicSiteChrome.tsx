"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, LayoutDashboard, LogOut, Mail, MapPin, ShieldCheck, UserRound } from "lucide-react";
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

export function PublicHeader() {
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
    <header className="bd-public-header">
      <div className="mx-auto flex h-[92px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <BlueDeckLogoLink
          href="/"
          priority
          className="h-12 w-36 shrink-0 rounded-none border-0 bg-transparent shadow-none sm:h-[74px] sm:w-64"
          imageClassName="object-contain p-0"
        />

        <nav className="hidden items-center gap-7 text-xs font-bold uppercase tracking-[0.18em] text-white/72 xl:flex">
          {publicNavigation.map((item) => (
            <Link key={item.href} href={item.href} className="bd-focus transition hover:text-cyan-200">
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {sessionEmail ? (
            <>
              <Link
                href="/dashboard"
                className="bd-focus inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2.5 text-xs font-bold text-white/82 transition hover:border-cyan-200 hover:text-white sm:px-4 sm:py-3 sm:text-sm"
                title={sessionEmail}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden md:inline">{t("topbar.dashboard")}</span>
              </Link>
              <Link
                href="/profile"
                className="bd-focus inline-flex items-center gap-2 rounded-full bg-white px-3 py-2.5 text-xs font-black text-[#07182d] shadow-xl shadow-cyan-950/20 transition hover:bg-cyan-100 sm:px-4 sm:py-3 sm:text-sm"
                title={sessionEmail}
              >
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">{t("topbar.profile")}</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="bd-focus inline-flex items-center gap-2 rounded-full border border-rose-200/30 bg-rose-50/10 px-3 py-2.5 text-xs font-black text-white/88 shadow-lg shadow-cyan-950/10 transition hover:border-rose-100 hover:bg-rose-100 hover:text-[#07182d] sm:px-4 sm:py-3 sm:text-sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline">{t("topbar.logout")}</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="bd-focus rounded-full border border-white/15 px-3 py-2.5 text-xs font-bold text-white/82 transition hover:border-cyan-200 hover:text-white sm:px-5 sm:py-3 sm:text-sm"
              >
                {t("auth.login")}
              </Link>
              <Link
                href="/login?mode=signup"
                className="bd-focus rounded-full bg-white px-3 py-2.5 text-xs font-black text-[#07182d] shadow-xl shadow-cyan-950/20 transition hover:bg-cyan-100 sm:px-5 sm:py-3 sm:text-sm"
              >
                {t("auth.signUp")}
              </Link>
            </>
          )}
          <LanguageSwitcher size="compact" />
        </div>
      </div>
    </header>
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
            className="h-16 w-56 rounded-none border-0 bg-transparent shadow-none"
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
    <main className="bd-site-shell min-h-screen pt-[92px] text-[#071f3c]">
      <PublicHeader />
      <section className="mx-auto max-w-[1500px] px-5 pb-14 pt-16 sm:px-8 lg:px-12 lg:pt-24">
        <p className="bd-kicker">{eyebrow}</p>
        <h1 className="bd-serif mt-5 max-w-5xl text-5xl leading-[1.02] text-[#071f3c] sm:text-7xl">
          {title}
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-[#5b7088]">{intro}</p>
      </section>
      {children}
      <PublicFooter />
    </main>
  );
}
