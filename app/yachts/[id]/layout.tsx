"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Crown,
  Gauge,
  Home,
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
    { label: "Crew", href: `/yachts/${yachtId}/crew`, icon: Users },
    { label: "Owner", href: `/yachts/${yachtId}/owner`, icon: Crown },
  ];

  return (
    <div className="bd-yacht-portal min-h-screen text-slate-900">
      <div>{children}</div>

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
