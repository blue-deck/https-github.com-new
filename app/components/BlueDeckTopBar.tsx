"use client";

import Link from "next/link";
import { LayoutDashboard, Settings, UserRound } from "lucide-react";
import { BlueDeckLogoLink } from "./BlueDeckLogo";

type BlueDeckTopBarProps = {
  title?: string;
  subtitle?: string;
};

export function BlueDeckTopBar({
  title = "BlueDeck",
  subtitle = "YachtOS",
}: BlueDeckTopBarProps) {
  return (
    <header className="bd-app-topbar border-b border-white/10 bg-[linear-gradient(90deg,#020817_0%,#06172b_52%,#0b2842_100%)] shadow-2xl shadow-slate-950/22">
      <div className="mx-auto flex h-[92px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-4">
          <BlueDeckLogoLink
            href="https://www.bluedeck.app"
            label="BlueDeck home"
            className="h-14 w-44 shrink-0 rounded-none border-0 bg-transparent shadow-none sm:h-16 sm:w-56"
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

        <nav className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="bd-focus inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm font-bold text-white/84 transition hover:border-cyan-200 hover:text-white"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <Link
            href="/settings"
            className="bd-focus hidden items-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm font-bold text-white/84 transition hover:border-cyan-200 hover:text-white md:inline-flex"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>

          <Link
            href="/profile"
            className="bd-focus inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-[#07182d] shadow-xl shadow-cyan-950/20 transition hover:bg-cyan-100"
          >
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
