"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LoaderCircle,
  LogIn,
  MapPin,
  RefreshCw,
  Search,
  Ship,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useLanguage } from "../../components/LanguageProvider";
import {
  isJobApplicationStatus,
  type JobApplicationStatus,
} from "../../lib/jobApplications";
import {
  formatJobEmploymentType,
  formatJobListingNumber,
  isJobEmploymentType,
  isJobPostStatus,
  isSupportedJobListingNumber,
} from "../../lib/jobPosts";
import type {
  MyJobApplication,
  MyJobApplicationsResponse,
} from "../../lib/myJobApplications";
import { isMarketplaceAccountRole } from "../../lib/marketplaceCapabilities";
import { supabase } from "../../lib/supabase";

type PortalState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      role: MyJobApplicationsResponse["role"];
      eligible: boolean;
      applications: MyJobApplication[];
    };

export function MyJobApplicationsPortal() {
  const { language } = useLanguage();
  const c = copy[language];
  const [state, setState] = useState<PortalState>({ kind: "loading" });

  const loadApplications = useCallback(
    async (session: Session | null) => {
      if (!session?.access_token) {
        setState({ kind: "signed-out" });
        return;
      }

      setState({ kind: "loading" });
      try {
        const response = await fetch("/api/applications", {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => null);

        if (response.status === 401) {
          setState({ kind: "signed-out" });
          return;
        }
        if (!response.ok || !isApplicationsResponse(payload)) {
          const error =
            payload &&
            typeof payload === "object" &&
            typeof (payload as Record<string, unknown>).error === "string"
              ? (payload as Record<string, string>).error
              : c.loadError;
          throw new Error(error);
        }

        setState({
          kind: "ready",
          role: payload.role,
          eligible: payload.eligible,
          applications: payload.applications,
        });
      } catch (error) {
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : c.loadError,
        });
      }
    },
    [c.loadError],
  );

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) void loadApplications(data.session);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) void loadApplications(session);
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadApplications]);

  const metrics = useMemo(() => {
    if (state.kind !== "ready") return null;
    const active = state.applications.filter(
      (application) =>
        application.job.jobAvailability === "active" &&
        !["rejected", "withdrawn", "hired"].includes(application.status),
    ).length;
    const shortlisted = state.applications.filter(
      (application) => application.status === "shortlisted",
    ).length;
    const hired = state.applications.filter(
      (application) => application.status === "hired",
    ).length;
    return { total: state.applications.length, active, shortlisted, hired };
  }, [state]);

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 pb-20 pt-8 text-slate-900 sm:px-8 sm:pt-10 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[30px] border border-white/80 bg-white/95 shadow-2xl shadow-slate-950/8 backdrop-blur">
          <div className="bd-brand-rule h-0.5" />
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-11">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-800">
                <FileCheck2 className="h-3.5 w-3.5" aria-hidden />
                {c.eyebrow}
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-[#071f3c] sm:text-5xl">
                {c.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                {c.intro}
              </p>
            </div>
            <Link
              href="/jobs"
              className="bd-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#071f3c] px-5 text-sm font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-cyan-800"
            >
              <Search className="h-4 w-4" aria-hidden />
              {c.findJobs}
            </Link>
          </div>
        </section>

        {state.kind === "loading" ? (
          <PortalMessage
            icon={<LoaderCircle className="h-7 w-7 animate-spin" aria-hidden />}
            title={c.loading}
            body={c.loadingBody}
          />
        ) : null}

        {state.kind === "signed-out" ? (
          <PortalMessage
            icon={<LogIn className="h-7 w-7" aria-hidden />}
            title={c.signInTitle}
            body={c.signInBody}
            actions={
              <>
                <Link
                  href={`/login?next=${encodeURIComponent("/portal/applications")}`}
                  className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                >
                  <LogIn className="h-4 w-4" aria-hidden />
                  {c.signIn}
                </Link>
                <Link
                  href={`/login?mode=signup&role=crew&next=${encodeURIComponent("/portal/applications")}`}
                  className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-cyan-300 hover:text-cyan-800"
                >
                  <UserRoundPlus className="h-4 w-4" aria-hidden />
                  {c.createAccount}
                </Link>
              </>
            }
          />
        ) : null}

        {state.kind === "error" ? (
          <PortalMessage
            tone="error"
            icon={<AlertCircle className="h-7 w-7" aria-hidden />}
            title={c.errorTitle}
            body={state.message}
            actions={
              <button
                type="button"
                onClick={() =>
                  void supabase.auth
                    .getSession()
                    .then(({ data }) => loadApplications(data.session))
                }
                className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                {c.retry}
              </button>
            }
          />
        ) : null}

        {state.kind === "ready" && !state.eligible ? (
          <PortalMessage
            icon={<Ship className="h-7 w-7" aria-hidden />}
            title={c.publisherTitle}
            body={c.publisherBody}
            actions={
              <Link
                href="/hiring"
                className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
              >
                <BriefcaseBusiness className="h-4 w-4" aria-hidden />
                {c.manageJobs}
              </Link>
            }
          />
        ) : null}

        {state.kind === "ready" && state.eligible && metrics ? (
          <>
            <section
              className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
              aria-label={c.summaryLabel}
            >
              <MetricCard label={c.total} value={metrics.total} />
              <MetricCard
                label={c.active}
                value={metrics.active}
                accent="cyan"
              />
              <MetricCard
                label={c.shortlisted}
                value={metrics.shortlisted}
                accent="amber"
              />
              <MetricCard
                label={c.hired}
                value={metrics.hired}
                accent="emerald"
              />
            </section>

            {state.applications.length ? (
              <section
                className="mt-6 grid gap-4 xl:grid-cols-2"
                aria-label={c.listLabel}
              >
                {state.applications.map((application) => (
                  <ApplicationCard
                    key={application.id}
                    application={application}
                    language={language}
                  />
                ))}
              </section>
            ) : (
              <PortalMessage
                icon={<Sparkles className="h-7 w-7" aria-hidden />}
                title={c.emptyTitle}
                body={c.emptyBody}
                actions={
                  <Link
                    href="/jobs"
                    className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                  >
                    <Search className="h-4 w-4" aria-hidden />
                    {c.findJobs}
                  </Link>
                }
              />
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}

function ApplicationCard({
  application,
  language,
}: {
  application: MyJobApplication;
  language: "en" | "tr";
}) {
  const c = copy[language];
  const badge = statusPresentation(application.status, language);
  const listingAvailable = application.job.jobAvailability === "active";
  const availability = jobAvailabilityPresentation(
    application.job.jobAvailability,
    language,
  );
  const roleMeta = [
    application.job.department,
    formatJobEmploymentType(application.job.employmentType, language),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group flex min-h-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm shadow-slate-950/[0.04] transition hover:border-cyan-300 hover:shadow-md hover:shadow-slate-950/[0.06]">
      <div className="h-1 bg-gradient-to-r from-[#071f3c] via-cyan-700 to-cyan-300" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              data-i18n-ignore
              aria-label={`${c.listingNumber} ${formatJobListingNumber(application.job.listingNumber)}`}
              className="font-mono text-[11px] font-black tracking-[0.13em] text-cyan-800"
            >
              {formatJobListingNumber(application.job.listingNumber)}
            </span>
          </div>
          <div className="flex max-w-[72%] flex-wrap justify-end gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${badge.className}`}
            >
              {badge.icon}
              {badge.label}
            </span>
            {availability ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${availability.className}`}
              >
                {availability.icon}
                {availability.label}
              </span>
            ) : null}
          </div>
        </div>

        <h2
          data-i18n-ignore
          className="mt-4 text-[1.7rem] font-semibold leading-tight tracking-[-0.035em] text-[#071f3c]"
        >
          {application.job.title}
        </h2>
        <p
          data-i18n-ignore
          className="mt-1.5 text-sm font-semibold text-cyan-800"
        >
          {roleMeta}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-slate-100 py-4 text-sm">
          <ApplicationFact
            icon={<MapPin className="h-4 w-4" aria-hidden />}
            label={c.location}
            value={application.job.location}
            ignoreTranslation
          />
          <ApplicationFact
            icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            label={c.startDate}
            value={
              application.job.startDate
                ? formatDate(application.job.startDate, language)
                : c.flexible
            }
          />
          <ApplicationFact
            icon={<Clock3 className="h-4 w-4" aria-hidden />}
            label={c.appliedAt}
            value={formatDate(application.submittedAt, language)}
          />
          <ApplicationFact
            icon={<RefreshCw className="h-4 w-4" aria-hidden />}
            label={c.lastUpdate}
            value={formatDate(application.updatedAt, language)}
          />
        </dl>

        {application.status === "withdrawn" ? (
          <p className="mt-4 border-l-2 border-slate-300 pl-3 text-xs font-semibold leading-5 text-slate-500">
            {c.withdrawnHelp}
          </p>
        ) : null}

        <div className="mt-auto pt-4">
          {listingAvailable ? (
            <Link
              href={`/jobs/${encodeURIComponent(application.job.id)}`}
              className="bd-focus flex min-h-12 w-full items-center justify-between rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
            >
              {c.viewJob}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <div className="flex min-h-12 items-center gap-2 border-t border-slate-100 px-1 pt-3 text-xs font-semibold text-slate-500">
              <FileCheck2
                className="h-4 w-4 shrink-0 text-cyan-700"
                aria-hidden
              />
              {c.historyRetained}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ApplicationFact({
  icon,
  label,
  value,
  ignoreTranslation = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ignoreTranslation?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 text-cyan-700 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 sm:text-[10px]">
          {label}
        </dt>
        <dd
          data-i18n-ignore={ignoreTranslation ? true : undefined}
          className="mt-0.5 truncate text-xs font-semibold text-slate-800 sm:text-sm"
          title={value}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: number;
  accent?: "slate" | "cyan" | "amber" | "emerald";
}) {
  const accentClass = {
    slate: "border-slate-200 text-slate-700",
    cyan: "border-cyan-200 text-cyan-800",
    amber: "border-amber-200 text-amber-800",
    emerald: "border-emerald-200 text-emerald-800",
  }[accent];

  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm shadow-slate-950/[0.03] ${accentClass}`}
    >
      <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.13em] opacity-75">
        {label}
      </p>
    </div>
  );
}

function PortalMessage({
  icon,
  title,
  body,
  actions,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  actions?: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <section
      className={`mt-6 rounded-[26px] border bg-white/95 p-7 shadow-xl shadow-slate-950/5 sm:p-9 ${
        tone === "error" ? "border-rose-200" : "border-slate-200/80"
      }`}
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
          tone === "error"
            ? "bg-rose-50 text-rose-700"
            : "bg-cyan-50 text-cyan-800"
        }`}
      >
        {icon}
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-[#071f3c]">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{body}</p>
      {actions ? (
        <div className="mt-6 flex flex-wrap gap-3">{actions}</div>
      ) : null}
    </section>
  );
}

function statusPresentation(
  status: JobApplicationStatus,
  language: "en" | "tr",
) {
  const c = copy[language].statuses[status];
  const presentations: Record<
    JobApplicationStatus,
    { className: string; icon: React.ReactNode }
  > = {
    submitted: {
      className: "border-blue-200 bg-blue-50 text-blue-800",
      icon: <FileCheck2 className="h-3.5 w-3.5" aria-hidden />,
    },
    reviewing: {
      className: "border-cyan-200 bg-cyan-50 text-cyan-800",
      icon: <Clock3 className="h-3.5 w-3.5" aria-hidden />,
    },
    shortlisted: {
      className: "border-amber-200 bg-amber-50 text-amber-800",
      icon: <Sparkles className="h-3.5 w-3.5" aria-hidden />,
    },
    rejected: {
      className: "border-rose-200 bg-rose-50 text-rose-800",
      icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden />,
    },
    hired: {
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
    },
    withdrawn: {
      className: "border-slate-200 bg-slate-50 text-slate-600",
      icon: <RefreshCw className="h-3.5 w-3.5" aria-hidden />,
    },
  };

  return { label: c, ...presentations[status] };
}

function jobAvailabilityPresentation(
  availability: MyJobApplication["job"]["jobAvailability"],
  language: "en" | "tr",
) {
  const c = copy[language];
  if (availability === "active") return null;

  return {
    expired: {
      label: c.jobExpired,
      className: "border-amber-200 bg-amber-50 text-amber-800",
      icon: <Clock3 className="h-3.5 w-3.5" aria-hidden />,
    },
    cancelled: {
      label: c.jobCancelled,
      className: "border-rose-200 bg-rose-50 text-rose-800",
      icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden />,
    },
    unavailable: {
      label: c.jobUnavailable,
      className: "border-slate-200 bg-slate-50 text-slate-600",
      icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden />,
    },
  }[availability];
}

function formatDate(value: string, language: "en" | "tr") {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isApplicationsResponse(
  value: unknown,
): value is MyJobApplicationsResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    record.ok !== true ||
    !isMarketplaceAccountRole(record.role) ||
    typeof record.eligible !== "boolean" ||
    !Array.isArray(record.applications)
  ) {
    return false;
  }

  return record.applications.every(isMyJobApplication);
}

function isMyJobApplication(value: unknown): value is MyJobApplication {
  if (!value || typeof value !== "object") return false;
  const application = value as Record<string, unknown>;
  if (
    typeof application.id !== "string" ||
    typeof application.jobPostId !== "string" ||
    !isJobApplicationStatus(application.status) ||
    typeof application.submittedAt !== "string" ||
    typeof application.updatedAt !== "string" ||
    typeof application.version !== "number" ||
    !application.job ||
    typeof application.job !== "object"
  ) {
    return false;
  }

  const job = application.job as Record<string, unknown>;
  return (
    typeof job.id === "string" &&
    isSupportedJobListingNumber(job.listingNumber) &&
    typeof job.title === "string" &&
    typeof job.position === "string" &&
    typeof job.department === "string" &&
    isJobEmploymentType(job.employmentType) &&
    typeof job.location === "string" &&
    (job.startDate === null || typeof job.startDate === "string") &&
    isJobPostStatus(job.status) &&
    isJobAvailability(job.jobAvailability)
  );
}

function isJobAvailability(
  value: unknown,
): value is MyJobApplication["job"]["jobAvailability"] {
  return (
    typeof value === "string" &&
    ["active", "expired", "cancelled", "unavailable"].includes(value)
  );
}

const copy = {
  en: {
    eyebrow: "Crew career portal",
    title: "My job applications",
    intro:
      "Follow every yacht role you have applied for, from submission through the employer's latest decision.",
    findJobs: "Find more jobs",
    loading: "Loading your applications",
    loadingBody: "Your private application history is being securely prepared.",
    signInTitle: "Sign in to view your applications",
    signInBody:
      "Your application history is private and is available only from your own BlueDeck account.",
    signIn: "Sign in",
    createAccount: "Create Crew account",
    errorTitle: "Applications are temporarily unavailable",
    loadError: "Your applications could not be loaded.",
    retry: "Try again",
    publisherTitle: "This workspace is for Crew and Captain accounts",
    publisherBody:
      "Owner / Employer and Management accounts review candidates in My Job Postings & Hiring.",
    manageJobs: "My Job Postings & Hiring",
    summaryLabel: "Application summary",
    listLabel: "Your job applications",
    total: "Total",
    active: "In progress",
    shortlisted: "Shortlisted",
    hired: "Hired",
    emptyTitle: "Your next opportunity starts here",
    emptyBody:
      "You have not applied to a BlueDeck role yet. Explore current yacht opportunities and submit your first application.",
    location: "Location",
    listingNumber: "Job no.",
    startDate: "Start date",
    flexible: "Flexible",
    appliedAt: "Applied",
    lastUpdate: "Last update",
    withdrawnHelp:
      "You withdrew this application. It remains in your history for a clear record of your activity.",
    viewJob: "View job",
    historyRetained: "Application history retained",
    jobExpired: "Job expired",
    jobCancelled: "Job cancelled by advertiser",
    jobUnavailable: "Listing unavailable",
    statuses: {
      submitted: "Submitted",
      reviewing: "In review",
      shortlisted: "Shortlisted",
      rejected: "Not selected",
      hired: "Hired",
      withdrawn: "Withdrawn",
    },
  },
  tr: {
    eyebrow: "Crew kariyer portalı",
    title: "İş başvurularım",
    intro:
      "Başvuru yaptığınız tüm yat pozisyonlarını gönderimden ilan sahibinin son kararına kadar tek ekrandan takip edin.",
    findJobs: "Yeni ilanları gör",
    loading: "Başvurularınız yükleniyor",
    loadingBody: "Özel başvuru geçmişiniz güvenli şekilde hazırlanıyor.",
    signInTitle: "Başvurularınızı görmek için giriş yapın",
    signInBody:
      "Başvuru geçmişiniz özeldir ve yalnızca kendi BlueDeck hesabınızdan görüntülenebilir.",
    signIn: "Giriş yap",
    createAccount: "Crew hesabı oluştur",
    errorTitle: "Başvurular şu anda görüntülenemiyor",
    loadError: "Başvurularınız yüklenemedi.",
    retry: "Tekrar dene",
    publisherTitle: "Bu alan Crew ve Captain hesapları içindir",
    publisherBody:
      "Owner / Employer ve Management hesapları adayları İş İlanlarım ve İşe Alım alanından inceler.",
    manageJobs: "İş İlanlarım ve İşe Alım",
    summaryLabel: "Başvuru özeti",
    listLabel: "İş başvurularınız",
    total: "Toplam",
    active: "Devam eden",
    shortlisted: "Kısa liste",
    hired: "İşe alındı",
    emptyTitle: "Sıradaki fırsatınız burada başlıyor",
    emptyBody:
      "Henüz bir BlueDeck ilanına başvurmadınız. Güncel yat iş fırsatlarını inceleyip ilk başvurunuzu oluşturabilirsiniz.",
    location: "Konum",
    listingNumber: "İlan No",
    startDate: "İşe başlama",
    flexible: "Esnek",
    appliedAt: "Başvuru tarihi",
    lastUpdate: "Son güncelleme",
    withdrawnHelp:
      "Bu başvuruyu geri çektiniz. İşlem geçmişinizin net kalması için portalınızda gösterilmeye devam eder.",
    viewJob: "İlanı gör",
    historyRetained: "Başvuru geçmişi korunuyor",
    jobExpired: "İlanın süresi doldu",
    jobCancelled: "İlan sahibi iptal etti",
    jobUnavailable: "İlan görüntülenemiyor",
    statuses: {
      submitted: "Başvuruldu",
      reviewing: "İnceleniyor",
      shortlisted: "Kısa listede",
      rejected: "Uygun bulunmadı",
      hired: "İşe alındı",
      withdrawn: "Geri çekildi",
    },
  },
} as const;
