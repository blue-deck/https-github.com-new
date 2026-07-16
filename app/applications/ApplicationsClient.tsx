"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Clock3,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type ApplicationStatus =
  | "applied"
  | "viewed"
  | "shortlisted"
  | "interview"
  | "reference_check"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

type JobApplication = {
  id: string;
  status: ApplicationStatus;
  cover_note?: string | null;
  created_at: string;
  updated_at?: string | null;
  job?: {
    id: string;
    slug: string;
    title: string;
    position?: string | null;
    department?: string | null;
    location?: string | null;
    employment_type?: string | null;
    employer_name?: string | null;
  } | null;
};

type ApplicationsResponse = {
  ok?: boolean;
  applications?: JobApplication[];
  data?: JobApplication[];
  available?: boolean;
  error?: string;
};

type WithdrawalResponse = {
  ok?: boolean;
  available?: boolean;
  error?: string;
  application?: {
    id?: string;
    status?: ApplicationStatus;
    updated_at?: string | null;
    withdrawn_at?: string | null;
  };
};

type Notice = {
  tone: "success" | "error";
  message: string;
};

const withdrawableStatuses: ApplicationStatus[] = [
  "applied",
  "viewed",
  "shortlisted",
  "interview",
  "reference_check",
  "offer",
];

const statusOrder: ApplicationStatus[] = [
  "applied",
  "viewed",
  "shortlisted",
  "interview",
  "reference_check",
  "offer",
  "hired",
];

const statusLabels: Record<ApplicationStatus, string> = {
  applied: "Applied",
  viewed: "Viewed",
  shortlisted: "Shortlisted",
  interview: "Interview",
  reference_check: "Reference check",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const applicationsLoginPath = `/login?next=${encodeURIComponent("/applications")}`;

export function ApplicationsClient() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmingWithdrawalId, setConfirmingWithdrawalId] = useState("");
  const [withdrawingId, setWithdrawingId] = useState("");
  const activeCount = useMemo(
    () =>
      applications.filter(
        (item) => !["rejected", "withdrawn", "hired"].includes(item.status),
      ).length,
    [applications],
  );

  useEffect(() => {
    let active = true;

    async function loadApplications() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.replace(applicationsLoginPath);
        return;
      }

      try {
        const response = await fetch("/api/applications", {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const payload = (await response.json()) as ApplicationsResponse;
        if (!active) return;

        if (!response.ok && response.status !== 503) {
          setNotice({
            tone: "error",
            message: payload.error || "Applications could not be loaded.",
          });
          return;
        }

        setAvailable(payload.available !== false);
        setApplications(
          Array.isArray(payload.applications)
            ? payload.applications
            : Array.isArray(payload.data)
              ? payload.data
              : [],
        );
      } catch {
        if (active) {
          setNotice({
            tone: "error",
            message: "Applications could not be loaded. Please try again.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadApplications();
    return () => {
      active = false;
    };
  }, []);

  async function withdrawApplication(applicationId: string) {
    setNotice(null);
    setWithdrawingId(applicationId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.replace(applicationsLoginPath);
        return;
      }

      const response = await fetch(
        `/api/applications/${encodeURIComponent(applicationId)}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status: "withdrawn" }),
        },
      );
      const payload = (await response.json()) as WithdrawalResponse;

      if (response.status === 401) {
        window.location.replace(applicationsLoginPath);
        return;
      }
      if (response.status === 503 || payload.available === false) {
        setAvailable(false);
        setNotice(null);
        return;
      }
      if (!response.ok) {
        throw new Error(
          payload.error || "The application could not be withdrawn.",
        );
      }

      const updatedAt =
        payload.application?.updated_at || new Date().toISOString();
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                status: "withdrawn",
                updated_at: updatedAt,
              }
            : application,
        ),
      );
      setConfirmingWithdrawalId("");
      setNotice({
        tone: "success",
        message:
          "Application withdrawn. The employer will no longer consider it active.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The application could not be withdrawn.",
      });
    } finally {
      setWithdrawingId("");
    }
  }

  if (loading) {
    return (
      <main className="bd-app-page bd-ocean-shell flex min-h-[70vh] items-center justify-center px-5 py-12">
        <div className="bd-ocean-content flex items-center gap-3 text-sm font-bold text-[#526b83]">
          <LoaderCircle className="h-5 w-5 animate-spin text-cyan-700" />
          Loading your applications...
        </div>
      </main>
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-7xl">
        <section className="bd-app-hero-dark">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
              BlueDeck career centre
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
              My applications
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/66">
              Track each yacht role from submission to interview, offer and onboarding.
            </p>
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-3 sm:min-w-72">
            <StatCard label="Total" value={applications.length} />
            <StatCard label="Active" value={activeCount} />
          </div>
        </section>

        {notice ? (
          <div
            role="status"
            aria-live="polite"
            className={`mt-6 flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm font-bold ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            {notice.tone === "success" ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
        ) : null}

        {!available ? (
          <section className="bd-glass-card mt-6 rounded-[28px] p-8 sm:p-10">
            <BriefcaseBusiness className="h-9 w-9 text-cyan-700" />
            <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-[#071f3c]">
              Application tracking is temporarily unavailable.
            </h2>
            <p className="mt-4 max-w-2xl leading-8 text-[#5b7088]">
              We could not securely load your application history just now. Your
              submissions remain protected and unchanged; please return shortly
              or continue exploring current yacht opportunities.
            </p>
            <Link href="/jobs" className="bd-primary-cta mt-7">
              Browse yacht jobs
              <Search className="h-5 w-5" />
            </Link>
          </section>
        ) : applications.length === 0 ? (
          <section className="bd-glass-card mt-6 rounded-[28px] p-8 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
              <BriefcaseBusiness className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-3xl font-black tracking-[-0.035em] text-[#071f3c]">
              Your next opportunity starts here.
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-8 text-[#5b7088]">
              You have not applied to a BlueDeck role yet. Complete your professional profile, then
              explore the live job board.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/jobs" className="bd-primary-cta">
                Find yacht jobs
                <Search className="h-5 w-5" />
              </Link>
              <Link href="/profile" className="bd-secondary-cta">
                Complete my profile
                <UserRoundCheck className="h-5 w-5" />
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-6 grid gap-5">
            {applications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                confirming={confirmingWithdrawalId === application.id}
                withdrawing={withdrawingId === application.id}
                onRequestWithdrawal={() => {
                  setNotice(null);
                  setConfirmingWithdrawalId(application.id);
                }}
                onCancelWithdrawal={() => setConfirmingWithdrawalId("")}
                onWithdraw={() => void withdrawApplication(application.id)}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/62">{label}</p>
      <p data-i18n-ignore className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function ApplicationCard({
  application,
  confirming,
  withdrawing,
  onRequestWithdrawal,
  onCancelWithdrawal,
  onWithdraw,
}: {
  application: JobApplication;
  confirming: boolean;
  withdrawing: boolean;
  onRequestWithdrawal: () => void;
  onCancelWithdrawal: () => void;
  onWithdraw: () => void;
}) {
  const job = application.job;
  const statusIndex = statusOrder.indexOf(application.status);
  const terminal = ["rejected", "withdrawn"].includes(application.status);
  const canWithdraw = withdrawableStatuses.includes(application.status);

  return (
    <article className="bd-glass-card-strong overflow-hidden rounded-[28px]">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={application.status} />
            <span data-i18n-ignore className="text-xs font-bold text-[#8293a4]">
              Applied {formatDate(application.created_at)}
            </span>
          </div>
          <h2
            data-i18n-ignore
            className="mt-5 break-words text-3xl font-black tracking-[-0.035em] text-[#071f3c] [overflow-wrap:anywhere]"
          >
            {job?.title || "Yacht position"}
          </h2>
          <p
            data-i18n-ignore
            className="mt-2 break-words font-bold text-cyan-800 [overflow-wrap:anywhere]"
          >
            {[job?.employer_name, job?.position, job?.department].filter(Boolean).join(" · ") ||
              "BlueDeck yacht employer"}
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-[#5b7088]">
            {job?.location ? (
              <span className="inline-flex min-w-0 max-w-full items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                <span
                  data-i18n-ignore
                  className="min-w-0 break-words [overflow-wrap:anywhere]"
                >
                  {job.location}
                </span>
              </span>
            ) : null}
            {job?.employment_type ? (
              <span className="inline-flex items-center gap-2">
                <BriefcaseBusiness className="h-4 w-4 text-cyan-700" />
                <span data-i18n-ignore>{humanize(job.employment_type)}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-cyan-700" />
              Updated <span data-i18n-ignore>{formatDate(application.updated_at || application.created_at)}</span>
            </span>
          </div>
        </div>

        {job?.slug ? (
          <Link
            href={`/jobs/${encodeURIComponent(job.slug)}`}
            className="bd-primary-cta shrink-0"
          >
            View role
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div className="border-t border-[#071f3c]/8 bg-[#f6f9fc]/78 px-6 py-5 sm:px-8">
        {terminal ? (
          <p className="flex items-center gap-3 text-sm font-bold text-[#6b7f95]">
            <Clock3 className="h-5 w-5" />
            This application is {statusLabels[application.status].toLowerCase()}.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
            {statusOrder.map((status, index) => {
              const complete = statusIndex >= index;
              return (
                <div key={status} className="min-w-0">
                  <div
                    className={`h-1.5 rounded-full ${
                      complete ? "bg-cyan-700" : "bg-[#dbe5ed]"
                    }`}
                  />
                  <p
                    className={`mt-2 truncate text-[9px] font-black uppercase tracking-[0.08em] ${
                      complete ? "text-cyan-800" : "text-[#8da0b1]"
                    }`}
                  >
                    {statusLabels[status]}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {canWithdraw ? (
          <div className="mt-5 border-t border-[#071f3c]/8 pt-4">
            {confirming ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-sm font-black text-[#071f3c]">
                      Withdraw this application?
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#65798d]">
                      This ends your candidacy for this role and cannot be
                      restored from this screen.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={onCancelWithdrawal}
                    disabled={withdrawing}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#071f3c]/12 bg-white px-4 text-xs font-black text-[#526b83] transition hover:border-cyan-500 hover:text-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Keep application
                  </button>
                  <button
                    type="button"
                    onClick={onWithdraw}
                    disabled={withdrawing}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-xs font-black text-white transition hover:bg-[#0d254f] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {withdrawing ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    {withdrawing ? "Withdrawing..." : "Yes, withdraw"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-[#8293a4]">
                  Plans changed? You can close your candidacy while the
                  application is active.
                </p>
                <button
                  type="button"
                  onClick={onRequestWithdrawal}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl px-3 text-xs font-black text-[#65798d] transition hover:bg-slate-100 hover:text-[#071f3c] sm:self-auto"
                >
                  <X className="h-4 w-4" />
                  Withdraw application
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const positive = ["shortlisted", "interview", "reference_check", "offer", "hired"].includes(status);
  const terminal = ["rejected", "withdrawn"].includes(status);
  const Icon = status === "hired" ? CheckCircle2 : CircleDot;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] ${
        positive
          ? "bg-emerald-50 text-emerald-800"
          : terminal
            ? "bg-slate-100 text-slate-600"
            : "bg-cyan-50 text-cyan-800"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {statusLabels[status]}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
