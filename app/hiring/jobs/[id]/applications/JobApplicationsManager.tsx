"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Send,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CrewCandidateEmployerProfileOverview,
  CrewCandidatePassportCard,
  CrewCandidateProfileBody,
  CrewCandidateProfileIdentity,
  SectionHeading,
} from "../../../../components/CrewCandidatePresentation";
import { useLanguage } from "../../../../components/LanguageProvider";
import {
  employerJobApplicationStatuses,
  isJobApplicationMode,
  isJobApplicationJobAvailability,
  isJobApplicationStatus,
  type EmployerJobApplication,
  type EmployerJobApplicationDetails,
  type EmployerJobApplicationStatus,
  type JobApplicationJobAvailability,
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
  nextCursor?: string | null;
  hasMore?: boolean;
  applications?: unknown[];
  application?: unknown;
  details?: unknown;
  refreshRequired?: boolean;
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
  const [totalApplications, setTotalApplications] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileDetails, setProfileDetails] =
    useState<EmployerJobApplicationDetails | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const profileRequestRef = useRef<AbortController | null>(null);
  const initialLoadCompleteRef = useRef(false);

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
      const isInitialLoad = !initialLoadCompleteRef.current;
      if (isInitialLoad) {
        setLoading(true);
        setError("");
      }

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
        if (
          !parsedJob ||
          parsedApplications.length !== (payload.applications || []).length ||
          typeof payload.total !== "number" ||
          !Number.isSafeInteger(payload.total) ||
          payload.total < parsedApplications.length ||
          typeof payload.hasMore !== "boolean" ||
          !isApplicationCursor(payload.nextCursor, payload.hasMore) ||
          (payload.hasMore && parsedApplications.length === 0)
        ) {
          throw new Error(c.loadError);
        }

        if (!active) return;
        initialLoadCompleteRef.current = true;
        setJob(parsedJob);
        setApplications(parsedApplications);
        setTotalApplications(payload.total);
        setNextCursor(payload.nextCursor || null);
        setHasMore(payload.hasMore);
        setSelectedId((current) =>
          parsedApplications.some((application) => application.id === current)
            ? current
            : "",
        );
      } catch (loadError) {
        if (!active) return;
        if (isInitialLoad) {
          setError(loadError instanceof Error ? loadError.message : c.loadError);
        }
      } finally {
        if (active && isInitialLoad) setLoading(false);
      }
    }

    void loadApplications();
    return () => {
      active = false;
    };
  }, [c.loadError, jobId, reloadVersion]);

  useEffect(() => {
    function refreshVisibleWorkspace() {
      if (document.visibilityState === "visible") {
        setReloadVersion((current) => current + 1);
      }
    }

    const interval = window.setInterval(refreshVisibleWorkspace, 15_000);
    window.addEventListener("focus", refreshVisibleWorkspace);
    document.addEventListener("visibilitychange", refreshVisibleWorkspace);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisibleWorkspace);
      document.removeEventListener("visibilitychange", refreshVisibleWorkspace);
    };
  }, [jobId]);

  async function loadMoreApplications() {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    setNotice(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoadingMore(false);
      window.location.replace(
        `/login?next=${encodeURIComponent(`/hiring/jobs/${jobId}/applications`)}`,
      );
      return;
    }

    try {
      const requestedCursor = nextCursor;
      const response = await fetch(
        `/api/employer/job-posts/${encodeURIComponent(jobId)}/applications?cursor=${encodeURIComponent(requestedCursor)}`,
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
      const page = Array.isArray(payload?.applications)
        ? payload.applications
            .map(parseEmployerApplication)
            .filter((application) => application !== null)
        : [];
      if (
        !response.ok ||
        !payload?.ok ||
        page.length !== (payload.applications || []).length ||
        typeof payload.total !== "number" ||
        !Number.isSafeInteger(payload.total) ||
        payload.total < page.length ||
        typeof payload.hasMore !== "boolean" ||
        !isApplicationCursor(payload.nextCursor, payload.hasMore) ||
        (payload.hasMore &&
          (page.length === 0 || payload.nextCursor === requestedCursor))
      ) {
        throw new Error(payload?.error || c.loadError);
      }

      setApplications((current) => {
        const byId = new Map(current.map((application) => [application.id, application]));
        for (const application of page) byId.set(application.id, application);
        return Array.from(byId.values());
      });
      setTotalApplications(payload.total);
      setNextCursor(payload.nextCursor || null);
      setHasMore(payload.hasMore);
    } catch (loadError) {
      setNotice({
        tone: "error",
        message: loadError instanceof Error ? loadError.message : c.loadError,
      });
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!profileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeProfile();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [profileOpen]);

  useEffect(
    () => () => {
      profileRequestRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!profileOpen || selected) return;
    profileRequestRef.current?.abort();
    profileRequestRef.current = null;
    setProfileOpen(false);
    setProfileLoading(false);
    setProfileError("");
    setProfileDetails(null);
    setSelectedMemberId("");
  }, [profileOpen, selected]);

  async function openProfile(
    application: EmployerJobApplication,
    memberId = application.members.find((member) => member.isPrimary)?.id || "",
  ) {
    if (!memberId) return;
    profileRequestRef.current?.abort();
    const controller = new AbortController();
    profileRequestRef.current = controller;

    setSelectedId(application.id);
    setNotice(null);
    setProfileOpen(true);
    setProfileLoading(true);
    setProfileError("");
    setProfileDetails(null);
    setSelectedMemberId(memberId);

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
        `/api/employer/job-posts/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(application.id)}?member=${encodeURIComponent(memberId)}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
          signal: controller.signal,
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as WorkspaceResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || c.profileLoadError);
      }

      const parsedDetails = parseCandidateDetails(payload.details);
      if (
        !parsedDetails ||
        parsedDetails.applicationId !== application.id ||
        parsedDetails.memberId !== memberId
      ) {
        throw new Error(c.profileLoadError);
      }
      if (!controller.signal.aborted) setProfileDetails(parsedDetails);
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setProfileError(
        loadError instanceof Error ? loadError.message : c.profileLoadError,
      );
    } finally {
      if (!controller.signal.aborted) setProfileLoading(false);
    }
  }

  function closeProfile() {
    profileRequestRef.current?.abort();
    profileRequestRef.current = null;
    setProfileOpen(false);
    setProfileLoading(false);
    setProfileError("");
    setSelectedMemberId("");
  }

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
      if (response.ok && payload?.ok && payload.refreshRequired === true) {
        setNotice({ tone: "success", message: c.updated });
        setReloadVersion((current) => current + 1);
        return;
      }
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
    <>
      <main
        className="bd-app-page bd-ocean-shell bd-page-gutter min-h-screen overflow-x-hidden px-4 pb-24 pt-6 text-slate-900 sm:px-8 sm:pt-10 lg:px-10"
        aria-hidden={profileOpen ? true : undefined}
        inert={profileOpen ? true : undefined}
      >
        <div className="bd-ocean-content bd-page-frame mx-auto w-full max-w-[1440px]">
          <section className="bd-page-hero relative overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 sm:rounded-[34px] sm:p-8 lg:p-10">
          <div className="bd-brand-rule absolute inset-x-0 top-0 h-1.5" />
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                href="/hiring"
                className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {c.back}
              </Link>
              <p className="bd-kicker mt-6">{c.eyebrow}</p>
              <h1
                data-i18n-ignore
                className="bd-serif mt-4 text-4xl leading-none text-[#071f3c] sm:text-6xl"
              >
                {job.position || job.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <p
                  data-i18n-ignore
                  className="font-mono text-xs font-black tracking-[0.12em] text-slate-500"
                >
                  {formatJobListingNumber(job.listingNumber)}
                </p>
                <ListingAvailabilityBadge
                  availability={job.availability}
                  language={language}
                />
              </div>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              <Metric label={c.total} value={totalApplications} />
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

        <section
          className="mt-5 flex gap-2 overflow-x-auto pb-1"
          aria-label={c.filters}
        >
          <FilterButton
            active={filter === "all"}
            label={c.all}
            count={totalApplications}
            onClick={() => setFilter("all")}
          />
          {([
            "submitted",
            "reviewing",
            "shortlisted",
            "rejected",
            "hired",
          ] as const).map(
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
            <h2 className="mt-5 text-3xl font-semibold text-[#071f3c]">
              {c.empty}
            </h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
              {c.emptyText}
            </p>
          </section>
        ) : (
          <section className="mt-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
              <div>
                <h2 className="bd-kicker">{c.candidates}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {visibleApplications.length} {c.results}
                </p>
              </div>
              <p className="max-w-lg text-right text-xs leading-5 text-slate-500">
                {c.identityProtection}
              </p>
            </div>

            {visibleApplications.length === 0 ? (
              <div className="bd-glass-card-strong rounded-[28px] p-8 text-center text-sm text-slate-500">
                {c.noFilterResults}
              </div>
            ) : (
              <div className="grid gap-5">
                {visibleApplications.map((application) => (
                  <CrewPassportCard
                    key={application.id}
                    application={application}
                    language={language}
                    onView={() => void openProfile(application)}
                  />
                ))}
              </div>
            )}
            {hasMore ? (
              <div className="mt-6 flex flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMoreApplications()}
                  className="bd-focus inline-flex min-h-11 min-w-52 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-5 text-sm font-black text-cyan-900 transition hover:border-cyan-400 hover:bg-cyan-50 disabled:cursor-progress disabled:opacity-65"
                >
                  {loadingMore ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <UsersRound className="h-4 w-4" aria-hidden />
                  )}
                  {loadingMore ? c.loadingMore : c.loadMore}
                </button>
                <p className="text-xs font-semibold text-slate-500">
                  {applications.length} / {totalApplications}
                </p>
              </div>
            ) : null}
          </section>
        )}
        </div>
      </main>

      {profileOpen && selected ? (
        <CandidateProfileModal
          application={selected}
          details={profileDetails}
          language={language}
          loading={profileLoading}
          error={profileError}
          updating={updating}
          notice={notice}
          selectedMemberId={selectedMemberId}
          onClose={closeProfile}
          onRetry={() => void openProfile(selected, selectedMemberId)}
          onSelectMember={(memberId) => void openProfile(selected, memberId)}
          onUpdate={updateStatus}
        />
      ) : null}
    </>
  );
}

function CrewPassportCard({
  application,
  language,
  onView,
}: {
  application: EmployerJobApplication;
  language: "en" | "tr";
  onView: () => void;
}) {
  const c = copy[language];
  const candidate = application.candidate;
  const startValue = candidate.availabilityStatus
    ? candidateAvailabilityLabel(candidate.availabilityStatus, language)
    : c.notProvided;

  return (
    <CrewCandidatePassportCard
      candidate={candidate}
      availabilityValue={startValue}
      primaryBadge={
        <>
          <StatusBadge status={application.status} language={language} />
          {application.applicationMode === "team_couple" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-900">
              <UsersRound className="h-3.5 w-3.5" aria-hidden />
              {c.teamCouple} · {application.members.length}
            </span>
          ) : null}
          {application.applicationMode === "team_couple"
            ? application.members.map((member) => (
                <span
                  key={member.id}
                  data-i18n-ignore
                  className="max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600"
                  title={`${member.candidate.displayName} · ${member.candidate.currentPosition || c.crewMember}`}
                >
                  {member.candidate.displayName} · {member.candidate.currentPosition || c.crewMember}
                </span>
              ))
            : null}
        </>
      }
      fourthFact={{
        icon: <Clock3 />,
        label: c.applied,
        value: formatDate(application.submittedAt, language),
      }}
      copy={c}
      onView={onView}
    />
  );
}

function CandidateProfileModal({
  application,
  details,
  language,
  loading,
  error,
  updating,
  notice,
  selectedMemberId,
  onClose,
  onRetry,
  onSelectMember,
  onUpdate,
}: {
  application: EmployerJobApplication;
  details: EmployerJobApplicationDetails | null;
  language: "en" | "tr";
  loading: boolean;
  error: string;
  updating: boolean;
  notice: Notice | null;
  selectedMemberId: string;
  onClose: () => void;
  onRetry: () => void;
  onSelectMember: (memberId: string) => void;
  onUpdate: (status: EmployerJobApplicationStatus) => void;
}) {
  const c = copy[language];
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const candidate = details?.candidate;
  const selectedMember =
    application.members.find((member) => member.id === selectedMemberId) ||
    application.members.find((member) => member.isPrimary) ||
    application.members[0];
  const cardCandidate = selectedMember?.candidate || application.candidate;
  const isRejected = application.status === "rejected";
  const isFinal = ["withdrawn", "hired"].includes(application.status);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  function keepKeyboardFocusInDialog(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    const focusable = Array.from(
      dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || [],
    ).filter(
      (element) =>
        element.getAttribute("aria-hidden") !== "true" &&
        element.getClientRects().length > 0,
    );
    if (focusable.length === 0) {
      event.preventDefault();
      closeButtonRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1) || first;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[250] flex items-center justify-center bg-[#020817]/80 p-2 backdrop-blur-md sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="candidate-profile-title"
      onKeyDown={keepKeyboardFocusInDialog}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="relative max-h-[96dvh] w-full max-w-[1180px] overflow-x-hidden overflow-y-auto rounded-[26px] border border-white/15 bg-[#f6f9fd] shadow-2xl shadow-black/40 sm:rounded-[34px]">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="bd-focus absolute right-3 top-3 z-30 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-[#071631]/65 text-white shadow-lg shadow-black/15 backdrop-blur-md transition hover:bg-[#071631]/85 sm:right-4 sm:top-4 lg:border-slate-200 lg:bg-white/95 lg:text-[#071631] lg:hover:bg-white"
          aria-label={c.close}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        {loading || error || !candidate ? (
          <header className="relative overflow-hidden bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.20),transparent_32%),linear-gradient(125deg,#031126,#071631_58%,#0d254f)] px-5 py-6 text-white sm:px-8 sm:py-8">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(165,243,252,0.10)_1px,transparent_1px),linear-gradient(90deg,rgba(165,243,252,0.10)_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="pr-12">
            <CrewCandidateProfileIdentity
              candidate={{
                displayName: cardCandidate.displayName,
                initials: cardCandidate.initials,
                profilePhotoUrl: cardCandidate.profilePhotoUrl,
                currentPosition:
                  cardCandidate.currentPosition ||
                  c.crewMember,
                premiumProfile: cardCandidate.premiumProfile,
              }}
              kicker={c.candidateProfile}
              titleId="candidate-profile-title"
              premiumLabel={c.premiumProfile}
              headingLevel="h2"
            />
          </div>
          </header>
        ) : (
          <CrewCandidateEmployerProfileOverview
            candidate={candidate}
            copy={c}
            kicker={c.candidateProfile}
            titleId="candidate-profile-title"
            premiumLabel={c.premiumProfile}
            roleFallback={c.crewMember}
          />
        )}

        {application.members.length > 1 ? (
          <section className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-800">
              {c.teamMembers}
            </p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1" role="tablist">
              {application.members.map((member) => {
                const active = member.id === selectedMemberId;
                return (
                  <button
                    key={member.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSelectMember(member.id)}
                    disabled={loading && active}
                    className={`bd-focus min-w-44 shrink-0 rounded-xl border px-3.5 py-3 text-left transition disabled:cursor-wait ${
                      active
                        ? "border-[#071631] bg-[#071631] text-white"
                        : "border-slate-200 bg-slate-50 text-[#071631] hover:border-cyan-300 hover:bg-cyan-50"
                    }`}
                  >
                    <span data-i18n-ignore className="block truncate text-xs font-black">
                      {member.candidate.displayName}
                      {member.isPrimary ? ` · ${c.primaryApplicant}` : ""}
                    </span>
                    <span
                      data-i18n-ignore
                      className={`mt-1 block truncate text-[11px] ${active ? "text-cyan-100" : "text-slate-500"}`}
                    >
                      {member.candidate.currentPosition || c.crewMember}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
            <LoaderCircle className="h-10 w-10 animate-spin text-cyan-700" aria-hidden />
            <p className="mt-4 font-black text-[#071631]">{c.profileLoading}</p>
          </div>
        ) : error || !candidate ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
            <AlertCircle className="h-10 w-10 text-rose-600" aria-hidden />
            <h3 className="mt-4 text-2xl font-black text-[#071631]">
              {c.profileLoadError}
            </h3>
            {error ? <p className="mt-2 text-slate-600">{error}</p> : null}
            <button
              type="button"
              onClick={onRetry}
              className="bd-focus mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#071631] px-5 text-sm font-black text-white"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {c.retry}
            </button>
          </div>
        ) : (
          <CrewCandidateProfileBody candidate={candidate} copy={c} variant="employer">
            <section className="rounded-[26px] border border-cyan-100 bg-[linear-gradient(135deg,#ffffff,#edf9fc)] p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-800">
                    {c.crewPortal}
                  </p>
                  <h3 className="mt-2 text-xl font-black text-[#071631]">
                    {c.crewPortalTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {candidate.portalAvailable
                      ? c.crewPortalHelp
                      : c.crewPortalUnavailable}
                  </p>
                </div>
                {candidate.portalAvailable && candidate.publicCrewId ? (
                  <a
                    href={`/crew/${encodeURIComponent(candidate.publicCrewId)}/gallery`}
                    target="_blank"
                    rel="noreferrer"
                    className="bd-focus inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#071631] px-5 text-sm font-black text-white shadow-lg shadow-[#071631]/15 transition hover:bg-[#0d3e72]"
                  >
                    {c.openCrewPortal}
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-12 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-200 px-5 text-sm font-black text-slate-500"
                  >
                    <LockKeyhole className="h-4 w-4" aria-hidden />
                    {c.openCrewPortal}
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeading
                icon={<Send />}
                title={c.decision}
                text={
                  isRejected
                    ? c.rejectionCanBeUndone
                    : isFinal
                      ? c.finalStatus
                      : c.decisionHelp
                }
              />
              {isRejected ? (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => onUpdate("reviewing")}
                    disabled={updating}
                    className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-sm font-black text-cyan-900 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updating ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <RotateCcw className="h-4 w-4" aria-hidden />
                    )}
                    {c.undoRejection}
                  </button>
                </div>
              ) : !isFinal ? (
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
                  className={`mt-4 flex items-start gap-2 text-sm font-semibold leading-6 ${
                    notice.tone === "success"
                      ? "text-emerald-800"
                      : "text-rose-700"
                  }`}
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

            <p className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4 text-xs leading-5 text-cyan-950">
              {c.privacyNote}
            </p>
          </CrewCandidateProfileBody>
        )}
      </article>
    </div>
  );
}

function StatusBadge({
  status,
  language,
}: {
  status: JobApplicationStatus;
  language: "en" | "tr";
}) {
  const tones: Record<JobApplicationStatus, string> = {
    submitted: "border-cyan-300 bg-cyan-50 text-cyan-800",
    reviewing: "border-amber-200 bg-amber-50 text-amber-800",
    shortlisted: "border-violet-200 bg-violet-50 text-violet-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-700",
    hired: "border-emerald-200 bg-emerald-50 text-emerald-800",
    withdrawn: "border-slate-200 bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${tones[status]}`}
    >
      {statusLabel(status, language)}
    </span>
  );
}

function ListingAvailabilityBadge({
  availability,
  language,
}: {
  availability: JobApplicationJobAvailability;
  language: "en" | "tr";
}) {
  const tones: Record<JobApplicationJobAvailability, string> = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-800",
    expired: "border-rose-200 bg-rose-50 text-rose-800",
    cancelled: "border-slate-300 bg-slate-100 text-slate-700",
    unavailable: "border-amber-200 bg-amber-50 text-amber-800",
  };
  const labels: Record<
    JobApplicationJobAvailability,
    { en: string; tr: string }
  > = {
    active: { en: "Active listing", tr: "Yayında" },
    expired: { en: "Expired", tr: "Süresi doldu" },
    cancelled: { en: "Cancelled", tr: "İptal edildi" },
    unavailable: { en: "Unavailable", tr: "Kullanılamıyor" },
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.11em] ${tones[availability]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {labels[availability][language]}
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
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] ${
          active ? "bg-white/15" : "bg-slate-100"
        }`}
      >
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
    !["draft", "published", "closed"].includes(String(status)) ||
    !isJobApplicationJobAvailability(value.availability)
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
    availability: value.availability,
  };
}

function parseEmployerApplication(value: unknown): EmployerJobApplication | null {
  if (!isRecord(value) || !isRecord(value.candidate)) return null;
  const status = value.status;
  const applicantRole = value.applicantRole;
  const applicationMode = value.applicationMode;
  const candidate = parseEmployerCandidate(value.candidate);
  const members = Array.isArray(value.members)
    ? value.members.map((member) => {
        if (!isRecord(member) || !isRecord(member.candidate)) return null;
        const memberCandidate = parseEmployerCandidate(member.candidate);
        if (
          typeof member.id !== "string" ||
          (member.applicantRole !== "crew" && member.applicantRole !== "captain") ||
          typeof member.isPrimary !== "boolean" ||
          !memberCandidate
        ) {
          return null;
        }
        return {
          id: member.id,
          applicantRole: member.applicantRole as "crew" | "captain",
          isPrimary: member.isPrimary,
          candidate: memberCandidate,
        };
      })
    : [];
  if (
    !candidate ||
    typeof value.id !== "string" ||
    typeof value.jobPostId !== "string" ||
    !isJobApplicationMode(applicationMode) ||
    !isJobApplicationStatus(status) ||
    (applicantRole !== "crew" && applicantRole !== "captain") ||
    typeof value.submittedAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.version !== "number" ||
    typeof value.privateNoteAvailable !== "boolean" ||
    members.some((member) => member === null) ||
    members.filter((member) => member?.isPrimary).length !== 1 ||
    (applicationMode === "individual" && members.length !== 1) ||
    (applicationMode === "team_couple" &&
      (members.length < 2 || members.length > 8))
  ) {
    return null;
  }

  return {
    id: value.id,
    jobPostId: value.jobPostId,
    applicationMode,
    status,
    coverNote: typeof value.coverNote === "string" ? value.coverNote : "",
    submittedAt: value.submittedAt,
    updatedAt: value.updatedAt,
    withdrawnAt: typeof value.withdrawnAt === "string" ? value.withdrawnAt : null,
    version: value.version,
    applicantRole,
    privateNoteAvailable: value.privateNoteAvailable,
    candidate,
    members: members.filter((member) => member !== null),
  };
}

function parseEmployerCandidate(value: unknown) {
  if (!isRecord(value)) return null;
  if (
    typeof value.displayName !== "string" ||
    typeof value.initials !== "string" ||
    typeof value.experienceYears !== "number" ||
    typeof value.cvCompletionPercent !== "number" ||
    typeof value.premiumProfile !== "boolean"
  ) {
    return null;
  }
  return {
    displayName: value.displayName,
    initials: value.initials,
    profilePhotoUrl: stringValue(value.profilePhotoUrl),
    currentPosition: stringValue(value.currentPosition),
    nationality: stringValue(value.nationality),
    availabilityStatus: stringValue(value.availabilityStatus),
    experienceYears:
      value.experienceYears > 0 && value.experienceYears < 1
        ? 0.5
        : Math.max(0, Math.floor(value.experienceYears)),
    cvCompletionPercent: Math.max(
      0,
      Math.min(100, Math.round(value.cvCompletionPercent)),
    ),
    premiumProfile: value.premiumProfile,
  };
}

function parseCandidateDetails(value: unknown): EmployerJobApplicationDetails | null {
  if (!isRecord(value) || !isRecord(value.candidate)) return null;
  const candidate = value.candidate;
  if (
    typeof value.applicationId !== "string" ||
    typeof value.memberId !== "string" ||
    typeof value.isPrimaryMember !== "boolean" ||
    typeof candidate.displayName !== "string" ||
    typeof candidate.initials !== "string" ||
    typeof candidate.premiumProfile !== "boolean" ||
    typeof candidate.cvCompletionPercent !== "number" ||
    typeof candidate.portalAvailable !== "boolean"
  ) {
    return null;
  }

  return {
    applicationId: value.applicationId,
    memberId: value.memberId,
    isPrimaryMember: value.isPrimaryMember,
    candidate: {
      displayName: candidate.displayName,
      initials: candidate.initials,
      profilePhotoUrl: stringValue(candidate.profilePhotoUrl),
      currentPosition: stringValue(candidate.currentPosition),
      nationality: stringValue(candidate.nationality),
      location: stringValue(candidate.location),
      gender: stringValue(candidate.gender),
      maritalStatus: stringValue(candidate.maritalStatus),
      heightCm: nullableSafeNumber(candidate.heightCm),
      weightKg: nullableSafeNumber(candidate.weightKg),
      smoker: stringValue(candidate.smoker),
      visibleTattoos: stringValue(candidate.visibleTattoos),
      professionalSummary: stringValue(candidate.professionalSummary),
      skills: stringArray(candidate.skills, 30),
      characteristics: stringArray(candidate.characteristics, 30),
      workPreferences: stringArray(candidate.workPreferences, 30),
      seekingPositions: stringArray(candidate.seekingPositions, 30),
      employmentTypes: stringArray(candidate.employmentTypes, 30),
      preferredLocations: stringArray(candidate.preferredLocations, 30),
      languages: languageArray(candidate.languages),
      galleryPhotos: stringArray(candidate.galleryPhotos, 4),
      referenceCount: safeCount(candidate.referenceCount),
      documentCount: safeCount(candidate.documentCount),
      experienceYears: safeCount(candidate.experienceYears),
      publicCrewId: stringValue(candidate.publicCrewId),
      portalAvailable: candidate.portalAvailable,
      cvCompletionPercent: Math.max(
        0,
        Math.min(100, Math.round(candidate.cvCompletionPercent)),
      ),
      premiumProfile: candidate.premiumProfile,
    },
  };
}

function languageArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = stringValue(item.name);
      const level = stringValue(item.level);
      return name ? { name, level } : null;
    })
    .filter((item): item is { name: string; level: string } => Boolean(item));
}

function stringArray(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableSafeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function safeCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 0;
}

function candidateAvailabilityLabel(value: string, language: "en" | "tr") {
  const labels: Record<string, { en: string; tr: string }> = {
    Available: { en: "Available", tr: "Müsait" },
    "In 1 week": { en: "In 1 week", tr: "1 hafta içinde" },
    "In 1 month": { en: "In 1 month", tr: "1 ay içinde" },
    "Open to offers": { en: "Open to offers", tr: "Tekliflere açık" },
    "Not available": { en: "Not available", tr: "Müsait değil" },
    "Available now": { en: "Available", tr: "Müsait" },
    "Available soon": { en: "In 1 week", tr: "1 hafta içinde" },
    "Currently employed": { en: "Not available", tr: "Müsait değil" },
  };

  return labels[value]?.[language] || value;
}

function statusLabel(status: JobApplicationStatus, language: "en" | "tr") {
  const labels = {
    submitted: { en: "New application", tr: "Yeni başvuru" },
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

function isApplicationCursor(
  value: unknown,
  hasMore: boolean,
): value is string | null {
  if (!hasMore) return value === null;
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(value);
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
    profileLoading: "Loading candidate profile…",
    profileLoadError: "Candidate profile could not be loaded",
    retry: "Retry",
    back: "My Job Postings & Hiring",
    eyebrow: "Candidate pipeline",
    total: "Applications",
    shortlisted: "Shortlisted",
    startDate: "Job start date",
    filters: "Application filters",
    all: "All",
    empty: "No applications yet",
    emptyText:
      "Candidates will appear here as soon as Crew or Captain accounts apply to this role.",
    candidates: "Applicants",
    results: "results",
    noFilterResults: "No candidates match this filter.",
    loadMore: "Load more candidates",
    loadingMore: "Loading candidates…",
    identityProtection:
      "Candidate names remain protected until BlueDeck Hiring access is introduced.",
    crewMember: "Yacht crew",
    nationality: "Nationality",
    availableToStart: "Available to start",
    experience: "Experience",
    years: "years",
    lessThanOneYear: "Less than 1 year",
    noExperience: "Not added",
    applied: "Applied on",
    notProvided: "Not provided",
    premiumProfile: "Premium profile",
    premium: "Premium",
    nameLocked: "Candidate name protected",
    maskedIdentity: "Identity protected by BlueDeck",
    teamCouple: "Team/Couple",
    teamMembers: "Team/Couple members",
    primaryApplicant: "Primary",
    viewProfile: "View profile",
    candidateProfile: "Crew profile",
    close: "Close profile",
    gallery: "Blue Gallery",
    galleryHelp: "Selected professional photos shared by the candidate.",
    galleryPhoto: "gallery photo",
    openGalleryPhoto: "Open gallery photo",
    closeGalleryPhoto: "Close photo preview",
    noGalleryPhotos: "The candidate has not shared gallery photos yet.",
    references: "References",
    documents: "Documents",
    experiences: "Experience",
    personalDetails: "Personal details",
    gender: "Gender",
    maritalStatus: "Marital status",
    height: "Height",
    weight: "Weight",
    smoker: "Smoker",
    visibleTattoos: "Visible tattoos",
    location: "Location",
    professionalSummary: "Professional summary",
    noProfessionalSummary: "No professional summary has been added yet.",
    skillsCharacteristics: "Skills & characteristics",
    skillsHelp: "Skills, strengths and career preferences shared by the candidate.",
    skills: "Skills",
    characteristics: "Characteristics",
    seekingPositions: "Seeking positions",
    workPreferences: "Work preferences",
    employmentTypes: "Employment types",
    preferredLocations: "Preferred hiring regions",
    languages: "Languages",
    noLanguages: "No language information has been added yet.",
    crewPortal: "Crew Portal / CV",
    crewPortalTitle: "Open the candidate’s public BlueDeck profile",
    crewPortalHelp:
      "This opens the same gallery linked by the CV QR code, with access to the public CV.",
    crewPortalUnavailable:
      "The public Crew Portal is unavailable for this candidate profile.",
    openCrewPortal: "Open Crew Portal / CV",
    decision: "Application status",
    decisionHelp: "Move the candidate through a clear, private hiring pipeline.",
    rejectionCanBeUndone:
      "If this applicant was rejected by mistake, you can move them back to Reviewing.",
    undoRejection: "Undo rejection",
    finalStatus: "This application has reached a final status.",
    privacyNote:
      "Contact details, document files and reference identities are never included here. Candidate names are masked in this hiring workspace.",
  },
  tr: {
    loading: "Başvurular yükleniyor…",
    loadError: "Başvurular yüklenemedi",
    updateError: "Başvuru durumu güncellenemedi.",
    updated: "Başvuru durumu güncellendi.",
    profileLoading: "Aday profili yükleniyor…",
    profileLoadError: "Aday profili yüklenemedi",
    retry: "Tekrar dene",
    back: "İş İlanlarım ve İşe Alım",
    eyebrow: "Aday süreci",
    total: "Başvuru",
    shortlisted: "Kısa listede",
    startDate: "İşe başlama tarihi",
    filters: "Başvuru filtreleri",
    all: "Tümü",
    empty: "Henüz başvuru yok",
    emptyText:
      "Crew veya Captain hesapları bu ilana başvurduğunda adaylar burada görünecek.",
    candidates: "Başvuranlar",
    results: "sonuç",
    noFilterResults: "Bu filtreyle eşleşen aday yok.",
    loadMore: "Daha fazla aday yükle",
    loadingMore: "Adaylar yükleniyor…",
    identityProtection:
      "BlueDeck Hiring erişimi sunulana kadar aday adları korumalı kalır.",
    crewMember: "Yat mürettebatı",
    nationality: "Uyruk",
    availableToStart: "İşe başlama müsaitliği",
    experience: "Deneyim",
    years: "yıl",
    lessThanOneYear: "1 yıldan az",
    noExperience: "Eklenmedi",
    applied: "Başvuru tarihi",
    notProvided: "Belirtilmedi",
    premiumProfile: "Premium profil",
    premium: "Premium",
    nameLocked: "Aday adı korumalı",
    maskedIdentity: "Kimlik BlueDeck tarafından korunuyor",
    teamCouple: "Team/Couple",
    teamMembers: "Team/Couple üyeleri",
    primaryApplicant: "Başvuran",
    viewProfile: "Profili görüntüle",
    candidateProfile: "Crew profili",
    close: "Profili kapat",
    gallery: "Blue Gallery",
    galleryHelp: "Adayın paylaştığı seçilmiş profesyonel fotoğraflar.",
    galleryPhoto: "galeri fotoğrafı",
    openGalleryPhoto: "Galeri fotoğrafını aç",
    closeGalleryPhoto: "Fotoğraf önizlemesini kapat",
    noGalleryPhotos: "Aday henüz galeri fotoğrafı paylaşmamış.",
    references: "Referans",
    documents: "Doküman",
    experiences: "Deneyim",
    personalDetails: "Kişisel bilgiler",
    gender: "Cinsiyet",
    maritalStatus: "Medeni durum",
    height: "Boy",
    weight: "Kilo",
    smoker: "Sigara kullanımı",
    visibleTattoos: "Görünür dövme",
    location: "Konum",
    professionalSummary: "Profesyonel özet",
    noProfessionalSummary: "Henüz profesyonel özet eklenmemiş.",
    skillsCharacteristics: "Beceriler ve özellikler",
    skillsHelp: "Adayın paylaştığı beceriler, güçlü yönler ve kariyer tercihleri.",
    skills: "Beceriler",
    characteristics: "Kişisel özellikler",
    seekingPositions: "Aranan pozisyonlar",
    workPreferences: "Çalışma tercihleri",
    employmentTypes: "Çalışma türleri",
    preferredLocations: "Tercih edilen çalışma bölgeleri",
    languages: "Diller",
    noLanguages: "Henüz dil bilgisi eklenmemiş.",
    crewPortal: "Crew Portal / CV",
    crewPortalTitle: "Adayın herkese açık BlueDeck profilini aç",
    crewPortalHelp:
      "CV üzerindeki QR koduyla aynı galeriyi açar ve herkese açık CV’ye erişim sağlar.",
    crewPortalUnavailable:
      "Bu aday profili için herkese açık Crew Portal kullanılamıyor.",
    openCrewPortal: "Crew Portal / CV’yi aç",
    decision: "Başvuru durumu",
    decisionHelp: "Adayı sade ve özel işe alım sürecinde ilerletin.",
    rejectionCanBeUndone:
      "Aday yanlışlıkla reddedildiyse başvuruyu yeniden İnceleniyor durumuna alabilirsiniz.",
    undoRejection: "Reddi geri al",
    finalStatus: "Bu başvuru nihai duruma ulaştı.",
    privacyNote:
      "İletişim bilgileri, doküman dosyaları ve referans kimlikleri burada gösterilmez. Aday adları işe alım alanında maskelidir.",
  },
} as const;
