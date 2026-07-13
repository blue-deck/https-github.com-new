"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, Settings, UserRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { BlueDeckLogoLink } from "./BlueDeckLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useLanguage } from "./LanguageProvider";

type BlueDeckTopBarProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

export function BlueDeckTopBar({
  title = "BlueDeck",
  subtitle = "YACHT-OS",
  className = "",
}: BlueDeckTopBarProps) {
  const { t } = useLanguage();

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className={`bd-app-topbar border-b border-white/10 shadow-2xl shadow-slate-950/22 ${className}`}>
      <div className="bd-app-topbar-inner mx-auto flex h-[88px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <div className="bd-topbar-logo-area flex min-w-0 items-center gap-4">
          <BlueDeckLogoLink
            href="/"
            label="BlueDeck home"
            className="bd-topbar-logo h-12 w-48 shrink-0 sm:w-60"
            imageClassName="object-contain p-0"
          />

          <div className="hidden min-w-0 border-l border-white/10 pl-4 sm:block">
            <p className="truncate text-sm font-black tracking-[0.05em] text-cyan-200">
              {title}
            </p>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
              {subtitle}
            </p>
          </div>
        </div>

        <nav className="bd-topbar-navigation flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="bd-focus inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm font-bold text-white/84 transition hover:border-cyan-200 hover:text-white"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">{t("topbar.dashboard")}</span>
          </Link>

          <Link
            href="/settings"
            className="bd-focus hidden items-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm font-bold text-white/84 transition hover:border-cyan-200 hover:text-white md:inline-flex"
          >
            <Settings className="h-4 w-4" />
            <span>{t("topbar.settings")}</span>
          </Link>

          <Link
            href="/profile"
            className="bd-focus inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#07182d] shadow-xl shadow-cyan-950/20 transition hover:bg-cyan-100"
          >
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">{t("topbar.profile")}</span>
          </Link>

          <LanguageSwitcher size="compact" />

          <button
            type="button"
            onClick={logout}
            className="bd-focus inline-flex items-center gap-2 rounded-full border border-rose-100/30 bg-white/8 px-4 py-3 text-sm font-black text-white/86 shadow-lg shadow-slate-950/10 transition hover:border-rose-100 hover:bg-rose-50 hover:text-[#07182d]"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline">{t("topbar.logout")}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
