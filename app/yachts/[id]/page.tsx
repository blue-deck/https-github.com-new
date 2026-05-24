"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Compass,
  Crown,
  FileText,
  Gauge,
  type LucideIcon,
  Map,
  Radio,
  ShieldCheck,
  Ship,
  Users,
  Wrench,
} from "lucide-react";
import { BLUEDECK } from "../../config";

const yachtId = BLUEDECK.yachtId;

const readiness = [
  { label: "Navigation", value: "Online", detail: "GPS and bridge systems ready" },
  { label: "Crew", value: "5 active", detail: "Interior, deck and engineering covered" },
  { label: "Guest", value: "Ready", detail: "Owner arrival profile prepared" },
  { label: "Engineering", value: "Good", detail: "No critical maintenance due" },
];

const actions = [
  {
    title: "Open Bridge",
    text: "Navigation, command view and bridge systems.",
    href: `/yachts/${yachtId}/bridge`,
    icon: Radio,
  },
  {
    title: "Operations",
    text: "Tasks, alerts, voyage plan and live activity.",
    href: `/yachts/${yachtId}/live-operations`,
    icon: Gauge,
  },
  {
    title: "Owner View",
    text: "Private owner status, privacy and guest readiness.",
    href: `/yachts/${yachtId}/owner`,
    icon: Crown,
  },
  {
    title: "IMO Crew List",
    text: "Generate a printable crew list from saved crew profiles.",
    href: `/yachts/${yachtId}/imo-crew-list`,
    icon: FileText,
  },
  {
    title: "Engineering",
    text: "Maintenance, systems, fuel and technical readiness.",
    href: `/yachts/${yachtId}/engineering`,
    icon: Wrench,
  },
];

export default function YachtDashboard() {
  return (
    <main className="min-h-screen px-5 pb-28 pt-8 text-[#eef7ff] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="bd-panel overflow-hidden rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="bd-kicker">Private Yacht Overview</p>
                <h1 className="mt-4 text-5xl font-semibold leading-tight text-white sm:text-7xl">
                  {BLUEDECK.yachtName}
                </h1>
              </div>
              <span className="rounded-full border border-[#66d19e]/25 bg-[#66d19e]/10 px-4 py-2 text-sm font-semibold text-[#91e7ba]">
                0 Critical
              </span>
            </div>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#aeb8c8]">
              The daily command view for captain, owner and crew readiness.
              Key systems are grouped here so the team can act quickly without
              opening every module.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroMetric icon={Ship} label="Mode" value={BLUEDECK.mode} />
              <HeroMetric icon={Map} label="Flag" value={BLUEDECK.flag} />
              <HeroMetric icon={Compass} label="Voyage" value="Standby" />
              <HeroMetric icon={ShieldCheck} label="Privacy" value="Active" />
            </div>
          </div>

          <div className="bd-panel rounded-3xl p-6 sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="bd-kicker">Today</p>
                <h2 className="mt-3 text-3xl font-semibold text-white">
                  Yacht Readiness
                </h2>
              </div>
              <Gauge className="h-8 w-8 text-[#22d3ee]" />
            </div>

            <div className="mt-7 space-y-4">
              {readiness.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-white">{item.label}</p>
                    <p className="text-sm font-semibold text-[#22d3ee]">
                      {item.value}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#aeb8c8]">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <StatusPanel
            icon={Bell}
            title="Alerts"
            value="Clear"
            text="No critical operational alerts are active."
            tone="green"
          />
          <StatusPanel
            icon={CalendarDays}
            title="Next Voyage"
            value="Owner Approval"
            text="Route and guest schedule are prepared for review."
            tone="blue"
          />
          <StatusPanel
            icon={FileText}
            title="Documents"
            value="Vault Ready"
            text="Certificates, reports and guest documents are organized."
            tone="cyan"
          />
        </section>

        <section className="mt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="bd-kicker">Workspaces</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">
                Choose the right mode.
              </h2>
            </div>
            <Link
              href={`/yachts/${yachtId}/notification-center`}
              className="bd-focus inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 font-semibold text-white transition hover:bg-white/[0.12]"
            >
              Notification Center
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {actions.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="bd-focus group rounded-2xl border border-white/10 bg-white/[0.045] p-6 transition hover:border-[#22d3ee]/35 hover:bg-white/[0.075]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#22d3ee]/15 text-[#22d3ee]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-white">
                    {action.title}
                  </h3>
                  <p className="mt-3 leading-7 text-[#aeb8c8]">{action.text}</p>
                  <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#22d3ee] opacity-80 transition group-hover:opacity-100">
                    Open
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <Icon className="h-5 w-5 text-[#22d3ee]" />
      <p className="mt-4 text-sm text-[#aeb8c8]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusPanel({
  icon: Icon,
  title,
  value,
  text,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  text: string;
  tone: "green" | "blue" | "cyan";
}) {
  const tones = {
    green: "text-[#91e7ba] bg-[#66d19e]/10 border-[#66d19e]/20",
    blue: "text-[#67e8f9] bg-[#22d3ee]/10 border-[#22d3ee]/20",
    cyan: "text-[#85edf1] bg-[#47d7df]/10 border-[#47d7df]/20",
  };

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-6">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-5 text-sm text-[#aeb8c8]">{title}</p>
      <h3 className="mt-1 text-2xl font-semibold text-white">{value}</h3>
      <p className="mt-3 leading-7 text-[#aeb8c8]">{text}</p>
    </article>
  );
}
