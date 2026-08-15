"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FilePenLine,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Plus,
  RefreshCw,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import { JobDetailClient } from "../jobs/[id]/JobDetailClient";
import {
  marketplaceCapabilitiesForRole,
  marketplaceRoleLabel,
  normalizeMarketplaceAccountRole,
  type MarketplaceCapabilities,
} from "../lib/marketplaceCapabilities";
import {
  formatJobEmploymentType,
  formatJobListingNumber,
  isEmployerJobPostExpired,
  type EmployerJobPost,
} from "../lib/jobPosts";
import { supabase } from "../lib/supabase";

type JobWorkspaceResponse = {
  ok?: boolean;
  error?: string;
  capabilities?: MarketplaceCapabilities & {
    postingStatus?: "enabled" | "suspended" | "unavailable";
    planCode?: string;
  };
  jobs?: EmployerJobPost[];
  applicationCounts?: Record<string, number>;
  applicationCountsAvailable?: boolean;
};

const copy = {
  en: {
    eyebrow: "BlueDeck hiring workspace",
    privacy: "Private account area",
    loading: "Loading your hiring workspace…",
    loadError: "Your hiring workspace could not be loaded.",
    retry: "Try again",
    createPost: "Create Job Post",
    browseJobs: "Browse jobs",
    totalPosts: "Job postings",
    livePosts: "Published",
    totalApplications: "Applications",
    postingsEyebrow: "Your hiring activity",
    postingsTitle: "Job postings",
    postingsIntro:
      "Open a listing to review applicants, update the role or view its public page.",
    readOnlyTitle: "Posting access is currently paused",
    readOnlyText:
      "Job posting and hiring management will return when access is restored.",
    crewTitle: "This is an employer workspace",
    crewText:
      "Crew accounts can browse and apply to roles. Captain, Owner / Employer and Management accounts can publish job posts.",
    emptyTitle: "No job postings yet",
    emptyCreateText:
      "Your job postings and applicants will appear here.",
    emptyReadOnlyText:
      "There are no job postings for this account.",
    listingNumber: "Listing",
    applicants: "Applicants",
    viewApplicants: "View Applicants",
    editPost: "Edit Job Post",
    viewLive: "View Live Listing",
    livePreview: "Live listing preview",
    livePreviewHint: "This is how your published role appears on BlueDeck.",
    closePreview: "Close preview",
    location: "Location",
    startDate: "Start date",
    updated: "Updated",
    employmentType: "Employment",
    notSpecified: "Not specified",
    countsUnavailable:
      "Application totals are temporarily unavailable. You can still open each listing to review its applicants.",
    draft: "Draft",
    published: "Published",
    closed: "Closed",
    expired: "Expired",
    cancelled: "Cancelled",
  },
  tr: {
    eyebrow: "BlueDeck işe alım alanı",
    privacy: "Özel hesap alanı",
    loading: "İşe alım alanınız yükleniyor…",
    loadError: "İşe alım alanınız yüklenemedi.",
    retry: "Tekrar dene",
    createPost: "İş İlanı Oluştur",
    browseJobs: "İş ilanlarına göz at",
    totalPosts: "İş ilanı",
    livePosts: "Yayında",
    totalApplications: "Başvuru",
    postingsEyebrow: "İşe alım hareketleriniz",
    postingsTitle: "İş ilanları",
    postingsIntro:
      "Başvuruları incelemek, ilanı güncellemek veya herkese açık sayfasını görmek için ilgili ilanı açın.",
    readOnlyTitle: "İlan yayınlama yetkisi şu anda duraklatıldı",
    readOnlyText:
      "Yetki yeniden açıldığında iş ilanı ve işe alım yönetimine tekrar erişebilirsiniz.",
    crewTitle: "Bu alan işveren hesapları içindir",
    crewText:
      "Crew hesapları ilanları görüntüleyip başvurabilir. Captain, Owner / Employer ve Management hesapları iş ilanı yayınlayabilir.",
    emptyTitle: "Henüz iş ilanı yok",
    emptyCreateText:
      "İlanlarınız ve başvurularınız burada görünecek.",
    emptyReadOnlyText:
      "Bu hesapta henüz iş ilanı yok.",
    listingNumber: "İlan",
    applicants: "Başvuru",
    viewApplicants: "Başvuranları Gör",
    editPost: "İlanı Düzenle",
    viewLive: "İlanı Gör",
    livePreview: "Canlı ilan önizlemesi",
    livePreviewHint:
      "Yayındaki ilanınızın BlueDeck'te nasıl göründüğünü inceleyin.",
    closePreview: "Önizlemeyi kapat",
    location: "Konum",
    startDate: "Başlangıç",
    updated: "Güncellendi",
    employmentType: "Çalışma biçimi",
    notSpecified: "Belirtilmedi",
    countsUnavailable:
      "Başvuru sayıları geçici olarak görüntülenemiyor. Başvuranları incelemek için ilanı açmaya devam edebilirsiniz.",
    draft: "Taslak",
    published: "Yayında",
    closed: "Kapalı",
    expired: "Süresi doldu",
    cancelled: "İptal edildi",
  },
} as const;

export default function HiringPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [capabilities, setCapabilities] = useState<
    JobWorkspaceResponse["capabilities"]
  >(marketplaceCapabilitiesForRole("crew"));
  const [jobs, setJobs] = useState<EmployerJobPost[]>([]);
  const [applicationCounts, setApplicationCounts] = useState<
    Record<string, number>
  >({});
  const [applicationCountsAvailable, setApplicationCountsAvailable] =
    useState(true);
  const [previewJob, setPreviewJob] = useState<EmployerJobPost | null>(null);

  async function loadHiringWorkspace() {
    setLoading(true);
    setLoadError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.replace(`/login?next=${encodeURIComponent("/hiring")}`);
      return;
    }

    try {
      const response = await fetch("/api/employer/job-posts", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });
      const workspace = (await response
        .json()
        .catch(() => null)) as JobWorkspaceResponse | null;

      if (response.status === 401) {
        window.location.replace(`/login?next=${encodeURIComponent("/hiring")}`);
        return;
      }

      if (
        !response.ok ||
        !workspace?.ok ||
        !workspace.capabilities ||
        !Array.isArray(workspace.jobs)
      ) {
        throw new Error(workspace?.error || c.loadError);
      }

      const canonicalRole = normalizeMarketplaceAccountRole(
        workspace.capabilities.role,
      );
      const nextJobs = workspace.jobs;
      const countsAvailable = workspace.applicationCountsAvailable !== false;
      const rawCounts = workspace.applicationCounts || {};
      const nextCounts = Object.fromEntries(
        nextJobs.map((job) => [
          job.id,
          countsAvailable && Number.isSafeInteger(rawCounts[job.id])
            ? Math.max(0, rawCounts[job.id])
            : 0,
        ]),
      );

      setCapabilities({
        ...marketplaceCapabilitiesForRole(canonicalRole),
        ...workspace.capabilities,
        role: canonicalRole,
      });
      setJobs(nextJobs);
      setApplicationCounts(nextCounts);
      setApplicationCountsAvailable(countsAvailable);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : c.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHiringWorkspace();
  }, []);

  const metrics = useMemo(() => {
    const published = jobs.filter(
      (job) => job.status === "published" && !isEmployerJobPostExpired(job),
    ).length;
    const applications = Object.values(applicationCounts).reduce(
      (total, count) => total + count,
      0,
    );

    return { published, applications };
  }, [applicationCounts, jobs]);

  if (loading) {
    return <LoadingState label={c.loading} />;
  }

  if (loadError) {
    return (
      <main className="bd-app-page bd-ocean-shell min-h-screen px-5 py-10 text-slate-900 sm:px-8 lg:px-10">
        <div className="bd-ocean-content mx-auto max-w-4xl">
          <div className="bd-glass-card-strong overflow-hidden rounded-[30px]">
            <div className="bd-brand-rule h-1.5" />
            <div className="p-7 sm:p-10">
              <AlertCircle className="h-9 w-9 text-rose-600" aria-hidden />
              <h1 className="mt-5 text-3xl font-semibold text-slate-950">
                {c.loadError}
              </h1>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => void loadHiringWorkspace()}
                className="bd-focus mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                {c.retry}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const role = normalizeMarketplaceAccountRole(capabilities?.role);
  const canPostJobs = capabilities?.canPostJobs === true;
  const canCreateJob = canPostJobs;
  const isPublisherRole = role !== "crew";

  return (
    <main className="bd-app-page bd-ocean-shell bd-page-gutter min-h-screen overflow-x-hidden px-5 pb-24 pt-8 text-slate-900 sm:px-8 sm:pt-10 lg:px-10">
      <div className="bd-ocean-content bd-page-frame mx-auto w-full max-w-7xl">
        <section className="bd-page-hero relative overflow-hidden rounded-[34px] border border-slate-200 bg-white p-6 sm:p-8 lg:p-10">
          <div className="bd-brand-rule absolute inset-x-0 top-0 h-1.5" />
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="bd-kicker">{c.eyebrow}</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-800">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                  {c.privacy}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#071f3c]">
                  {marketplaceRoleLabel(role, language)}
                </span>
              </div>
            </div>

            {canCreateJob ? (
              <Link
                href="/hiring/jobs"
                className="bd-focus inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:bg-cyan-800"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {c.createPost}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <MetricCard
              icon={<BriefcaseBusiness className="h-5 w-5" aria-hidden />}
              label={c.totalPosts}
              value={jobs.length}
            />
            <MetricCard
              icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
              label={c.livePosts}
              value={metrics.published}
            />
            <MetricCard
              icon={<UsersRound className="h-5 w-5" aria-hidden />}
              label={c.totalApplications}
              value={applicationCountsAvailable ? metrics.applications : "—"}
            />
          </div>
        </section>

        {!canPostJobs ? (
          <WorkspaceNotice
            icon={
              isPublisherRole ? (
                <LockKeyhole className="h-5 w-5" aria-hidden />
              ) : (
                <BriefcaseBusiness className="h-5 w-5" aria-hidden />
              )
            }
            title={isPublisherRole ? c.readOnlyTitle : c.crewTitle}
            text={isPublisherRole ? c.readOnlyText : c.crewText}
            action={
              !isPublisherRole && capabilities?.canApplyJobs ? (
                <Link
                  href="/jobs"
                  className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 text-sm font-black text-cyan-900 transition hover:bg-cyan-50"
                >
                  {c.browseJobs}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null
            }
          />
        ) : null}

        {jobs.length === 0 ? (
          <section
            className="mt-6"
            aria-labelledby="job-postings-empty-title"
          >
            <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm shadow-slate-950/[0.04] sm:px-6 sm:py-6">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800">
                  <BriefcaseBusiness className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 py-0.5">
                  <h2
                    id="job-postings-empty-title"
                    className="text-lg font-semibold tracking-[-0.02em] text-[#071f3c] sm:text-xl"
                  >
                    {c.emptyTitle}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {canCreateJob ? c.emptyCreateText : c.emptyReadOnlyText}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-6" aria-labelledby="job-postings-title">
            <div>
              <p className="bd-kicker">{c.postingsEyebrow}</p>
              <h2
                id="job-postings-title"
                className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#071f3c] sm:text-4xl"
              >
                {c.postingsTitle}
              </h2>
              <p className="mt-2 max-w-2xl leading-7 text-slate-600">
                {c.postingsIntro}
              </p>
            </div>

            {!applicationCountsAvailable ? (
              <div
                role="status"
                className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm font-semibold leading-6 text-amber-950"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <p>{c.countsUnavailable}</p>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              {jobs.map((job) => (
                <JobPostCard
                  key={job.id}
                  job={job}
                  applicantCount={
                    applicationCountsAvailable
                      ? (applicationCounts[job.id] ?? 0)
                      : null
                  }
                  canEdit={canPostJobs}
                  language={language}
                  onViewLive={() => setPreviewJob(job)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
      {previewJob ? (
        <LiveListingPreviewModal
          job={previewJob}
          language={language}
          onClose={() => setPreviewJob(null)}
        />
      ) : null}
    </main>
  );
}

function JobPostCard({
  job,
  applicantCount,
  canEdit,
  language,
  onViewLive,
}: {
  job: EmployerJobPost;
  applicantCount: number | null;
  canEdit: boolean;
  language: "en" | "tr";
  onViewLive: () => void;
}) {
  const c = copy[language];
  const status = jobStatus(job, language);
  const expired = isEmployerJobPostExpired(job);
  const terminal = expired || job.status === "closed";
  const title = job.position || job.title;
  const titleId = `job-post-title-${job.id}`;
  const canEditPost = canEdit && !terminal;
  const canViewLive = job.status === "published" && !expired;
  const secondaryActionCount = Number(canEditPost) + Number(canViewLive);

  return (
    <article
      aria-labelledby={titleId}
      className="group relative grid overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white shadow-[0_18px_55px_-42px_rgba(7,31,60,0.48)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_24px_70px_-42px_rgba(8,145,178,0.38)] motion-reduce:transform-none motion-reduce:transition-none lg:min-h-[13.5rem] lg:grid-cols-[minmax(13rem,0.8fr)_minmax(23rem,1.45fr)_minmax(18.5rem,0.9fr)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-[#071f3c] via-cyan-700 to-cyan-300" />

      <div className="flex min-w-0 flex-col justify-center px-5 pb-6 pt-7 sm:px-7 lg:border-r lg:border-slate-200 lg:py-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p
            data-i18n-ignore
            className="font-mono text-[11px] font-black tracking-[0.13em] text-cyan-800"
          >
            <span className="sr-only">{c.listingNumber} </span>
            {formatJobListingNumber(job.listingNumber)}
          </p>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.11em] ${status.className}`}
          >
            {status.label}
          </span>
        </div>
        <h3
          id={titleId}
          data-i18n-ignore
          className="mt-3 min-w-0 break-words text-2xl font-semibold leading-tight tracking-[-0.035em] text-[#071f3c] sm:text-[1.75rem]"
        >
          {title}
        </h3>
      </div>

      <dl className="grid min-w-0 gap-x-8 gap-y-4 border-t border-slate-200 px-5 py-6 text-sm sm:grid-cols-2 sm:px-7 lg:border-t-0 lg:px-8 lg:py-7 xl:gap-x-10 xl:px-10">
        <JobDetail
          icon={<BriefcaseBusiness className="h-4 w-4" aria-hidden />}
          label={c.employmentType}
          value={formatJobEmploymentType(job.employmentType, language)}
        />
        <JobDetail
          icon={<MapPin className="h-4 w-4" aria-hidden />}
          label={c.location}
          value={job.location || c.notSpecified}
        />
        <JobDetail
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          label={c.startDate}
          value={
            job.startDate ? formatDate(job.startDate, language) : c.notSpecified
          }
        />
        <JobDetail
          icon={<Clock3 className="h-4 w-4" aria-hidden />}
          label={c.updated}
          value={formatDate(job.updatedAt, language)}
        />
      </dl>

      <div className="flex min-w-0 flex-col justify-center gap-2 border-t border-slate-200 px-5 py-6 sm:px-7 lg:border-l lg:border-t-0 lg:px-6 lg:py-7 xl:px-7">
        <div className="flex min-h-12 items-center gap-3 rounded-xl border border-cyan-100 bg-cyan-50/70 px-3.5 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-cyan-800 shadow-sm">
            <UsersRound className="h-[1.15rem] w-[1.15rem]" aria-hidden />
          </span>
          <p className="min-w-0 text-sm font-black text-[#071f3c]">
            <span className="mr-1.5 text-xl leading-none text-cyan-800">
              {applicantCount ?? "—"}
            </span>
            {c.applicants}
          </p>
        </div>

        <Link
          href={`/hiring/jobs/${encodeURIComponent(job.id)}/applications`}
          aria-label={`${c.viewApplicants}: ${title}`}
          className="bd-focus flex min-h-14 items-center justify-between rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white shadow-[0_12px_28px_-18px_rgba(7,31,60,0.9)] transition hover:bg-cyan-800 motion-reduce:transition-none"
        >
          {c.viewApplicants}
          <ArrowRight
            className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
            aria-hidden
          />
        </Link>

        {secondaryActionCount > 0 ? (
          <div
            className={`grid gap-2 ${
              secondaryActionCount === 2
                ? "sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {canEditPost ? (
              <Link
                href={`/hiring/jobs?job=${encodeURIComponent(job.id)}`}
                aria-label={`${c.editPost}: ${title}`}
                className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-center text-xs font-black text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50 motion-reduce:transition-none"
              >
                <FilePenLine className="h-4 w-4 shrink-0" aria-hidden />
                {c.editPost}
              </Link>
            ) : null}
            {canViewLive ? (
              <button
                type="button"
                onClick={onViewLive}
                aria-label={`${c.viewLive}: ${title}`}
                className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-center text-xs font-black text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50 motion-reduce:transition-none"
              >
                <Eye className="h-4 w-4 shrink-0" aria-hidden />
                {c.viewLive}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function LiveListingPreviewModal({
  job,
  language,
  onClose,
}: {
  job: EmployerJobPost;
  language: "en" | "tr";
  onClose: () => void;
}) {
  const c = copy[language];
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex bg-[#03152c]/80 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-listing-preview-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[92dvh] sm:max-w-6xl sm:rounded-[28px]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <p
                id="live-listing-preview-title"
                className="text-sm font-black text-[#071f3c] sm:text-base"
              >
                {c.livePreview}
              </p>
            </div>
            <p className="mt-0.5 hidden truncate text-xs text-slate-500 sm:block">
              {c.livePreviewHint}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <p
              data-i18n-ignore
              className="hidden max-w-56 truncate text-sm font-semibold text-slate-600 md:block"
            >
              {job.position || job.title}
            </p>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label={c.closePreview}
              title={c.closePreview}
              className="bd-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f6f9fb]">
          <JobDetailClient jobId={job.id} embedded />
        </div>
      </section>
    </div>
  );
}

function JobDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 sm:text-[10px]">
        <span className="shrink-0 text-cyan-700 [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
        {label}
      </dt>
      <dd
        data-i18n-ignore
        className="mt-0.5 break-words pl-[1.375rem] text-xs font-semibold leading-5 text-slate-800 sm:text-sm"
      >
        {value}
      </dd>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-cyan-800 shadow-sm">
          {icon}
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold leading-none text-[#071f3c]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function WorkspaceNotice({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-5 flex flex-col gap-4 rounded-[24px] border border-cyan-100 bg-cyan-50/75 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-800 shadow-sm">
          {icon}
        </span>
        <div>
          <h2 className="font-black text-[#071f3c]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {text}
          </p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}

function jobStatus(job: EmployerJobPost, language: "en" | "tr") {
  const c = copy[language];

  if (isEmployerJobPostExpired(job) || job.closureReason === "expired") {
    return {
      label: c.expired,
      className: "border-slate-200 bg-slate-100 text-slate-700",
    };
  }
  if (job.closureReason === "cancelled") {
    return {
      label: c.cancelled,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (job.status === "published") {
    return {
      label: c.published,
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (job.status === "draft") {
    return {
      label: c.draft,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return {
    label: c.closed,
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };
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

function LoadingState({ label }: { label: string }) {
  return (
    <main className="bd-app-page bd-ocean-shell flex min-h-screen items-center justify-center px-5 py-16 text-slate-900">
      <div
        className="bd-ocean-content text-center"
        role="status"
        aria-live="polite"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-100 bg-white text-cyan-800 shadow-lg">
          <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden />
        </span>
        <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-slate-600">
          {label}
        </p>
      </div>
    </main>
  );
}
