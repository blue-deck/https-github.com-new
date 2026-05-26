"use client";

import Link from "next/link";
import { LayoutDashboard, UserRound } from "lucide-react";
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
    <header className="bd-app-topbar border-b border-cyan-100/10 bg-[#020817]/98 shadow-2xl shadow-slate-950/24 backdrop-blur-2xl">
      <div className="mx-auto flex h-[92px] max-w-[1500px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <div className="flex min-w-0 items-center gap-4">
          <BlueDeckLogoLink
            href="https://www.bluedeck.app"
            label="BlueDeck home"
            className="h-14 w-44 shrink-0 rounded-none border-0 bg-[#020817] shadow-none sm:h-16 sm:w-56"
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
            className="bd-focus inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-3 text-sm font-bold text-white/90 backdrop-blur-xl transition hover:bg-white/16"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <Link
            href="/profile"
            className="bd-focus inline-flex items-center gap-2 rounded-full bg-cyan-200 px-4 py-3 text-sm font-bold text-[#020817] shadow-xl shadow-cyan-400/15 transition hover:bg-white"
          >
            <UserRound className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
