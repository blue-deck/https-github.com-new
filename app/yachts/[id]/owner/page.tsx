"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Crown,
  FileText,
  Gauge,
  MapPin,
  Printer,
  RefreshCcw,
  ShieldCheck,
  Ship,
  type LucideIcon,
} from "lucide-react";
import { BLUEDECK } from "../../../config";
import { supabase } from "../../../lib/supabase";

type OwnerStats = {
  crewCount: number;
  completedTasks: number;
  totalTasks: number;
  documentCount: number;
  criticalDocuments: number;
  expiringDocuments: number;
  status: any;
  updatedAt: string;
};

const emptyStats: OwnerStats = {
  crewCount: 0,
  completedTasks: 0,
  totalTasks: 0,
  documentCount: 0,
  criticalDocuments: 0,
  expiringDocuments: 0,
  status: null,
  updatedAt: "",
};

export default function OwnerPage() {
  const params = useParams();
  const yachtId = String(params?.id || BLUEDECK.yachtId);
  const [stats, setStats] = useState<OwnerStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function loadOwnerData(silent = false) {
    if (!silent) setLoading(true);
    setLoadError("");

    const [statusResponse, crewResponse, checklistResponse, documentResponse] =
      await Promise.all([
        supabase
          .from("yacht_status")
          .select("*")
          .eq("yacht_id", yachtId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("yacht_crew_memberships")
          .select("id,status")
          .eq("yacht_id", yachtId),
        supabase
          .from("yacht_checklists")
          .select(
            `
              id,
              status,
              yacht_checklist_items (
                id,
                completed
              )
            `
          )
          .eq("yacht_id", yachtId),
        supabase
          .from("yacht_documents")
          .select("id,expiry_date")
          .eq("yacht_id", yachtId),
      ]);

    const readableErrors = [statusResponse, crewResponse, checklistResponse, documentResponse]
      .map((response) => response.error?.message)
      .filter(Boolean);

    if (readableErrors.length) {
      setLoadError(readableErrors[0] || "Owner data could not be loaded.");
    }

    const crew = crewResponse.error ? [] : crewResponse.data || [];
    const checklists = checklistResponse.error ? [] : checklistResponse.data || [];
    const documents = documentResponse.error ? [] : documentResponse.data || [];
    const tasks = checklists.flatMap((item: any) => item.yacht_checklist_items || []);
    const completedTasks = tasks.filter((task: any) => task.completed).length;
    const expiringDocuments = documents.filter((item: any) => {
      const days = daysUntil(item.expiry_date);
      return days !== null && days >= 0 && days <= 90;
    }).length;
    const criticalDocuments = documents.filter((item: any) => {
      const days = daysUntil(item.expiry_date);
      return days !== null && days <= 30;
    }).length;

    setStats({
      crewCount: crew.length,
      completedTasks,
      totalTasks: tasks.length,
      documentCount: documents.length,
      criticalDocuments,
      expiringDocuments,
      status: statusResponse.error ? null : statusResponse.data,
      updatedAt: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    });

    setLoading(false);
  }

  useEffect(() => {
    loadOwnerData();
    const interval = window.setInterval(() => loadOwnerData(true), 15000);
    return () => window.clearInterval(interval);
  }, [yachtId]);

  const taskProgress = stats.totalTasks
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 100;

  const ownerReadiness = useMemo(() => {
    const crewScore = stats.crewCount ? 24 : 12;
    const taskScore = Math.round(taskProgress * 0.35);
    const documentScore = stats.criticalDocuments ? 10 : 24;
    const statusScore = stats.status ? 22 : 14;
    return Math.max(0, Math.min(99, crewScore + taskScore + documentScore + statusScore));
  }, [stats, taskProgress]);

  const ownerLines = [
    {
      icon: CalendarDays,
      label: "Next Moment",
      value: stats.status?.guest_mode ? "Guest cruise active" : "Sunset service",
    },
    {
      icon: MapPin,
      label: "Location",
      value: stats.status?.location || "Location not set",
    },
    {
      icon: ShieldCheck,
      label: "Privacy",
      value: stats.status?.owner_onboard ? "Owner onboard" : "Private mode",
    },
  ];

  const ownerCards = [
    {
      icon: Ship,
      title: "Yacht Status",
      text: stats.status?.status || "Status not set",
      detail: stats.status?.sea_state || "Sea state waiting",
      href: `/yachts/${yachtId}/status`,
      tone: "cyan",
    },
    {
      icon: MapPin,
      title: "Location",
      text: stats.status?.location || "Set yacht position",
      detail: stats.status?.weather || "Weather not set",
      href: `/yachts/${yachtId}/live-map`,
      tone: "emerald",
    },
    {
      icon: Bell,
      title: "Owner Alerts",
      text: stats.criticalDocuments ? `${stats.criticalDocuments} critical` : "Clear",
      detail: stats.expiringDocuments ? `${stats.expiringDocuments} expiry warnings` : "No owner-level alert",
      href: `/yachts/${yachtId}/alerts`,
      tone: stats.criticalDocuments ? "rose" : "emerald",
    },
    {
      icon: FileText,
      title: "Reports",
      text: "Ready",
      detail: "Owner and captain PDF reports",
      href: `/yachts/${yachtId}/reports`,
      tone: "gold",
    },
  ] as const;

  return (
    <main className="min-h-screen px-5 pb-32 pt-8 text-slate-950 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[38px] border border-slate-200 bg-white p-6 shadow-2xl shadow-cyan-950/10 sm:p-8 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#083344,#22d3ee,#d6a84f,#ef776f)]" />

          <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
            <div>
              <p className="bd-kicker">Owner Experience</p>
              <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.95] text-slate-950 sm:text-7xl">
                Private Owner View
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                {BLUEDECK.yachtName} owner readiness, privacy, alerts and
                daily yacht status in one calm control view.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 px-5 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-800">
                    Owner Ready
                  </p>
                  <p className="mt-1 text-3xl font-black text-slate-950">{ownerReadiness}%</p>
                </div>
                <OwnerButton href={`/yachts/${yachtId}/status`} icon={Gauge} label="Live Status" />
                <button
                  type="button"
                  onClick={() => loadOwnerData()}
                  className="bd-focus inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-800 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
                >
                  <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {loadError && (
                <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                  {loadError}
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-cyan-200 bg-cyan-50 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300">
                  <Crown className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.12em] text-cyan-800">
                    {BLUEDECK.yachtName}
                  </p>
                  <h2 className="text-3xl font-black text-slate-950">
                    Owner Arrival Ready
                  </h2>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                {ownerLines.map((line) => (
                  <OwnerLine key={line.label} {...line} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat title="Yacht" value={BLUEDECK.yachtName} />
          <Stat title="Mode" value={stats.status?.guest_mode ? "Guest Cruise" : "Private"} />
          <Stat title="Documents" value={`${stats.documentCount} Saved`} />
          <Stat title="Alerts" value={stats.criticalDocuments ? `${stats.criticalDocuments} Critical` : "Clear"} />
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ownerCards.map((card) => (
            <OwnerCard key={card.title} {...card} />
          ))}
        </section>

        <section className="mt-8 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="bd-kicker">Owner Brief</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">Today</h2>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">
                Updated {stats.updatedAt || "--:--"}
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <BriefItem label="Crew" value={`${stats.crewCount} active`} />
              <BriefItem label="Tasks" value={`${stats.completedTasks}/${stats.totalTasks} done`} />
              <BriefItem label="Documents" value={`${stats.documentCount} saved`} />
            </div>
          </div>

          <Link
            href={`/yachts/${yachtId}/reports`}
            className="bd-focus group rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl shadow-cyan-950/15 transition hover:-translate-y-0.5 hover:bg-cyan-950"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
              <Printer className="h-7 w-7" />
            </div>
            <h2 className="mt-6 text-3xl font-black">Owner Report</h2>
            <p className="mt-3 leading-7 text-slate-300">
              Owner-ready daily report and PDF export.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm font-black text-cyan-200">
              Open reports
              <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}

function daysUntil(dateString?: string | null) {
  if (!dateString) return null;
  const today = new Date();
  const expiry = new Date(dateString);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function OwnerButton({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="bd-focus inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-cyan-800"
    >
      <Icon className="h-5 w-5 text-cyan-300" />
      {label}
    </Link>
  );
}

function OwnerLine({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-cyan-700" />
        <span className="font-semibold text-slate-600">{label}</span>
      </div>
      <span className="text-right font-black text-slate-950">{value}</span>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-cyan-950/5">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <h2 className="mt-3 text-3xl font-black text-slate-950">{value}</h2>
    </div>
  );
}

function OwnerCard({
  icon: Icon,
  title,
  text,
  detail,
  href,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  detail: string;
  href: string;
  tone: "emerald" | "cyan" | "gold" | "rose";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
    gold: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
  };

  return (
    <Link
      href={href}
      className="bd-focus group rounded-[30px] border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/5 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-2xl hover:shadow-cyan-950/10"
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${tones[tone]}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="mt-6 text-3xl font-black text-slate-950">{title}</h2>
      <p className="mt-3 text-xl font-black text-slate-800">{text}</p>
      <p className="mt-2 leading-7 text-slate-600">{detail}</p>
      <div className="mt-6 flex items-center gap-2 text-sm font-black text-cyan-800">
        Open
        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
