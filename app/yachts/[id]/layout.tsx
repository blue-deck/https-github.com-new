"use client";

import { useEffect, useState } from "react";
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
import { supabase } from "../../lib/supabase";

export default function YachtAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const yachtId = String(params?.id || "");
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        window.location.href = "/login";
        return;
      }

      setSessionChecked(true);
    }

    verifyAccess();

    return () => {
      active = false;
    };
  }, []);

  const nav = [
    { label: "Overview", href: `/yachts/${yachtId}`, icon: Home },
    { label: "Bridge", href: `/yachts/${yachtId}/bridge`, icon: Radio },
    { label: "Ops", href: `/yachts/${yachtId}/live-operations`, icon: Gauge },
    { label: "Checklist", href: `/yachts/${yachtId}/checklists`, icon: ClipboardList },
    { label: "Crew", href: `/yachts/${yachtId}/crew`, icon: Users },
    { label: "Owner", href: `/yachts/${yachtId}/owner`, icon: Crown },
  ];

  if (!sessionChecked) {
    return (
      <main className="bd-site-shell min-h-screen px-5 py-16 text-[#071f3c] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1500px]">
          <p className="bd-kicker">BlueDeck Secure Access</p>
          <h1 className="bd-serif mt-4 text-5xl">Opening private yacht workspace...</h1>
        </div>
      </main>
    );
  }

  return (
    <div className="bd-yacht-portal min-h-screen text-slate-900">
      <nav className="bd-yacht-section-nav sticky top-[92px] z-40 border-b border-[#071f3c]/10 bg-white/92 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-6 overflow-x-auto px-4 py-4 sm:px-8 lg:px-12">
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
                className={`bd-focus inline-flex min-w-fit items-center gap-2 border-b-2 px-1 py-2 text-sm font-black uppercase tracking-[0.12em] transition ${
                  active
                    ? "border-cyan-700 text-[#071f3c]"
                    : "border-transparent text-[#5b7088] hover:border-cyan-300 hover:text-[#071f3c]"
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
