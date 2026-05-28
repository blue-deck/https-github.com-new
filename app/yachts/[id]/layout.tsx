"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Crown,
  Gauge,
  Home,
  ClipboardList,
  Radio,
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
    { label: "Checklist", href: `/yachts/${yachtId}/checklists`, icon: ClipboardList },
    { label: "Crew", href: `/yachts/${yachtId}/crew`, icon: Users },
    { label: "Owner", href: `/yachts/${yachtId}/owner`, icon: Crown },
  ];

  return (
    <div className="bd-yacht-portal min-h-screen text-slate-900">
      <nav className="bd-yacht-section-nav sticky top-[92px] z-40 border-b border-slate-200/70 bg-white/88 shadow-lg shadow-cyan-950/5 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-8 lg:px-12">
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
                className={`bd-focus inline-flex min-w-fit items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition ${
                  active
                    ? "border-cyan-300 bg-slate-950 text-white shadow-xl shadow-cyan-950/12"
                    : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-slate-950"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div>{children}</div>
    </div>
  );
}
