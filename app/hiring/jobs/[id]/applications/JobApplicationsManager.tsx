"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Send,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../../../components/LanguageProvider";
import {
  employerJobApplicationStatuses,
  isJobApplicationStatus,
  type EmployerJobApplication,
  type EmployerJobApplicationStatus,
  type JobApplicationJobSummary,
  type JobApplicationStatus,
} from "../../../../lib/jobApplications";
import {
  formatJobListingNumber,
  isSupportedJobListingNumber,
} from "../../../../lib/jobPosts";
import { supabase } from "../../../../lib/supabase";

type WorkspaceResponse = {
  ok?: boolean;
  error?: string;
  job?: unknown;
  total?: number;
  applications?: unknown[];
  application?: unknown;
};

type Filter = "all" | JobApplicationStatus;
type Notice = { tone: "success" | "error"; message: string };

export function JobApplicationsManager({ jobId }: { jobId: string }) {
  const { language } = useLanguage();
  const c = copy[language];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [job, setJob] = useState<JobApplicationJobSummary | null>(null);
  const [applications, setApplications] = useState<EmployerJobApplication[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  const selected = useMemo(
    () => applications.find((application) => application.id === selectedId) || null,
    [applications, selectedId],
  );
  const visibleApplications = useMemo(
    () =>
      filter === "all"
        ? applications
        : applications.filter((application) => application.status === filter),
    [applications, filter],
  );
  const counts = useMemo(() => {
    const result = new Map<JobApplicationStatus, number>();
    for (const application of applications) {
      result.set(application.status, (result.get(application.status) || 0) + 1);
    }
    return result;
  }, [applications]);

  useEffect(() => {
    let active = true;

    async function loadApplications() {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace(
          `/login?next=${encodeURIComponent(`/hiring/jobs/${jobId}/applications`)}`,
        );
        return;
      }

      try {
        const response = await fetch(
          `/api/employer/job-posts/${encodeURIComponent(jobId)}/applications`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );
        const payload = (await response
          .json()
          .catch(() => null)) as WorkspaceResponse | null;

        if (response.status === 401) {
          window.location.replace(
            `/login?next=${encodeURIComponent(`/hiring/jobs/${jobId}/applications`)}`,
          );
          return;
        }
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || c.loadError);
        }

        const parsedJob = parseJob(payload.job);
        const parsedApplications = Array.isArray(payload.applications)
          ? payload.applications
              .map(parseEmployerApplication)
              .filter((application) => application !== null)
          : [];
        if (!parsedJob || parsedApplications.length !== (payload.applications || []).length) {
          throw new Error(c.loadError);
        }

        if (!active) return;
        setJob(parsedJob);
        setApplications(parsedApplications);
        setSelectedId((current) =>
          parsedApplications.some((application) => application.id === current)
            ? current
            : parsedApplications[0]?.id || "",
        );
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : c.loadError);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadApplications();
    return () => {
      active = false;
    };
  }, [c.loadError, jobId, reloadVersion]);

  async function updateStatus(status: EmployerJobApplicationStatus) {
    if (!selected || updating) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.replace(
        `/login?next=${encodeURIComponent(`/hiring/jobs/${jobId}/applications`)}`,
      );
      return;
    }

    setUpdating(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/employer/job-posts/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status, version: selected.version }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as WorkspaceResponse | null;
      const updated = parseEmployerApplication(payload?.application);
      if (!response.ok || !payload?.ok || !updated) {
        throw new Error(payload?.error || c.updateError);
      }

      setApplications((current) =>
        current.map((application) =>
          application.id === updated.id ? updated : application,
        ),
      );
      setNotice({ tone: "success", message: c.updated });
    } catch (updateError) {
      setNotice({
        tone: "error",
        message:
          updateError instanceof Error ? updateError.message : c.updateError,
      });
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <CenteredState loading title={c.loading} />;
  }
  if (error || !job) {
    return (
      <CenteredState
        title={c.loadError}
        text={error}
        onRetry={() => setReloadVersion((current) => current + 1)}
      />
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen overflow-x-hidden px-5 pb-24 pt-8 text-slate-900 sm:px-8 sm:pt-10 lg:px-10">
      <div className="bd-ocean-content mx-auto w-full max-w-[1440px]">
        <section className="bd-page-hero relative overflow-hidden rounded-[34px] border border-slate-200 bg-white p-6 sm:p-8 lg:p-10">
          <div className="bd-brand-rule absolute inset-x-0 top-0 h-1.5" />
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/hiring/jobs"
                className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {c.back}
              </Link>
              <p className="bd-kicker mt-6">{c.eyebrow}</p>
              <h1 data-i18n-ignore className="bd-serif mt-4 text-4xl leading-none text-[#071f3c] sm:text-6xl">
                {job.title}
              </h1>
              <p data-i18n-ignore className="mt-3 text-lg font-black text-cyan-800">
                {job.position}
              </p>
              <p data-i18n-ignore className="mt-2 font-mono text-xs font-black tracking-[0.12em] text-slate-500">
                {formatJobListingNumber(job.listingNumber)}
              </p>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              <Metric label={c.total} value={applications.length} />
              <Metric
                label={c.shortlisted}
                value={counts.get("shortlisted") || 0}
              />
            </div>
          </div>

          {job.startDate ? (
            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-900">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {c.startDate}: {formatDate(job.startDate, language)}
            </div>
          ) : null}
        </section>

        <section className="mt-5 flex gap-2 overflow-x-auto pb-1" aria-label={c.filters}>
          <FilterButton
            active={filter === "all"}
            label={c.all}
            count={applications.length}
            onClick={() => setFilter("all")}
          />
          {(["submitted", "reviewing", "shortlisted", "hired"] as const).map(
            (status) => (
              <FilterButton
                key={status}
                active={filter === status}
                label={statusLabel(status, language)}
                count={counts.get(status) || 0}
                onClick={() => setFilter(status)}
              />
            ),
          )}
        </section>

        {applications.length === 0 ? (
          <section className="bd-glass-card-strong mt-6 rounded-[30px] p-8 text-center sm:p-14">
            <UsersRound className="mx-auto h-10 w-10 text-cyan-700" aria-hidden />
            <h2 className="mt-5 text-3xl font-semibold text-[#071f3c]">{c.empty}</h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
              {c.emptyText}
            </p>
          </section>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
            <aside className="bd-glass-card-strong overflow-hidden rounded-[28px] xl:sticky xl:top-28">
              <div className="border-b border-slate-200 p-5">
                <p className="bd-kicker">{c.candidates}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {visibleApplications.length} {c.results}
                </p>
              </div>
              <div className="max-h-[68vh] overflow-y-auto p-3">
                {visibleApplications.length === 0 ? (
                  <p className="p-5 text-sm leading-6 text-slate-500">
                    {c.noFilterResults}
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {visibleApplications.map((application) => (
                      <CandidateButton
                        key={application.id}
                        application={application}
                        language={language}
                        selected={application.id === selectedId}
                        onClick={() => {
                          setSelectedId(application.id);
                          setNotice(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </aside>

            {selected ? (
              <CandidateDetail
                application={selected}
                language={language}
                updating={updating}
                notice={notice}
                onUpdate={updateStatus}
              />
            ) : (
              <section className="bd-glass-card-strong rounded-[30px] p-8 text-center">
                <UserRound className="mx-auto h-9 w-9 text-cyan-700" aria-hidden />
                <p className="mt-4 font-black text-slate-700">{c.selectCandidate}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function CandidateDetail({
  application,
  language,
  updating,
  notice,
  onUpdate,
}: {
  application: EmployerJobApplication;
  language: "en" | "tr";
  updating: boolean;
  notice: Notice | null;
  onUpdate: (status: EmployerJobApplicationStatus) => void;
}) {
  const c = copy[language];
  const isFinal = ["rejected", "withdrawn", "hired"].includes(application.status);

  return (
    <article className="bd-glass-card-strong overflow-hidden rounded-[30px]">
      <div className="bd-brand-rule h-1.5" />
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <CandidateAvatar application={application} large />
            <div className="min-w-0">
              <h2 data-i18n-ignore className="truncate text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                {application.candidate.fullName}
              </h2>
              <p data-i18n-ignore className="mt-1 font-black text-cyan-800">
                {application.candidate.currentPosition || c.crewMember}
              </p>
            </div>
          </div>
          <StatusBadge status={application.status} language={language} />
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CandidateFact
            icon={<BriefcaseBusiness />}
            label={c.accountType}
            value={
              application.applicantRole === "captain" ? c.captain : c.crew
            }
          />
          <CandidateFact
            icon={<Clock3 />}
            label={c.applied}
            value={formatDateTime(application.submittedAt, language)}
          />
          {application.candidate.location ? (
            <CandidateFact
              icon={<MapPin />}
              label={c.location}
              value={application.candidate.location}
            />
          ) : null}
          {application.candidate.nationality ? (
            <CandidateFact
              icon={<Flag />}
              label={c.nationality}
              value={application.candidate.nationality}
            />
          ) : null}
        </div>

        <section className="mt-8 border-t border-slate-200 pt-7">
          <p className="bd-kicker">{c.profilePreview}</p>
          {application.candidate.seekingPositions.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {application.candidate.seekingPositions.map((position) => (
                <span
                  key={position}
                  data-i18n-ignore
                  className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-900"
                >
                  {position}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm italic text-slate-500">
              {c.noProfileSummary}
            </p>
          )}
        </section>

        <section className="mt-8 border-t border-slate-200 pt-7">
          <p className="bd-kicker">{c.candidateNote}</p>
          {application.privateNoteAvailable ? (
            <p className="mt-4 inline-flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-cyan-800" aria-hidden />
              {c.privateNoteReserved}
            </p>
          ) : (
            <p className="mt-4 text-sm italic text-slate-500">{c.noNote}</p>
          )}
        </section>

        <section className="mt-8 border-t border-slate-200 pt-7">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800">
              <Send className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-950">{c.decision}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isFinal ? c.finalStatus : c.decisionHelp}
              </p>
            </div>
          </div>

          {!isFinal ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {employerJobApplicationStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onUpdate(status)}
                  disabled={updating || application.status === status}
                  className={`bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    status === "hired"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : status === "rejected"
                        ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                        : "border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50"
                  }`}
                >
                  {updating ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  {statusLabel(status, language)}
                </button>
              ))}
            </div>
          ) : null}

          {notice ? (
            <p
              className={`mt-4 flex items-start gap-2 text-sm font-semibold leading-6 ${notice.tone === "success" ? "text-emerald-800" : "text-rose-700"}`}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.tone === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              )}
              {notice.message}
            </p>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#eef7fa)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#071f3c] text-cyan-100">
              <LockKeyhole className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-black text-slate-950">{c.fullProfileLocked}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {c.fullProfileLockedText}
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-xs leading-5 text-cyan-950">
          {c.privacyNote}
        </div>
      </div>
    </article>
  );
}

function CandidateButton({
  application,
  language,
  selected,
  onClick,
}: {
  application: EmployerJobApplication;
  language: "en" | "tr";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`bd-focus w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-cyan-300 bg-cyan-50/80 shadow-sm"
          : "border-transparent bg-white hover:border-slate-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <CandidateAvatar application={application} />
        <div className="min-w-0 flex-1">
          <p data-i18n-ignore className="truncate font-black text-slate-950">
            {application.candidate.fullName}
          </p>
          <p data-i18n-ignore className="mt-1 truncate text-xs font-semibold text-slate-500">
            {application.candidate.currentPosition || application.applicantRole}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <StatusBadge status={application.status} language={language} compact />
            <span className="text-[10px] font-semibold text-slate-400">
              {formatDate(application.submittedAt, language)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function CandidateAvatar({
  application,
  large = false,
}: {
  application: EmployerJobApplication;
  large?: boolean;
}) {
  const classes = large ? "h-16 w-16 text-xl" : "h-11 w-11 text-sm";
  if (application.candidate.profilePhotoUrl) {
    return (
      <span className={`${classes} relative flex shrink-0 overflow-hidden rounded-2xl bg-slate-100`}>
        <img
          src={application.candidate.profilePhotoUrl}
          alt={application.candidate.fullName}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span className={`${classes} flex shrink-0 items-center justify-center rounded-2xl bg-[#071f3c] font-black text-cyan-100`}>
      {initials(application.candidate.fullName)}
    </span>
  );
}

function CandidateFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-cyan-700 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
      </div>
      <p data-i18n-ignore className="mt-2 font-black text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({
  status,
  language,
  compact = false,
}: {
  status: JobApplicationStatus;
  language: "en" | "tr";
  compact?: boolean;
}) {
  const tones: Record<JobApplicationStatus, string> = {
    submitted: "border-sky-200 bg-sky-50 text-sky-800",
    reviewing: "border-amber-200 bg-amber-50 text-amber-800",
    shortlisted: "border-violet-200 bg-violet-50 text-violet-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-700",
    hired: "border-emerald-200 bg-emerald-50 text-emerald-800",
    withdrawn: "border-slate-200 bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex w-fit items-center rounded-full border font-black uppercase tracking-[0.1em] ${tones[status]} ${compact ? "px-2 py-1 text-[9px]" : "px-3 py-1.5 text-[10px]"}`}>
      {statusLabel(status, language)}
    </span>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bd-focus inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-black transition ${
        active
          ? "border-[#071f3c] bg-[#071f3c] text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300"
      }`}
    >
      {label}
      <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-white/15" : "bg-slate-100"}`}>
        {count}
      </span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-[#071f3c]">{value}</p>
    </div>
  );
}

function CenteredState({
  loading = false,
  title,
  text = "",
  onRetry,
}: {
  loading?: boolean;
  title: string;
  text?: string;
  onRetry?: () => void;
}) {
  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto flex min-h-[55vh] max-w-3xl items-center justify-center">
        <section className="bd-glass-card-strong w-full rounded-[30px] p-8 text-center sm:p-12">
          {loading ? (
            <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-cyan-700" aria-hidden />
          ) : (
            <AlertCircle className="mx-auto h-9 w-9 text-rose-600" aria-hidden />
          )}
          <h1 className="mt-5 text-3xl font-semibold text-[#071f3c]">{title}</h1>
          {text ? <p className="mt-3 leading-7 text-slate-600">{text}</p> : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="bd-focus mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Retry
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function parseJob(value: unknown): JobApplicationJobSummary | null {
  if (!isRecord(value)) return null;
  const status = value.status;
  if (
    typeof value.id !== "string" ||
    !isSupportedJobListingNumber(value.listingNumber) ||
    typeof value.title !== "string" ||
    typeof value.position !== "string" ||
    !["draft", "published", "closed"].includes(String(status))
  ) {
    return null;
  }
  return {
    id: value.id,
    listingNumber: value.listingNumber,
    title: value.title,
    position: value.position,
    startDate: typeof value.startDate === "string" ? value.startDate : null,
    status: status as JobApplicationJobSummary["status"],
  };
}

function parseEmployerApplication(value: unknown): EmployerJobApplication | null {
  if (!isRecord(value) || !isRecord(value.candidate)) return null;
  const status = value.status;
  const applicantRole = value.applicantRole;
  if (
    typeof value.id !== "string" ||
    typeof value.jobPostId !== "string" ||
    !isJobApplicationStatus(status) ||
    (applicantRole !== "crew" && applicantRole !== "captain") ||
    typeof value.submittedAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.version !== "number" ||
    typeof value.privateNoteAvailable !== "boolean" ||
    typeof value.candidate.fullName !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    jobPostId: value.jobPostId,
    status,
    coverNote: typeof value.coverNote === "string" ? value.coverNote : "",
    submittedAt: value.submittedAt,
    updatedAt: value.updatedAt,
    withdrawnAt: typeof value.withdrawnAt === "string" ? value.withdrawnAt : null,
    version: value.version,
    applicantRole,
    privateNoteAvailable: value.privateNoteAvailable,
    candidate: {
      fullName: value.candidate.fullName,
      profilePhotoUrl:
        typeof value.candidate.profilePhotoUrl === "string"
          ? value.candidate.profilePhotoUrl
          : "",
      currentPosition:
        typeof value.candidate.currentPosition === "string"
          ? value.candidate.currentPosition
          : "",
      location:
        typeof value.candidate.location === "string"
          ? value.candidate.location
          : "",
      nationality:
        typeof value.candidate.nationality === "string"
          ? value.candidate.nationality
          : "",
      seekingPositions: Array.isArray(value.candidate.seekingPositions)
        ? value.candidate.seekingPositions
            .filter((position): position is string => typeof position === "string")
            .slice(0, 3)
        : [],
    },
  };
}

function statusLabel(status: JobApplicationStatus, language: "en" | "tr") {
  const labels = {
    submitted: { en: "Submitted", tr: "Yeni" },
    reviewing: { en: "Reviewing", tr: "İnceleniyor" },
    shortlisted: { en: "Shortlisted", tr: "Kısa listede" },
    rejected: { en: "Rejected", tr: "Olumsuz" },
    hired: { en: "Hired", tr: "İşe alındı" },
    withdrawn: { en: "Withdrawn", tr: "Geri çekildi" },
  } as const;
  return labels[status][language];
}

function formatDate(value: string, language: "en" | "tr") {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string, language: "en" | "tr") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "BD";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const copy = {
  en: {
    loading: "Loading applications…",
    loadError: "Applications could not be loaded",
    updateError: "The application status could not be updated.",
    updated: "Application status updated.",
    back: "Back to job posts",
    eyebrow: "Candidate pipeline",
    total: "Applications",
    shortlisted: "Shortlisted",
    startDate: "Job start date",
    filters: "Application filters",
    all: "All",
    empty: "No applications yet",
    emptyText:
      "Candidates will appear here as soon as Crew or Captain accounts apply to this role.",
    candidates: "Candidates",
    results: "results",
    noFilterResults: "No candidates match this filter.",
    selectCandidate: "Select a candidate to review their application.",
    crewMember: "Yacht crew",
    accountType: "Account",
    captain: "Captain",
    crew: "Crew",
    applied: "Applied",
    location: "Location",
    nationality: "Nationality",
    profilePreview: "Professional profile preview",
    noProfileSummary: "This candidate has not added preferred positions yet.",
    candidateNote: "Candidate note",
    noNote: "The candidate applied without an additional note.",
    privateNoteReserved:
      "A private application note is saved. Its free-text content is reserved with the full candidate profile.",
    decision: "Application status",
    decisionHelp: "Move the candidate through a clear, private hiring pipeline.",
    finalStatus: "This application has reached a final status.",
    fullProfileLocked: "Full candidate profile is reserved",
    fullProfileLockedText:
      "Contact details, the private application note, documents, references and the detailed CV remain private. This access layer is ready for a future BlueDeck Hiring plan; no payment is required today.",
    privacyNote:
      "Only structured professional preview fields are shown here. Free-text profile content, private documents and references are not included.",
  },
  tr: {
    loading: "Başvurular yükleniyor…",
    loadError: "Başvurular yüklenemedi",
    updateError: "Başvuru durumu güncellenemedi.",
    updated: "Başvuru durumu güncellendi.",
    back: "İş ilanlarına dön",
    eyebrow: "Aday süreci",
    total: "Başvuru",
    shortlisted: "Kısa listede",
    startDate: "İşe başlama tarihi",
    filters: "Başvuru filtreleri",
    all: "Tümü",
    empty: "Henüz başvuru yok",
    emptyText:
      "Crew veya Captain hesapları bu ilana başvurduğunda adaylar burada görünecek.",
    candidates: "Adaylar",
    results: "sonuç",
    noFilterResults: "Bu filtreyle eşleşen aday yok.",
    selectCandidate: "Başvurusunu incelemek için bir aday seçin.",
    crewMember: "Yat mürettebatı",
    accountType: "Hesap",
    captain: "Captain",
    crew: "Crew",
    applied: "Başvuru tarihi",
    location: "Konum",
    nationality: "Uyruk",
    profilePreview: "Profesyonel profil özeti",
    noProfileSummary: "Aday henüz tercih ettiği pozisyonları eklememiş.",
    candidateNote: "Aday notu",
    noNote: "Aday ek bir not yazmadan başvurdu.",
    privateNoteReserved:
      "Özel başvuru notu kaydedildi. Serbest metin içeriği ayrıntılı aday profiliyle birlikte kilitli tutulur.",
    decision: "Başvuru durumu",
    decisionHelp: "Adayı sade ve özel işe alım sürecinde ilerletin.",
    finalStatus: "Bu başvuru nihai duruma ulaştı.",
    fullProfileLocked: "Ayrıntılı aday profili kilitli",
    fullProfileLockedText:
      "İletişim bilgileri, özel başvuru notu, belgeler, referanslar ve ayrıntılı CV gizli kalır. Bu erişim katmanı gelecekteki BlueDeck Hiring planı için hazırdır; bugün herhangi bir ödeme gerekmez.",
    privacyNote:
      "Burada yalnız yapılandırılmış profesyonel önizleme alanları gösterilir. Serbest profil metni, özel belgeler ve referanslar dahil edilmez.",
  },
} as const;
