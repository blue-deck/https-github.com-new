"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { BlueDeckMark } from "../../components/BlueDeckLogo";
import {
  Bell,
  Crown,
  Gauge,
  Home,
  type LucideIcon,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";

export default function YachtAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const yachtId = String(params?.id || "");

  const nav = [
    { label: "Overview", href: `/yachts/${yachtId}`, icon: Home },
    { label: "Bridge", href: `/yachts/${yachtId}/bridge`, icon: Radio },
    { label: "Ops", href: `/yachts/${yachtId}/live-operations`, icon: Gauge },
    { label: "Crew", href: `/yachts/${yachtId}/crew`, icon: Users },
    { label: "Owner", href: `/yachts/${yachtId}/owner`, icon: Crown },
  ];

  return (
    <div className="bd-yacht-portal min-h-screen text-slate-900">
      <header className="bd-ocean-topbar fixed left-0 right-0 top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
          <Link href={`/yachts/${yachtId}`} className="bd-focus flex min-w-0 items-center gap-3 rounded-full">
            <BlueDeckMark className="h-12 w-16 shrink-0 rounded-none border-0 bg-transparent shadow-none" imageClassName="object-contain p-0" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                BlueDeck OS
              </p>
              <h1 className="truncate text-lg font-semibold text-slate-950">
                HELIOPHILIA
              </h1>
            </div>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <Chip icon={ShieldCheck} text="Private Yacht" tone="blue" />
            <Chip icon={Gauge} text="98% Ready" tone="green" />
            <Chip icon={Bell} text="0 Critical" tone="cyan" />
          </div>
        </div>
      </header>

      <div className="pt-[68px]">{children}</div>

      <nav className="bd-ocean-pill fixed bottom-4 left-1/2 z-50 w-[calc(100%-24px)] max-w-3xl -translate-x-1/2 rounded-full p-2">
        <div className="grid grid-cols-5 gap-1 sm:gap-2">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href.endsWith("/live-operations") &&
                pathname.includes("/live-operations"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`bd-focus flex h-14 flex-col items-center justify-center rounded-full px-2 text-xs font-semibold transition sm:h-16 ${
                  active
                    ? "bg-cyan-600 text-white"
                    : "text-slate-500 hover:bg-cyan-50 hover:text-slate-950"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="mt-1 hidden sm:block">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Chip({
  icon: Icon,
  text,
  tone,
}: {
  icon: LucideIcon;
  text: string;
  tone: "blue" | "green" | "cyan";
}) {
  const tones = {
    blue: "border-[#22d3ee]/30 bg-[#22d3ee]/10 text-cyan-700",
    green: "border-[#66d19e]/30 bg-[#66d19e]/10 text-emerald-700",
    cyan: "border-[#47d7df]/30 bg-[#47d7df]/10 text-cyan-700",
  };

  return (
    <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${tones[tone]}`}>
      <Icon className="h-4 w-4" />
      {text}
    </div>
  );
}
