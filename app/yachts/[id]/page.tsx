"use client";

import Link from "next/link";
import {
  Ship,
  Map,
  Wrench,
  Users,
  Bell,
  FileText,
  Wallet,
  Radio,
  Cpu,
  Waves,
} from "lucide-react";

const yachtId = "f434e90f-b8d8-443c-ad23-d5cedbe4308f";

const cards = [
  {
    title: "Live Navigation",
    icon: Map,
    href: `/yachts/${yachtId}/live-map`,
    desc: "Realtime GPS tracking and live navigation systems",
  },
  {
    title: "BridgeOS",
    icon: Radio,
    href: `/yachts/${yachtId}/bridge`,
    desc: "Professional bridge and captain operations",
  },
  {
    title: "Crew Center",
    icon: Users,
    href: `/yachts/${yachtId}/crew`,
    desc: "Crew operations and onboard management",
  },
  {
    title: "Engineering",
    icon: Wrench,
    href: `/yachts/${yachtId}/engineering`,
    desc: "Maintenance, engines and technical systems",
  },
  {
    title: "Finance",
    icon: Wallet,
    href: `/yachts/${yachtId}/finance`,
    desc: "Operational expenses and yacht accounting",
  },
  {
    title: "AI Center",
    icon: Cpu,
    href: `/yachts/${yachtId}/ai`,
    desc: "AI analytics and predictive operations",
  },
];

export default function YachtDashboard() {
  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto max-w-7xl p-8">
        <div className="mb-14 overflow-hidden rounded-[40px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-900/10">
          <div className="grid gap-10 p-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-5 py-3 text-cyan-300">
                <Ship className="h-5 w-5" />
                BlueDeck Enterprise YachtOS
              </div>

              <h1 className="text-7xl font-black leading-tight">
                HELIOPHILIA
              </h1>

              <p className="mt-8 max-w-3xl text-2xl leading-relaxed text-gray-300">
                Enterprise-grade superyacht operating platform for
                navigation, engineering, crew management and live operations.
              </p>

              <div className="mt-10 flex flex-wrap gap-5">
                <Link
                  href={`/yachts/${yachtId}/live-map`}
                  className="rounded-2xl bg-cyan-400 px-8 py-5 text-lg font-black text-black transition hover:scale-105"
                >
                  Open Navigation
                </Link>

                <Link
                  href={`/yachts/${yachtId}/bridge`}
                  className="rounded-2xl border border-white/10 bg-white/5 px-8 py-5 text-lg font-black transition hover:bg-white/10"
                >
                  Enter BridgeOS
                </Link>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <StatusCard title="Navigation" value="ONLINE" />
              <StatusCard title="AIS Systems" value="ACTIVE" />
              <StatusCard title="Engineering" value="READY" />
              <StatusCard title="Alerts" value="0 CRITICAL" />
            </div>
          </div>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-4">
          <InfoCard title="Flag" value="United Kingdom" />
          <InfoCard title="Length" value="88 ft" />
          <InfoCard title="Captain" value="Sinan Uymaz" />
          <InfoCard title="Mode" value="PRIVATE" />
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-[32px] border border-white/10 bg-white/5 p-8 transition hover:border-cyan-400/40 hover:bg-cyan-400/5"
              >
                <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-400 text-black">
                  <Icon className="h-8 w-8" />
                </div>

                <h2 className="text-4xl font-black">
                  {card.title}
                </h2>

                <p className="mt-5 text-lg leading-relaxed text-gray-400">
                  {card.desc}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 rounded-[40px] border border-white/10 bg-white/5 p-10">
          <div className="flex items-center gap-4">
            <div className="rounded-3xl bg-cyan-400 p-4 text-black">
              <Waves className="h-10 w-10" />
            </div>

            <div>
              <p className="text-cyan-300">Fleet Status</p>
              <h2 className="text-5xl font-black">
                Operational
              </h2>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-4">
            <Metric title="Crew Online" value="5" />
            <Metric title="Fuel Status" value="82%" />
            <Metric title="Maintenance" value="Good" />
            <Metric title="Connectivity" value="Starlink" />
          </div>
        </div>
      </div>
    </main>
  );
}

function StatusCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-black/20 p-6">
      <p className="text-gray-400">{title}</p>

      <h3 className="mt-4 text-3xl font-black text-cyan-300">
        {value}
      </h3>
    </div>
  );
}

function InfoCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6">
      <p className="text-gray-400">{title}</p>

      <h2 className="mt-4 text-3xl font-black">
        {value}
      </h2>
    </div>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
      <p className="text-gray-400">{title}</p>

      <h3 className="mt-4 text-4xl font-black">
        {value}
      </h3>
    </div>
  );
}