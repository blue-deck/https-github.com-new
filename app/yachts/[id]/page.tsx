"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  FileText,
  Gauge,
  LifeBuoy,
  Map,
  RefreshCcw,
  ShieldCheck,
  Ship,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { BLUEDECK } from "../../config";
import { supabase } from "../../lib/supabase";

type OverviewStats = {
  crewCount: number;
  invitedCrew: number;
  checklistCount: number;
  openChecklists: number;
  completedTasks: number;
  totalTasks: number;
  documentCount: number;
  expiringDocuments: number;
  criticalDocuments: number;
  recent: ActivityItem[];
};

type ActivityItem = {
  title: string;
  text: string;
  date?: string | null;
  tone: "cyan" | "emerald" | "gold" | "rose";
};

type YachtRecord = {
  id: string;
  name?: string | null;
  model?: string | null;
  flag?: string | null;
  mmsi?: string | null;
};

const emptyStats: OverviewStats = {
  crewCount: 0,
  invitedCrew: 0,
  checklistCount: 0,
  openChecklists: 0,
  completedTasks: 0,
  totalTasks: 0,
  documentCount: 0,
  expiringDocuments: 0,
  criticalDocuments: 0,
  recent: [],
};

export default function YachtDashboard() {
  const params = useParams();
  const yachtId = String(params?.id || BLUEDECK.yachtId);
  const [yacht, setYacht] = useState<YachtRecord | null>(null);
  const [stats, setStats] = useState<OverviewStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  async function loadOverview(silent = false) {
    if (!silent) setLoading(true);
    setLoadError("");

    const [yachtResponse, crewResponse, checklistResponse, invitationResponse, documentResponse] =
      await Promise.all([
        supabase
          .from("yachts")
          .select("*")
          .eq("id", yachtId)
          .maybeSingle(),
        supabase
          .from("yacht_crew_memberships")
          .select(
            `
              id,
              status,
              position,
              department,
              invited_email,
              created_at,
              crew_profiles (
                full_name,
                email
              )
            `
          )
          .eq("yacht_id", yachtId)
          .order("created_at", { ascending: false }),
        supabase
          .from("yacht_checklists")
          .select(
            `
              id,
              title,
              status,
              department,
              created_at,
              yacht_checklist_items (
                id,
                completed,
                completed_at,
                task_text,
                completed_by
              )
            `
          )
          .eq("yacht_id", yachtId)
          .order("created_at", { ascending: false }),
        supabase
          .from("crew_invitations")
          .select("id,status,position,department,invited_email,created_at")
          .eq("yacht_id", yachtId)
          .order("created_at", { ascending: false }),
        supabase
          .from("yacht_documents")
          .select("id,title,file_name,category,expiry_date,created_at")
          .eq("yacht_id", yachtId)
          .order("created_at", { ascending: false }),
      ]);

    const errors = [crewResponse, checklistResponse, invitationResponse, documentResponse]
      .map((response) => response.error?.message)
      .filter(Boolean);

    if (errors.length) {
      setLoadError(errors[0] || "Overview data could not be loaded.");
    }

    const crew = crewResponse.data || [];
    const checklists = checklistResponse.data || [];
    const invitations = invitationResponse.data || [];
    const documents = documentResponse.data || [];
    const taskItems = checklists.flatMap((checklist: any) => checklist.yacht_checklist_items || []);
    const completedTasks = taskItems.filter((task: any) => task.completed).length;
    const pendingInvites = invitations.filter((item: any) => item.status === "pending").length;
    const expiringDocuments = documents.filter((item: any) => {
      const days = daysUntil(item.expiry_date);
      return days !== null && days >= 0 && days <= 90;
    }).length;
    const criticalDocuments = documents.filter((item: any) => {
      const days = daysUntil(item.expiry_date);
      return days !== null && days <= 30;
    }).length;

    const recent: ActivityItem[] = [
      ...crew.slice(0, 3).map((member: any) => ({
        title: member.crew_profiles?.full_name || member.invited_email || "Crew member",
        text: `${member.position || "Crew"} ${member.status === "invited" ? "invited" : "added"} to YACHT-OS`,
        date: member.created_at,
        tone: "cyan" as const,
      })),
      ...checklists.slice(0, 3).map((checklist: any) => ({
        title: checklist.title || "Checklist",
        text: `${checklist.department || "Operation"} checklist assigned`,
        date: checklist.created_at,
        tone: "emerald" as const,
      })),
      ...documents.slice(0, 2).map((document: any) => ({
        title: document.title || document.file_name || "Document",
        text: `${document.category || "Yacht"} document saved`,
        date: document.created_at,
        tone: "gold" as const,
      })),
    ]
      .sort((first, second) => new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime())
      .slice(0, 5);

    setStats({
      crewCount: crew.length,
      invitedCrew: pendingInvites,
      checklistCount: checklists.length,
      openChecklists: checklists.filter((item: any) => item.status !== "completed").length,
      completedTasks,
      totalTasks: taskItems.length,
      documentCount: documents.length,
      expiringDocuments,
      criticalDocuments,
      recent,
    });
    setYacht((yachtResponse.data as YachtRecord | null) || null);
    setUpdatedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
  }

  useEffect(() => {
    loadOverview();
    const interval = window.setInterval(() => loadOverview(true), 15000);
    return () => window.clearInterval(interval);
  }, [yachtId]);

  const taskProgress = stats.totalTasks
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const readinessScore = useMemo(() => {
    const crewScore = stats.crewCount > 0 ? 25 : 8;
    const taskScore = stats.totalTasks > 0 ? Math.round(taskProgress * 0.35) : 22;
    const documentScore = stats.documentCount > 0 ? 25 : 12;
    const alertPenalty = Math.min(stats.criticalDocuments * 8, 24);
    return Math.max(0, Math.min(99, crewScore + taskScore + documentScore + 25 - alertPenalty));
  }, [stats, taskProgress]);

  const readinessRows = [
    {
      label: "Crew",
      value: `${stats.crewCount} profile`,
      detail: stats.invitedCrew ? `${stats.invitedCrew} invitation waiting` : "Crew portal connected",
      tone: stats.crewCount ? "emerald" : "gold",
    },
    {
      label: "Checklists",
      value: `${taskProgress}% done`,
      detail: `${stats.completedTasks}/${stats.totalTasks} tasks completed`,
      tone: taskProgress >= 70 ? "emerald" : "cyan",
    },
    {
      label: "Documents",
      value: `${stats.documentCount} saved`,
      detail: stats.expiringDocuments ? `${stats.expiringDocuments} expiry alert inside 90 days` : "No active expiry pressure",
      tone: stats.criticalDocuments ? "rose" : "cyan",
    },
    {
      label: "YACHT-OS",
      value: "Live",
      detail: "Captain and crew modules are connected",
      tone: "emerald",
    },
  ] as const;

  const modules = [
    {
      title: "Crew Command",
      text: "Invite crew, review access and manage onboard roles.",
      href: `/yachts/${yachtId}/crew`,
      icon: Users,
      tone: "cyan",
      meta: `${stats.crewCount} crew`,
    },
    {
      title: "Contract Studio",
      text: "Create, save, preview and send seafarer employment agreements.",
      href: `/yachts/${yachtId}/contract-studio`,
      icon: FileSignature,
      tone: "gold",
      meta: "Annex A-D",
    },
    {
      title: "Checklist System",
      text: "Assign yacht checklists, review crew progress and inspect before/after proof.",
      href: `/yachts/${yachtId}/checklists`,
      icon: ClipboardList,
      tone: "emerald",
      meta: `${stats.openChecklists} open`,
    },
    {
      title: "Crew My YACHT-OS",
      text: "Crew accepts invitations and completes assigned checklist tasks here.",
      href: "/crew/tasks",
      icon: ClipboardCheck,
      tone: "emerald",
      meta: `${stats.completedTasks}/${stats.totalTasks} tasks`,
    },
    {
      title: "IMO Crew List",
      text: "Generate a printable crew list directly from saved profile data.",
      href: `/yachts/${yachtId}/imo-crew-list`,
      icon: FileSignature,
      tone: "gold",
      meta: "PDF ready",
    },
    {
      title: "Document Vault",
      text: "Upload yacht papers, certificates, insurance and contract files.",
      href: `/yachts/${yachtId}/documents`,
      icon: FileText,
      tone: "cyan",
      meta: `${stats.documentCount} files`,
    },
    {
      title: "Expiry Alerts",
      text: "Track expiring yacht papers and compliance documents before they become a problem.",
      href: `/yachts/${yachtId}/alerts`,
      icon: Bell,
      tone: stats.criticalDocuments ? "rose" : "emerald",
      meta: `${stats.criticalDocuments} critical`,
    },
    {
      title: "Engineering",
      text: "Technical systems, maintenance planning and onboard machinery readiness.",
      href: `/yachts/${yachtId}/engineering`,
      icon: Wrench,
      tone: "gold",
      meta: "Systems",
    },
    {
      title: "Safety Center",
      text: "Safety status, emergency readiness and operational protection checks.",
      href: `/yachts/${yachtId}/status`,
      icon: LifeBuoy,
      tone: "rose",
      meta: "Safety",
    },
  ] as const;

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden px-5 pb-32 pt-8 text-slate-950 sm:px-8 lg:px-10">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <div className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-white p-6 shadow-2xl shadow-cyan-950/10 sm:p-8 lg:p-10">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#083344,#22d3ee,#d6a84f,#ef776f)]" />
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="bd-kicker">Private Yacht Command</p>
                <h1 className="mt-4 max-w-4xl text-5xl font-black leading-[0.95] text-slate-950 sm:text-7xl">
                  {yacht?.name || BLUEDECK.yachtName}
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
                  Captain dashboard for crew invitations, duty proof, compliance
                  documents, IMO crew list and connected yacht operations.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-800">
                  Readiness
                </p>
                <p className="mt-1 text-3xl font-black text-slate-950">{readinessScore}%</p>
              </div>
              <PrimaryLink href={`/yachts/${yachtId}/crew`} icon={Users} label="Invite / Manage Crew" />
              <PrimaryLink href={`/yachts/${yachtId}/alerts`} icon={AlertTriangle} label="Open Alerts" />
              <button
                type="button"
                onClick={() => loadOverview()}
                className="bd-focus inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-800 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
              >
                <RefreshCcw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroMetric icon={Ship} label="Mode" value={BLUEDECK.mode} />
              <HeroMetric icon={Map} label="Flag" value={yacht?.flag || BLUEDECK.flag} />
              <HeroMetric icon={ShieldCheck} label="Privacy" value="Active" />
            </div>

            {loadError && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                {loadError}
              </div>
            )}
          </div>

          <div className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-2xl shadow-cyan-950/10 sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="bd-kicker">Today</p>
                <h2 className="mt-3 text-4xl font-black text-slate-950">Yacht Readiness</h2>
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  {updatedAt ? `Updated ${updatedAt}` : "Loading live yacht data"}
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-cyan-300">
                <Gauge className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-7 space-y-4">
              {readinessRows.map((item) => (
                <ReadinessRow key={item.label} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatusPanel
            icon={Users}
            title="Crew"
            value={String(stats.crewCount)}
            text={stats.invitedCrew ? `${stats.invitedCrew} pending invitation` : "Crew portal ready"}
            tone="cyan"
          />
          <StatusPanel
            icon={ClipboardCheck}
            title={`${stats.openChecklists} Open Checklist`}
            value={`${taskProgress}%`}
            text={`${stats.completedTasks} completed of ${stats.totalTasks} assigned tasks across ${stats.checklistCount} checklists`}
            tone="emerald"
          />
          <StatusPanel
            icon={FileText}
            title="Documents"
            value={String(stats.documentCount)}
            text={stats.expiringDocuments ? `${stats.expiringDocuments} expiry dates need attention` : "Vault organized"}
            tone="gold"
          />
          <StatusPanel
            icon={Bell}
            title="Critical"
            value={String(stats.criticalDocuments)}
            text={stats.criticalDocuments ? "Open alerts and update expiry dates" : "No critical document alert"}
            tone={stats.criticalDocuments ? "rose" : "emerald"}
          />
        </section>

        <section className="mt-10">
          <p className="bd-kicker">Connected Workspaces</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <ModuleLink key={module.title} {...module} />
            ))}
          </div>

          <div className="mt-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="bd-kicker">Recent Activity</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">Yacht Log</h2>
              </div>
              <CalendarDays className="h-7 w-7 text-cyan-700" />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {stats.recent.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                    No activity yet. Start by inviting crew or assigning a checklist.
                  </div>
                )}
                {stats.recent.map((item, index) => (
                  <ActivityLine key={`${item.title}-${index}`} item={item} />
                ))}
            </div>
          </div>
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

function formatDate(value?: string | null) {
  if (!value) return "Today";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <Icon className="h-5 w-5 text-cyan-700" />
      <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function PrimaryLink({
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

function ReadinessRow({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "cyan" | "emerald" | "gold" | "rose";
}) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    gold: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="font-black text-slate-950">{label}</p>
        <p className={`rounded-full border px-3 py-1 text-sm font-black ${tones[tone]}`}>
          {value}
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
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
  tone: "emerald" | "cyan" | "gold" | "rose";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
    gold: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-800 border-rose-200",
  };

  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-5 text-sm font-bold uppercase tracking-[0.12em] text-slate-500">{title}</p>
      <h3 className="mt-1 text-4xl font-black text-slate-950">{value}</h3>
      <p className="mt-3 leading-7 text-slate-600">{text}</p>
    </article>
  );
}

function ModuleLink({
  title,
  text,
  href,
  icon: Icon,
  tone,
  meta,
}: {
  title: string;
  text: string;
  href: string;
  icon: LucideIcon;
  tone: "emerald" | "cyan" | "gold" | "rose";
  meta: string;
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
      className="bd-focus group rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/5 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-2xl hover:shadow-cyan-950/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-13 w-13 items-center justify-center rounded-2xl border ${tones[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-slate-500">
          {meta}
        </span>
      </div>
      <h3 className="mt-6 text-2xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 leading-7 text-slate-600">{text}</p>
      <div className="mt-6 flex items-center gap-2 text-sm font-black text-cyan-800">
        Open module
        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function ActivityLine({ item }: { item: ActivityItem }) {
  const tones = {
    cyan: "bg-cyan-500",
    emerald: "bg-emerald-500",
    gold: "bg-amber-500",
    rose: "bg-rose-500",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-3 w-3 rounded-full ${tones[item.tone]}`} />
        <div className="min-w-0">
          <p className="font-black text-slate-950">{item.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            {formatDate(item.date)}
          </p>
        </div>
      </div>
    </div>
  );
}
