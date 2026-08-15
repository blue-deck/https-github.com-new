"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  FileText,
  Users,
  type LucideIcon,
} from "lucide-react";
import { loadAccountCapabilities } from "../../lib/accountCapabilities";
import {
  daysUntilExpiry,
  isInsideThreeMonthAlertWindow,
} from "../../lib/expiryAlerts";
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
};

type YachtModule = {
  title: string;
  text: string;
  href: string;
  icon: LucideIcon;
  tone: "cyan" | "emerald" | "gold" | "rose";
  meta: string;
};

type OverviewLoadState = "loading" | "ready" | "not-found" | "forbidden" | "error";

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string) {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

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
  const yachtId = String(params?.id || "").trim().toLowerCase();
  const [yacht, setYacht] = useState<YachtRecord | null>(null);
  const [stats, setStats] = useState<OverviewStats>(emptyStats);
  const [loadError, setLoadError] = useState("");
  const [loadState, setLoadState] = useState<OverviewLoadState>("loading");
  const [hasCrewWorkspace, setHasCrewWorkspace] = useState(false);
  const [reloadAttempt, setReloadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | undefined;
    let hasLoadedOverview = false;

    async function loadOverview(isBackgroundRefresh = false) {
      let shouldRefresh = false;

      if (!yachtId) {
        setYacht(null);
        setStats(emptyStats);
        setLoadError("This yacht link is invalid.");
        setLoadState("not-found");
        return;
      }

      if (!isBackgroundRefresh) {
        setYacht(null);
        setStats(emptyStats);
        setHasCrewWorkspace(false);
        setLoadError("");
        setLoadState("loading");
      }

      try {
        const {
          data: { session },
          error: sessionError,
        } = await withTimeout(
          supabase.auth.getSession(),
          12000,
          "Session verification timed out.",
        );

        if (!active) return;
        if (sessionError) throw sessionError;

        if (!session?.access_token) {
          window.location.replace(
            `/login?next=${encodeURIComponent(`/yachts/${yachtId}`)}`,
          );
          return;
        }

        const [
          crewDataResponse,
          invitationResponse,
          documentResponse,
          capabilities,
        ] = await withTimeout(
          Promise.all([
            fetch(`/api/yachts/${encodeURIComponent(yachtId)}/crew-data`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            }),
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
            loadAccountCapabilities().catch(() => null),
          ]),
          20000,
          "Yacht overview request timed out.",
        );

        if (!active) return;

        const crewPayload: unknown = await crewDataResponse.json().catch(() => null);
        if (!active) return;

        const crewRecord =
          crewPayload && typeof crewPayload === "object"
            ? (crewPayload as Record<string, unknown>)
            : {};
        const responseError =
          typeof crewRecord.error === "string" ? crewRecord.error : "";

        if (crewDataResponse.status === 401) {
          window.location.replace(
            `/login?next=${encodeURIComponent(`/yachts/${yachtId}`)}`,
          );
          return;
        }

        if (crewDataResponse.status === 404) {
          setYacht(null);
          setStats(emptyStats);
          setLoadError(responseError || "This yacht workspace could not be found.");
          setLoadState("not-found");
          return;
        }

        if (crewDataResponse.status === 403) {
          setYacht(null);
          setStats(emptyStats);
          setLoadError(responseError || "Your account does not have access to this yacht workspace.");
          setLoadState("forbidden");
          return;
        }

        if (!crewDataResponse.ok) {
          console.error("Yacht overview request failed", {
            status: crewDataResponse.status,
            error: responseError,
          });
          setYacht(null);
          setStats(emptyStats);
          setLoadError("The yacht overview could not be loaded. Please try again.");
          setLoadState("error");
          return;
        }

        const loadedYacht =
          crewRecord.yacht && typeof crewRecord.yacht === "object"
            ? (crewRecord.yacht as YachtRecord)
            : null;
        const loadedYachtId = String(loadedYacht?.id || "").trim().toLowerCase();

        if (!loadedYachtId || loadedYachtId !== yachtId) {
          console.error("Yacht overview response did not include the requested yacht record");
          setYacht(null);
          setStats(emptyStats);
          setLoadError("The yacht overview returned incomplete data. Please try again.");
          setLoadState("error");
          return;
        }

        const supplementalErrors = [invitationResponse, documentResponse]
          .map((response) => response.error?.message)
          .filter(Boolean);

        if (supplementalErrors.length) {
          console.error("Some yacht overview details could not be loaded", supplementalErrors);
        }

        const crew = Array.isArray(crewRecord.crew) ? crewRecord.crew : [];
        const checklists = Array.isArray(crewRecord.checklists)
          ? crewRecord.checklists
          : [];
        const invitations = invitationResponse.data || [];
        const documents = documentResponse.data || [];
        const taskItems = checklists.flatMap(
          (checklist: any) => checklist.yacht_checklist_items || [],
        );
        const completedTasks = taskItems.filter((task: any) => task.completed).length;
        const pendingInvites = invitations.filter((item: any) => item.status === "pending").length;
        const expiringDocuments = documents.filter((item: any) => {
          const days = daysUntilExpiry(item.expiry_date);
          return (
            days !== null &&
            days >= 0 &&
            isInsideThreeMonthAlertWindow(item.expiry_date)
          );
        }).length;
        const criticalDocuments = documents.filter((item: any) => {
          const days = daysUntilExpiry(item.expiry_date);
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
          .sort(
            (first, second) =>
              new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime(),
          )
          .slice(0, 5);

        setHasCrewWorkspace(capabilities?.canUseCrewWorkspace === true);
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
        setYacht({ ...loadedYacht, id: loadedYachtId });
        setLoadError(
          supplementalErrors.length
            ? "Some invitation or document details could not be refreshed."
            : "",
        );
        setLoadState("ready");
        hasLoadedOverview = true;
        shouldRefresh = true;
      } catch (error) {
        console.error("Yacht overview loading failed", error);
        if (!active) return;

        if (isBackgroundRefresh && hasLoadedOverview) {
          setLoadError("The latest yacht data could not be refreshed. Your current overview is still shown.");
          shouldRefresh = true;
          return;
        }

        setYacht(null);
        setStats(emptyStats);
        setLoadError("The yacht workspace could not be loaded. Check your connection and try again.");
        setLoadState("error");
      } finally {
        if (active && shouldRefresh) {
          refreshTimer = window.setTimeout(() => {
            void loadOverview(true);
          }, 15000);
        }
      }
    }

    void loadOverview();

    return () => {
      active = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    };
  }, [reloadAttempt, yachtId]);

  if (
    loadState === "loading" ||
    (loadState === "ready" && yacht !== null && yacht.id !== yachtId)
  ) {
    return (
      <YachtOverviewState
        state="loading"
        title="Loading yacht workspace..."
        text="Verifying access and preparing the latest yacht operations data."
      />
    );
  }

  if (loadState !== "ready") {
    const copyByState: Record<
      Exclude<OverviewLoadState, "loading" | "ready">,
      { title: string; text: string }
    > = {
      "not-found": {
        title: "Yacht workspace not found",
        text: loadError || "This link may be invalid or the yacht may no longer be available.",
      },
      forbidden: {
        title: "You do not have access to this yacht",
        text: loadError || "Ask the registered yacht owner to confirm your access.",
      },
      error: {
        title: "Yacht workspace unavailable",
        text: loadError || "The workspace could not be loaded. Please try again.",
      },
    };
    const copy = copyByState[loadState];

    return (
      <YachtOverviewState
        state={loadState}
        title={copy.title}
        text={copy.text}
        onRetry={loadState === "error" ? () => setReloadAttempt((current) => current + 1) : undefined}
      />
    );
  }

  if (!yacht) {
    return (
      <YachtOverviewState
        state="error"
        title="Yacht workspace unavailable"
        text="The yacht overview returned incomplete data. Please try again."
        onRetry={() => setReloadAttempt((current) => current + 1)}
      />
    );
  }

  const taskProgress = stats.totalTasks
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const crewWorkspaceModules: YachtModule[] = hasCrewWorkspace
    ? [
        {
          title: "Crew My YACHT-OS",
          text: "Crew accepts invitations and completes assigned checklist tasks here.",
          href: "/crew/tasks",
          icon: ClipboardCheck,
          tone: "emerald",
          meta: `${stats.completedTasks}/${stats.totalTasks} tasks`,
        },
      ]
    : [];

  const modules: YachtModule[] = [
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
    ...crewWorkspaceModules,
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
  ];

  return (
    <main className="bd-app-page bd-page-gutter min-h-screen min-w-0 overflow-x-hidden px-5 pb-32 pt-8 text-slate-950 sm:px-8 lg:px-10">
      <div className="bd-page-frame mx-auto w-full min-w-0 max-w-7xl">
        <section className="min-w-0">
          <div className="bd-page-hero relative overflow-hidden rounded-[36px] border border-slate-200 bg-white p-6 shadow-2xl shadow-cyan-950/10 sm:p-8 lg:p-10">
            <div className="bd-brand-rule absolute inset-x-0 top-0 h-1.5" />
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="bd-kicker">Private Yacht Command</p>
                <h1 className="mt-4 max-w-4xl text-5xl font-black leading-[0.95] text-slate-950 sm:text-7xl">
                  {yacht.name || "Unnamed yacht"}
                </h1>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
                  Captain dashboard for crew invitations, duty proof, compliance
                  documents, IMO crew list and connected yacht operations.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href={`/yachts/${yachtId}/crew`} icon={Users} label="Invite / Manage Crew" />
            </div>

            {loadError && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
                {loadError}
              </div>
            )}
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

          <div className="bd-app-card mt-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/5">
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

function YachtOverviewState({
  state,
  title,
  text,
  onRetry,
}: {
  state: Exclude<OverviewLoadState, "ready">;
  title: string;
  text: string;
  onRetry?: () => void;
}) {
  const loading = state === "loading";

  return (
    <main
      className="bd-app-page min-h-screen px-5 py-12 text-slate-950 sm:px-8 lg:px-10"
      aria-busy={loading || undefined}
    >
      <div
        className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white p-7 shadow-xl shadow-cyan-950/5 sm:p-10"
        role={state === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        <p className="bd-kicker">Private Yacht Command</p>
        <h1 className="mt-4 text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">{text}</p>

        {!loading ? (
          <div className="mt-7 flex flex-wrap gap-3">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="bd-focus rounded-2xl bg-slate-950 px-5 py-3 font-black text-white transition hover:bg-cyan-800"
              >
                Try again
              </button>
            ) : null}
            <Link
              href="/yachts"
              className="bd-focus rounded-2xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-800 transition hover:border-cyan-400"
            >
              Back to fleet
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Today";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
    <article className="bd-app-card rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/5">
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
      className="bd-focus bd-app-card group rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/5 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-2xl hover:shadow-cyan-950/10"
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
