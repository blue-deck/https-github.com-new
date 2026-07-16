"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Languages,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Ship,
  Sparkles,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import { OptimizedSupabaseImage } from "../../../components/OptimizedSupabaseImage";
import { supabase } from "../../../lib/supabase";

const pipelineStatuses = [
  "applied",
  "viewed",
  "shortlisted",
  "interview",
  "reference_check",
  "offer",
  "hired",
] as const;

type PipelineStatus = (typeof pipelineStatuses)[number];
type ApplicationStatus =
  | PipelineStatus
  | "rejected"
  | "withdrawn";
type PipelineFilter = ApplicationStatus | "all";

const transitions: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  applied: ["viewed", "shortlisted", "rejected"],
  viewed: ["shortlisted", "interview", "rejected"],
  shortlisted: ["interview", "reference_check", "offer", "rejected"],
  interview: ["shortlisted", "reference_check", "offer", "rejected"],
  reference_check: ["interview", "offer", "rejected"],
  offer: ["hired", "rejected"],
  hired: [],
  rejected: [],
  withdrawn: [],
};

const statusLabels: Record<ApplicationStatus, string> = {
  applied: "New application",
  viewed: "Reviewed",
  shortlisted: "Shortlisted",
  interview: "Interview",
  reference_check: "Reference check",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const actionLabels: Partial<Record<ApplicationStatus, string>> = {
  viewed: "Mark reviewed",
  shortlisted: "Shortlist",
  interview: "Move to interview",
  reference_check: "Start reference check",
  offer: "Move to offer",
  hired: "Hire & prepare onboarding",
  rejected: "Mark not selected",
};

type PipelineJob = {
  id: string;
  title: string;
  position: string;
  department: string;
  status: string;
  yacht_id: string | null;
  yacht_name: string | null;
  created_at: string | null;
  published_at: string | null;
};

type PipelineEmployer = {
  id: string;
  display_name: string | null;
  company_name: string | null;
};

type Candidate = {
  id: string | null;
  public_crew_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  current_position: string | null;
  profile_photo_url: string | null;
  location: string | null;
  nationality: string | null;
  seeking_positions: string[];
  skills: string[];
  languages: string[];
};

type HiringApplication = {
  id: string;
  status: ApplicationStatus;
  cover_note: string | null;
  submitted_at: string | null;
  viewed_at: string | null;
  shortlisted_at: string | null;
  interview_at: string | null;
  offered_at: string | null;
  hired_at: string | null;
  rejected_at: string | null;
  withdrawn_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  candidate: Candidate;
};

type AccessState =
  | "ready"
  | "forbidden"
  | "missing"
  | "unavailable"
  | "error";

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

type PendingTransition = {
  applicationId: string;
  status: ApplicationStatus;
};

type Confirmation = PendingTransition & {
  candidateName: string;
};

type JsonRecord = Record<string, unknown>;
type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export function HiringPipelineClient({ jobId }: { jobId: string }) {
  const pipelinePath = `/hiring/jobs/${encodeURIComponent(jobId)}`;
  const pipelineLoginPath = `/login?next=${encodeURIComponent(pipelinePath)}`;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessState, setAccessState] = useState<AccessState>("ready");
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [employer, setEmployer] = useState<PipelineEmployer | null>(null);
  const [applications, setApplications] = useState<HiringApplication[]>([]);
  const [filter, setFilter] = useState<PipelineFilter>("all");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingTransition, setPendingTransition] =
    useState<PendingTransition | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [onboardingResults, setOnboardingResults] = useState<
    Record<string, string>
  >({});

  const loadPipeline = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          window.location.replace(pipelineLoginPath);
          return;
        }

        const response = await fetch(
          `/api/hiring/jobs/${encodeURIComponent(jobId)}/applications`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          },
        );
        const payload = await readPayload(response);

        if (response.status === 401) {
          window.location.replace(pipelineLoginPath);
          return;
        }
        if (response.status === 403) {
          setAccessState("forbidden");
          setNotice(null);
          return;
        }
        if (response.status === 404) {
          setAccessState("missing");
          setNotice(null);
          return;
        }
        if (response.status === 503 || payload.available === false) {
          setAccessState("unavailable");
          setNotice(null);
          return;
        }
        if (!response.ok) {
          throw new Error(
            payloadError(payload, "This hiring pipeline could not be loaded."),
          );
        }

        const normalizedJob = normalizeJob(payload.job);
        if (!normalizedJob) {
          throw new Error("The connected job summary is unavailable.");
        }

        setJob(normalizedJob);
        setEmployer(normalizeEmployer(payload.employer));
        setApplications(normalizeApplications(payload.applications));
        setAccessState("ready");
        setNotice(null);
      } catch (error) {
        setAccessState("error");
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "This hiring pipeline could not be loaded.",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [jobId, pipelineLoginPath],
  );

  useEffect(() => {
    void loadPipeline();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        window.location.replace(pipelineLoginPath);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadPipeline, pipelineLoginPath]);

  const counts = useMemo(() => {
    const next: Record<ApplicationStatus, number> = {
      applied: 0,
      viewed: 0,
      shortlisted: 0,
      interview: 0,
      reference_check: 0,
      offer: 0,
      hired: 0,
      rejected: 0,
      withdrawn: 0,
    };

    for (const application of applications) {
      next[application.status] += 1;
    }
    return next;
  }, [applications]);

  const visibleApplications = useMemo(
    () =>
      filter === "all"
        ? applications
        : applications.filter((application) => application.status === filter),
    [applications, filter],
  );

  const activeCount = useMemo(
    () =>
      applications.filter(
        (application) =>
          !["hired", "rejected", "withdrawn"].includes(application.status),
      ).length,
    [applications],
  );

  async function moveApplication(
    application: HiringApplication,
    nextStatus: ApplicationStatus,
  ) {
    if (!transitions[application.status].includes(nextStatus)) {
      setNotice({
        tone: "error",
        message: `${statusLabels[application.status]} cannot move to ${statusLabels[nextStatus]}.`,
      });
      return;
    }

    setPendingTransition({
      applicationId: application.id,
      status: nextStatus,
    });
    setNotice(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.replace(pipelineLoginPath);
        return;
      }

      const response = await fetch(
        `/api/hiring/applications/${encodeURIComponent(application.id)}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const payload = await readPayload(response);

      if (response.status === 401) {
        window.location.replace(pipelineLoginPath);
        return;
      }
      if (response.status === 403) {
        setAccessState("forbidden");
        return;
      }
      if (response.status === 503 || payload.available === false) {
        setAccessState("unavailable");
        return;
      }
      if (!response.ok) {
        throw new Error(
          payloadError(payload, "The candidate status could not be updated."),
        );
      }

      const updatedApplication = asRecord(payload.application);
      setApplications((current) =>
        current.map((item) =>
          item.id === application.id
            ? mergeApplicationUpdate(item, updatedApplication)
            : item,
        ),
      );

      if (nextStatus === "hired") {
        const onboarding = asRecord(payload.onboarding);
        const yachtId = optionalString(onboarding?.yacht_id);
        const invitationCreated = onboarding?.created === true;
        const onboardingMessage = yachtId
          ? invitationCreated
            ? "Candidate hired. BlueDeck prepared a new yacht invitation and invited membership for onboarding."
            : "Candidate hired. The existing yacht invitation and invited membership are ready for onboarding."
          : "Candidate hired. This role is not connected to an owned yacht, so no yacht onboarding invitation was created.";

        setOnboardingResults((current) => ({
          ...current,
          [application.id]: onboardingMessage,
        }));
        setNotice({ tone: "success", message: onboardingMessage });
      } else {
        setNotice({
          tone: "success",
          message: `${application.candidate.full_name} moved to ${statusLabels[nextStatus].toLowerCase()}.`,
        });
      }

      setConfirmation(null);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The candidate status could not be updated.",
      });
    } finally {
      setPendingTransition(null);
    }
  }

  function requestTransition(
    application: HiringApplication,
    nextStatus: ApplicationStatus,
  ) {
    if (nextStatus === "hired" || nextStatus === "rejected") {
      setConfirmation({
        applicationId: application.id,
        status: nextStatus,
        candidateName: application.candidate.full_name,
      });
      return;
    }

    void moveApplication(application, nextStatus);
  }

  if (loading) {
    return <PipelineLoading />;
  }

  if (accessState !== "ready" || !job) {
    return (
      <PipelineStatePage
        state={accessState}
        message={notice?.message}
        refreshing={refreshing}
        onRetry={() => void loadPipeline(true)}
      />
    );
  }

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen overflow-x-hidden px-4 py-8 text-slate-900 sm:px-8 lg:px-10 lg:py-10">
      <div className="bd-ocean-content mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/hiring"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#071f3c]/10 bg-white/80 px-4 text-sm font-black text-[#29445f] shadow-sm transition hover:border-cyan-400 hover:text-cyan-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Hiring desk
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
            <ShieldCheck className="h-4 w-4" />
            Private employer workspace
          </div>
        </div>

        <PipelineHero
          job={job}
          employer={employer}
          total={applications.length}
          active={activeCount}
          refreshing={refreshing}
          onRefresh={() => void loadPipeline(true)}
        />

        {notice ? <NoticeBanner notice={notice} /> : null}

        <section
          aria-labelledby="pipeline-heading"
          className="bd-glass-card-strong mt-6 overflow-hidden rounded-[28px]"
        >
          <div className="flex flex-col gap-4 border-b border-[#071f3c]/8 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-800">
                Candidate journey
              </p>
              <h2
                id="pipeline-heading"
                className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#071f3c]"
              >
                Hiring pipeline
              </h2>
            </div>
            {filter !== "all" ? (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#071f3c]/10 bg-white px-4 text-xs font-black text-[#29445f] transition hover:border-cyan-400 hover:text-cyan-800"
              >
                <X className="h-4 w-4" />
                Show all candidates
              </button>
            ) : (
              <p className="text-sm font-semibold text-[#6c8094]">
                Select a stage to filter the candidate list.
              </p>
            )}
          </div>

          <div className="overflow-x-auto px-5 py-6 sm:px-8">
            <ol className="flex min-w-max items-stretch gap-3">
              {pipelineStatuses.map((status, index) => (
                <li key={status} className="flex items-center gap-3">
                  <PipelineStage
                    status={status}
                    count={counts[status]}
                    active={filter === status}
                    onClick={() =>
                      setFilter((current) =>
                        current === status ? "all" : status,
                      )
                    }
                  />
                  {index < pipelineStatuses.length - 1 ? (
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#a2b1bf]" />
                  ) : null}
                </li>
              ))}
              <li className="ml-2 border-l border-[#071f3c]/10 pl-4">
                <PipelineStage
                  status="rejected"
                  count={counts.rejected}
                  active={filter === "rejected"}
                  onClick={() =>
                    setFilter((current) =>
                      current === "rejected" ? "all" : "rejected",
                    )
                  }
                />
              </li>
              {counts.withdrawn > 0 ? (
                <li>
                  <PipelineStage
                    status="withdrawn"
                    count={counts.withdrawn}
                    active={filter === "withdrawn"}
                    onClick={() =>
                      setFilter((current) =>
                        current === "withdrawn" ? "all" : "withdrawn",
                      )
                    }
                  />
                </li>
              ) : null}
            </ol>
          </div>
        </section>

        <section aria-labelledby="candidates-heading" className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-800">
                Protected applicant details
              </p>
              <h2
                id="candidates-heading"
                className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#071f3c]"
              >
                {filter === "all"
                  ? "All candidates"
                  : statusLabels[filter]}
              </h2>
            </div>
            <p
              data-i18n-ignore
              className="text-sm font-bold text-[#6c8094]"
            >
              {visibleApplications.length} of {applications.length} application
              {applications.length === 1 ? "" : "s"}
            </p>
          </div>

          {applications.length === 0 ? (
            <EmptyPipeline />
          ) : visibleApplications.length === 0 ? (
            <div className="bd-glass-card mt-5 rounded-[28px] p-8 text-center sm:p-12">
              <Users className="mx-auto h-9 w-9 text-cyan-700" />
              <h3 className="mt-5 text-2xl font-black tracking-[-0.03em] text-[#071f3c]">
                No candidates at this stage
              </h3>
              <p className="mx-auto mt-3 max-w-lg leading-7 text-[#60778d]">
                This filter has no applications. The full pipeline remains
                unchanged.
              </p>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="bd-secondary-cta mt-6"
              >
                Show all candidates
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-5">
              {visibleApplications.map((application) => (
                <CandidateCard
                  key={application.id}
                  application={application}
                  updating={
                    pendingTransition?.applicationId === application.id
                  }
                  pendingStatus={
                    pendingTransition?.applicationId === application.id
                      ? pendingTransition.status
                      : null
                  }
                  confirmation={
                    confirmation?.applicationId === application.id
                      ? confirmation
                      : null
                  }
                  onboardingResult={onboardingResults[application.id]}
                  onRequestTransition={(nextStatus) =>
                    requestTransition(application, nextStatus)
                  }
                  onCancelConfirmation={() => setConfirmation(null)}
                  onConfirmTransition={() => {
                    if (!confirmation) return;
                    void moveApplication(application, confirmation.status);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function PipelineHero({
  job,
  employer,
  total,
  active,
  refreshing,
  onRefresh,
}: {
  job: PipelineJob;
  employer: PipelineEmployer | null;
  total: number;
  active: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="bd-app-hero-dark">
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
            BlueDeck hiring pipeline
          </p>
          <JobStatusBadge status={job.status} />
        </div>
        <h1
          data-i18n-ignore
          className="mt-5 max-w-4xl break-words text-4xl font-black tracking-[-0.045em] text-white [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl"
        >
          {job.title}
        </h1>
        <p
          data-i18n-ignore
          className="mt-4 break-words text-base font-bold text-cyan-100/82 [overflow-wrap:anywhere] sm:text-lg"
        >
          {[job.position, job.department].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-white/66">
          {job.yacht_name ? (
            <span className="inline-flex min-w-0 max-w-full items-start gap-2">
              <Ship className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <span
                data-i18n-ignore
                className="min-w-0 break-words [overflow-wrap:anywhere]"
              >
                {job.yacht_name}
              </span>
            </span>
          ) : null}
          <span className="inline-flex min-w-0 max-w-full items-start gap-2">
            <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <span
              data-i18n-ignore
              className="min-w-0 break-words [overflow-wrap:anywhere]"
            >
              {employer?.display_name ||
                employer?.company_name ||
                "Private employer"}
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-cyan-300" />
            {job.published_at
              ? `Published ${formatDate(job.published_at)}`
              : `Created ${formatDate(job.created_at)}`}
          </span>
        </div>
      </div>

      <div className="relative z-10 w-full shrink-0 sm:w-auto">
        <div className="grid grid-cols-2 gap-3 sm:min-w-72">
          <HeroStat label="Applications" value={total} />
          <HeroStat label="Active" value={active} />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/16 bg-white/8 px-4 text-xs font-black text-white transition hover:bg-white/14 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing pipeline" : "Refresh pipeline"}
        </button>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/62">
        {label}
      </p>
      <p data-i18n-ignore className="mt-2 text-3xl font-black text-white">
        {value}
      </p>
    </div>
  );
}

function PipelineStage({
  status,
  count,
  active,
  onClick,
}: {
  status: ApplicationStatus;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const terminal = ["rejected", "withdrawn"].includes(status);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-24 w-36 rounded-2xl border p-4 text-left transition ${
        active
          ? terminal
            ? "border-rose-300 bg-rose-50 shadow-lg shadow-rose-900/8"
            : "border-cyan-500 bg-cyan-50 shadow-lg shadow-cyan-900/8"
          : "border-[#071f3c]/9 bg-white/82 hover:border-cyan-300 hover:bg-white"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span
          data-i18n-ignore
          className={`text-2xl font-black ${
            terminal ? "text-rose-800" : "text-[#071f3c]"
          }`}
        >
          {count}
        </span>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            terminal ? "bg-rose-500" : "bg-cyan-600"
          }`}
        />
      </span>
      <span
        className={`mt-3 block text-[10px] font-black uppercase tracking-[0.1em] ${
          terminal ? "text-rose-700" : "text-[#60778d]"
        }`}
      >
        {statusLabels[status]}
      </span>
    </button>
  );
}

function CandidateCard({
  application,
  updating,
  pendingStatus,
  confirmation,
  onboardingResult,
  onRequestTransition,
  onCancelConfirmation,
  onConfirmTransition,
}: {
  application: HiringApplication;
  updating: boolean;
  pendingStatus: ApplicationStatus | null;
  confirmation: Confirmation | null;
  onboardingResult?: string;
  onRequestTransition: (status: ApplicationStatus) => void;
  onCancelConfirmation: () => void;
  onConfirmTransition: () => void;
}) {
  const candidate = application.candidate;
  const allowedTransitions = transitions[application.status];
  const tags = uniqueStrings([
    ...candidate.seeking_positions,
    ...candidate.skills,
    ...candidate.languages,
  ]).slice(0, 9);

  return (
    <article className="bd-glass-card-strong overflow-hidden rounded-[28px]">
      <div className="grid min-w-0 gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-4">
            <CandidateAvatar candidate={candidate} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={application.status} />
                <span
                  data-i18n-ignore
                  className="text-xs font-bold text-[#8293a4]"
                >
                  Applied {formatDate(application.submitted_at || application.created_at)}
                </span>
              </div>
              <h3
                data-i18n-ignore
                className="mt-3 break-words text-2xl font-black tracking-[-0.035em] text-[#071f3c] sm:text-3xl"
              >
                {candidate.full_name}
              </h3>
              <p
                data-i18n-ignore
                className="mt-1 break-words font-bold text-cyan-800 [overflow-wrap:anywhere]"
              >
                {candidate.current_position || "Yacht crew candidate"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CandidateFact
              icon={MapPin}
              label="Location"
              value={
                [candidate.location, candidate.nationality]
                  .filter(Boolean)
                  .join(" · ") || "Not provided"
              }
            />
            <CandidateFact
              icon={Mail}
              label="Private email"
              value={candidate.email || "Not provided"}
              href={
                candidate.email
                  ? `mailto:${candidate.email}`
                  : undefined
              }
            />
            <CandidateFact
              icon={Phone}
              label="Private phone"
              value={candidate.phone || "Not provided"}
              href={
                candidate.phone
                  ? `tel:${candidate.phone.replace(/\s+/g, "")}`
                  : undefined
              }
            />
          </div>

          {tags.length ? (
            <div className="mt-6">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#7890a6]">
                <Languages className="h-4 w-4 text-cyan-700" />
                Role fit, skills and languages
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    data-i18n-ignore
                    className="max-w-full break-words rounded-full border border-cyan-100 bg-cyan-50/72 px-3 py-1.5 text-xs font-bold text-cyan-900 [overflow-wrap:anywhere]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-[#071f3c]/8 bg-[#f7f9fc]/82 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7890a6]">
                Candidate note
              </p>
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800">
                <ShieldCheck className="h-4 w-4" />
                Shared for this application
              </span>
            </div>
            <p
              data-i18n-ignore
              className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#506a82]"
            >
              {application.cover_note ||
                "The candidate did not add a cover note."}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-[#7890a6]">
            <span>
              Last updated{" "}
              <span data-i18n-ignore>
                {formatDate(application.updated_at || application.created_at)}
              </span>
            </span>
            {candidate.public_crew_id ? (
              <Link
                href={`/crew/${encodeURIComponent(candidate.public_crew_id)}`}
                className="inline-flex items-center gap-1.5 text-cyan-800 transition hover:text-cyan-600"
              >
                View public crew profile
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>

        <aside className="min-w-0 rounded-[24px] border border-[#071f3c]/9 bg-white/80 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#071f3c] text-cyan-200">
              <UserRoundCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7890a6]">
                Decision controls
              </p>
              <h4 className="mt-1 text-lg font-black text-[#071f3c]">
                Next allowed step
              </h4>
            </div>
          </div>

          {onboardingResult ? (
            <div
              role="status"
              className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900"
            >
              <CheckCircle2 className="mb-2 h-5 w-5" />
              {onboardingResult}
            </div>
          ) : null}

          {confirmation ? (
            <ConfirmationPanel
              confirmation={confirmation}
              updating={updating}
              onCancel={onCancelConfirmation}
              onConfirm={onConfirmTransition}
            />
          ) : allowedTransitions.length ? (
            <div className="mt-5 grid gap-2.5">
              {allowedTransitions.map((nextStatus) => {
                const terminal = nextStatus === "rejected";
                const hiring = nextStatus === "hired";
                const isPending = pendingStatus === nextStatus;

                return (
                  <button
                    key={nextStatus}
                    type="button"
                    disabled={updating}
                    onClick={() => onRequestTransition(nextStatus)}
                    className={`inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left text-xs font-black transition disabled:cursor-wait disabled:opacity-55 ${
                      hiring
                        ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
                        : terminal
                          ? "border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300"
                          : "border-[#071f3c]/10 bg-white text-[#173652] hover:border-cyan-400 hover:bg-cyan-50"
                    }`}
                  >
                    <span>{actionLabels[nextStatus]}</span>
                    {isPending ? (
                      <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                    ) : hiring ? (
                      <Sparkles className="h-4 w-4 shrink-0" />
                    ) : terminal ? (
                      <X className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-[#071f3c]/8 bg-[#f5f8fb] p-4 text-sm font-semibold leading-6 text-[#60778d]">
              {application.status === "hired"
                ? "Hiring is complete. Continue onboarding from the connected yacht workspace."
                : application.status === "rejected"
                  ? "This application is closed as not selected."
                  : "The candidate withdrew this application. No status actions are available."}
            </div>
          )}

          <div className="mt-5 border-t border-[#071f3c]/8 pt-5">
            <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-[#7890a6]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
              Contact details are private recruitment data. Use them only for
              this candidate&apos;s application.
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function CandidateAvatar({ candidate }: { candidate: Candidate }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = candidate.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white bg-gradient-to-br from-[#071f3c] to-cyan-700 text-lg font-black text-white shadow-lg shadow-slate-900/10 sm:h-20 sm:w-20">
      {candidate.profile_photo_url && !imageFailed ? (
        <OptimizedSupabaseImage
          src={candidate.profile_photo_url}
          alt={`${candidate.full_name} profile`}
          fill
          sizes="80px"
          delivery="square"
          className="object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span data-i18n-ignore>{initials || "BD"}</span>
      )}
    </div>
  );
}

function CandidateFact({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: IconType;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
      <span className="min-w-0">
        <span className="block text-[9px] font-black uppercase tracking-[0.13em] text-[#8da0b1]">
          {label}
        </span>
        <span
          data-i18n-ignore
          className="mt-1 block break-words text-sm font-bold text-[#29445f]"
        >
          {value}
        </span>
      </span>
    </>
  );

  return href ? (
    <a
      href={href}
      className="flex min-w-0 gap-3 rounded-xl border border-transparent p-3 transition hover:border-cyan-200 hover:bg-cyan-50/70"
    >
      {content}
    </a>
  ) : (
    <div className="flex min-w-0 gap-3 p-3">{content}</div>
  );
}

function ConfirmationPanel({
  confirmation,
  updating,
  onCancel,
  onConfirm,
}: {
  confirmation: Confirmation;
  updating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hiring = confirmation.status === "hired";

  return (
    <div
      role="alert"
      className={`mt-5 rounded-2xl border p-4 ${
        hiring
          ? "border-emerald-200 bg-emerald-50"
          : "border-rose-200 bg-rose-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {hiring ? (
          <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-800" />
        ) : (
          <CircleAlert className="h-5 w-5 shrink-0 text-rose-800" />
        )}
        <div className="min-w-0">
          <p
            className={`text-sm font-black ${
              hiring ? "text-emerald-950" : "text-rose-950"
            }`}
          >
            {hiring
              ? "Hire & prepare onboarding?"
              : "Mark this candidate as not selected?"}
          </p>
          <p
            data-i18n-ignore
            className={`mt-2 text-xs font-semibold leading-5 ${
              hiring ? "text-emerald-800" : "text-rose-800"
            }`}
          >
            {hiring
              ? `BlueDeck will mark ${confirmation.candidateName} as hired and prepare yacht onboarding when this role is connected to an owned yacht.`
              : `${confirmation.candidateName}'s application will close and cannot move to another stage from this pipeline.`}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={updating}
          onClick={onCancel}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-current/15 bg-white px-3 text-xs font-black text-[#29445f] disabled:opacity-55"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={updating}
          onClick={onConfirm}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black text-white disabled:cursor-wait disabled:opacity-55 ${
            hiring ? "bg-emerald-700" : "bg-rose-700"
          }`}
        >
          {updating ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : hiring ? (
            <Check className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
          {hiring ? "Confirm hire" : "Confirm decision"}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const style: Record<ApplicationStatus, string> = {
    applied: "bg-cyan-50 text-cyan-800",
    viewed: "bg-blue-50 text-blue-800",
    shortlisted: "bg-violet-50 text-violet-800",
    interview: "bg-amber-50 text-amber-900",
    reference_check: "bg-orange-50 text-orange-900",
    offer: "bg-emerald-50 text-emerald-800",
    hired: "bg-emerald-700 text-white",
    rejected: "bg-rose-50 text-rose-800",
    withdrawn: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${style[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const live = status === "published";

  return (
    <span
      data-i18n-ignore
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] ${
        live
          ? "border-emerald-300/30 bg-emerald-400/14 text-emerald-200"
          : "border-white/14 bg-white/8 text-white/72"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {humanize(status || "private")}
    </span>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  const style = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    info: "border-cyan-200 bg-cyan-50 text-cyan-900",
  }[notice.tone];
  const Icon =
    notice.tone === "success"
      ? CheckCircle2
      : notice.tone === "error"
        ? CircleAlert
        : ShieldCheck;

  return (
    <div
      role={notice.tone === "error" ? "alert" : "status"}
      className={`mt-6 flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm font-bold leading-6 ${style}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{notice.message}</span>
    </div>
  );
}

function EmptyPipeline() {
  return (
    <div className="bd-glass-card mt-5 rounded-[28px] p-8 text-center sm:p-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
        <Users className="h-8 w-8" />
      </div>
      <h3 className="mt-6 text-3xl font-black tracking-[-0.035em] text-[#071f3c]">
        No applications yet
      </h3>
      <p className="mx-auto mt-4 max-w-xl leading-8 text-[#60778d]">
        This role has not received an application. BlueDeck will show real
        candidates here as soon as they apply; no sample applicant data is
        generated.
      </p>
      <Link href="/hiring" className="bd-secondary-cta mt-7">
        Return to hiring desk
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </div>
  );
}

function PipelineLoading() {
  return (
    <main className="bd-app-page bd-ocean-shell flex min-h-[72vh] items-center justify-center px-5 py-12">
      <div className="bd-ocean-content flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-100 bg-white shadow-xl shadow-slate-900/8">
          <LoaderCircle className="h-7 w-7 animate-spin text-cyan-700" />
        </div>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.16em] text-[#526b83]">
          Loading protected candidate data
        </p>
      </div>
    </main>
  );
}

function PipelineStatePage({
  state,
  message,
  refreshing,
  onRetry,
}: {
  state: AccessState;
  message?: string;
  refreshing: boolean;
  onRetry: () => void;
}) {
  const content: Record<
    Exclude<AccessState, "ready">,
    {
      eyebrow: string;
      title: string;
      text: string;
      icon: IconType;
      retry: boolean;
    }
  > = {
    forbidden: {
      eyebrow: "Protected workspace",
      title: "This pipeline belongs to another employer account.",
      text: "BlueDeck did not expose any candidate or contact data. Return to your hiring desk to open a role owned by this account.",
      icon: ShieldAlert,
      retry: false,
    },
    missing: {
      eyebrow: "Job not found",
      title: "This hiring pipeline is unavailable.",
      text: "The job may have been removed, or the link may be incomplete. No application data was returned.",
      icon: BriefcaseBusiness,
      retry: false,
    },
    unavailable: {
      eyebrow: "Hiring service status",
      title: "This hiring pipeline is temporarily unavailable.",
      text: "We could not securely load candidate records just now. No hiring decisions or candidate information have been changed.",
      icon: ShieldCheck,
      retry: true,
    },
    error: {
      eyebrow: "Pipeline unavailable",
      title: "We could not load this hiring pipeline.",
      text:
        message ||
        "The request did not complete. Your candidate data has not been changed.",
      icon: CircleAlert,
      retry: true,
    },
  };
  const selected = content[state === "ready" ? "error" : state];
  const Icon = selected.icon;

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen px-4 py-8 text-slate-900 sm:px-8 lg:px-10">
      <div className="bd-ocean-content mx-auto max-w-5xl">
        <section className="bd-app-hero-dark">
          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
              {selected.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
              {selected.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/66">
              {selected.text}
            </p>
          </div>
          <div className="relative z-10 flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-white/12 bg-white/8 text-cyan-200">
            <Icon className="h-10 w-10" />
          </div>
        </section>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/hiring" className="bd-primary-cta">
            <ArrowLeft className="h-4 w-4" />
            Return to hiring desk
          </Link>
          {selected.retry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={refreshing}
              className="bd-secondary-cta"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Checking again" : "Try again"}
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function normalizeJob(value: unknown): PipelineJob | null {
  const row = asRecord(value);
  const id = requiredString(row?.id);
  const title = requiredString(row?.title);
  if (!row || !id || !title) return null;

  return {
    id,
    title,
    position: optionalString(row.position) || "Yacht crew",
    department: optionalString(row.department) || "Onboard",
    status: optionalString(row.status) || "private",
    yacht_id: optionalString(row.yacht_id),
    yacht_name: optionalString(row.yacht_name),
    created_at: optionalString(row.created_at),
    published_at: optionalString(row.published_at),
  };
}

function normalizeEmployer(value: unknown): PipelineEmployer | null {
  const row = asRecord(value);
  const id = requiredString(row?.id);
  if (!row || !id) return null;

  return {
    id,
    display_name: optionalString(row.display_name),
    company_name: optionalString(row.company_name),
  };
}

function normalizeApplications(value: unknown): HiringApplication[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeApplication(item))
    .filter((item): item is HiringApplication => Boolean(item));
}

function normalizeApplication(value: unknown): HiringApplication | null {
  const row = asRecord(value);
  const id = requiredString(row?.id);
  const status = normalizeStatus(row?.status);
  if (!row || !id || !status) return null;

  return {
    id,
    status,
    cover_note: optionalString(row.cover_note),
    submitted_at: optionalString(row.submitted_at),
    viewed_at: optionalString(row.viewed_at),
    shortlisted_at: optionalString(row.shortlisted_at),
    interview_at: optionalString(row.interview_at),
    offered_at: optionalString(row.offered_at),
    hired_at: optionalString(row.hired_at),
    rejected_at: optionalString(row.rejected_at),
    withdrawn_at: optionalString(row.withdrawn_at),
    created_at: optionalString(row.created_at),
    updated_at: optionalString(row.updated_at),
    candidate: normalizeCandidate(row.candidate),
  };
}

function normalizeCandidate(value: unknown): Candidate {
  const row = asRecord(value);
  return {
    id: optionalString(row?.id),
    public_crew_id: optionalString(row?.public_crew_id),
    full_name: optionalString(row?.full_name) || "BlueDeck candidate",
    email: optionalString(row?.email),
    phone: optionalString(row?.phone),
    current_position: optionalString(row?.current_position),
    profile_photo_url: optionalString(row?.profile_photo_url),
    location: optionalString(row?.location),
    nationality: optionalString(row?.nationality),
    seeking_positions: stringList(row?.seeking_positions),
    skills: stringList(row?.skills),
    languages: stringList(row?.languages),
  };
}

function mergeApplicationUpdate(
  current: HiringApplication,
  value: JsonRecord | null,
): HiringApplication {
  if (!value) return current;
  const status = normalizeStatus(value.status) || current.status;
  return {
    ...current,
    status,
    submitted_at: optionalString(value.submitted_at) || current.submitted_at,
    viewed_at: optionalString(value.viewed_at) || current.viewed_at,
    shortlisted_at:
      optionalString(value.shortlisted_at) || current.shortlisted_at,
    interview_at: optionalString(value.interview_at) || current.interview_at,
    offered_at: optionalString(value.offered_at) || current.offered_at,
    hired_at: optionalString(value.hired_at) || current.hired_at,
    rejected_at: optionalString(value.rejected_at) || current.rejected_at,
    updated_at: optionalString(value.updated_at) || current.updated_at,
  };
}

function normalizeStatus(value: unknown): ApplicationStatus | null {
  if (typeof value !== "string") return null;
  const status = value.trim().toLowerCase();
  return isApplicationStatus(status) ? status : null;
}

function isApplicationStatus(value: string): value is ApplicationStatus {
  return [
    ...pipelineStatuses,
    "rejected",
    "withdrawn",
  ].includes(value as ApplicationStatus);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value.flatMap((item) => {
      if (typeof item === "string") return [item];
      const row = asRecord(item);
      const label =
        optionalString(row?.label) ||
        optionalString(row?.name) ||
        optionalString(row?.language) ||
        optionalString(row?.title) ||
        optionalString(row?.skill);
      const level = optionalString(row?.level);
      return label ? [`${label}${level ? ` · ${level}` : ""}`] : [];
    }),
  );
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readPayload(response: Response): Promise<JsonRecord> {
  try {
    const payload = (await response.json()) as unknown;
    return asRecord(payload) || {};
  } catch {
    return {};
  }
}

function payloadError(payload: JsonRecord, fallback: string) {
  return optionalString(payload.error) || fallback;
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
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
