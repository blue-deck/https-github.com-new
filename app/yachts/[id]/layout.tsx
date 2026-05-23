"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Home, Radar, Ship, Bell, Cpu, FileText, Wrench, Users } from "lucide-react";

export default function YachtAppLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const yachtId = String(params?.id || "");

  const nav = [
    { label: "Home", href: `/yachts/${yachtId}`, icon: <Home className="h-5 w-5" /> },
    { label: "Map", href: `/yachts/${yachtId}/live-map`, icon: <Radar className="h-5 w-5" /> },
    { label: "Bridge", href: `/yachts/${yachtId}/bridge`, icon: <Ship className="h-5 w-5" /> },
    { label: "Crew", href: `/yachts/${yachtId}/crew`, icon: <Users className="h-5 w-5" /> },
    { label: "AI", href: `/yachts/${yachtId}/ai`, icon: <Cpu className="h-5 w-5" /> },
    { label: "Reports", href: `/yachts/${yachtId}/reports`, icon: <FileText className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#020817]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href={`/yachts/${yachtId}`} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-black">
              <Ship className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-cyan-300">BlueDeck YachtOS</p>
              <h1 className="text-lg font-black">Heliophilia</h1>
            </div>
          </Link>

          <div className="hidden items-center gap-3 lg:flex">
            <Chip text="Captain Mode" />
            <Chip text="Private Yacht" />
            <Chip text="0 Critical" />
          </div>
        </div>
      </header>

      <div className="pt-20">{children}</div>

      <nav className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-24px)] max-w-4xl -translate-x-1/2 rounded-full border border-white/10 bg-black/75 p-2 backdrop-blur-2xl">
        <div className="grid grid-cols-6 gap-2">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center rounded-full px-3 py-3 text-xs transition ${
                  active ? "bg-cyan-400 text-black" : "text-gray-300 hover:bg-white/10"
                }`}
              >
                {item.icon}
                <span className="mt-1 hidden sm:block">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
      {text}
    </div>
  );
}