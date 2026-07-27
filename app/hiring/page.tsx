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
  Ship,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../components/LanguageProvider";
import {
  marketplaceCapabilitiesForRole,
  marketplaceRoleLabel,
  normalizeMarketplaceAccountRole,
  type MarketplaceCapabilities,
} from "../lib/marketplaceCapabilities";
import {
  formatJobListingNumber,
  isEmployerJobPostExpired,
  type EmployerJobPost,
  type VerifiedEmployerYacht,
} from "../lib/jobPosts";
import { supabase } from "../lib/supabase";

type JobWorkspaceResponse = {
  ok?: boolean;
  error?: string;
  capabilities?: MarketplaceCapabilities & {
    postingStatus?: "enabled" | "suspended" | "unavailable";
    planCode?: string;
  };
  yachts?: VerifiedEmployerYacht[];
  jobs?: EmployerJobPost[];
  applicationCounts?: Record<string, number>;
  applicationCountsAvailable?: boolean;
};

const copy = {
  en: {
    eyebrow: "BlueDeck hiring workspace",
    title: "My Job Postings & Hiring",
    intro:
      "Review every role you manage, open its candidate pipeline and keep hiring decisions organized from one private workspace.",
    privacy: "Private account area",
    loading: "Loading your hiring workspace…",
    loadError: "Your hiring workspace could not be loaded.",
    retry: "Try again",
    createPost: "Create Job Post",
    connectYacht: "Connect a yacht",
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
    yachtRequiredTitle: "Connect a yacht before creating a role",
    yachtRequiredText:
      "Add a yacht you own or connect an active Captain or Management relationship to start publishing.",
    emptyTitle: "No job postings yet",
    emptyCreateText:
      "Create your first role and BlueDeck will keep its applicants and hiring activity organized here.",
    emptyReadOnlyText:
      "There are no existing job postings available for this account.",
    listingNumber: "Listing",
    applicants: "Applicants",
    viewApplicants: "View Applicants",
    editPost: "Edit Job Post",
    viewLive: "View Live Listing",
    location: "Location",
    startDate: "Start date",
    updated: "Updated",
    yacht: "Yacht",
    privateYacht: "Private yacht",
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
    title: "İş İlanlarım ve İşe Alım",
    intro:
      "Yönettiğiniz tüm ilanları inceleyin, aday süreçlerini açın ve işe alım kararlarını tek bir özel alandan yönetin.",
    privacy: "Özel hesap alanı",
    loading: "İşe alım alanınız yükleniyor…",
    loadError: "İşe alım alanınız yüklenemedi.",
    retry: "Tekrar dene",
    createPost: "İş İlanı Oluştur",
    connectYacht: "Yat bağla",
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
    yachtRequiredTitle: "İlan oluşturmadan önce bir yat bağlayın",
    yachtRequiredText:
      "İlan yayınlamak için sahibi olduğunuz bir yatı ekleyin veya aktif Captain ya da Management bağlantısı kurun.",
    emptyTitle: "Henüz iş ilanı yok",
    emptyCreateText:
      "İlk ilanınızı oluşturun; BlueDeck başvuruları ve işe alım hareketlerini burada düzenli tutsun.",
    emptyReadOnlyText:
      "Bu hesap için görüntülenebilecek mevcut bir iş ilanı bulunmuyor.",
    listingNumber: "İlan",
    applicants: "Başvuru",
    viewApplicants: "Başvuranları Gör",
    editPost: "İlanı Düzenle",
    viewLive: "Yayındaki İlanı Gör",
    location: "Konum",
    startDate: "Başlangıç",
    updated: "Güncellendi",
    yacht: "Yat",
    privateYacht: "Gizli yat",
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
  const [yachtCount, setYachtCount] = useState(0);
  const [jobs, setJobs] = useState<EmployerJobPost[]>([]);
  const [applicationCounts, setApplicationCounts] = useState<
    Record<string, number>
  >({});
  const [applicationCountsAvailable, setApplicationCountsAvailable] =
    useState(true);

  async function loadHiringWorkspace() {
    setLoading(true);
    setLoadError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.replace(
        `/login?next=${encodeURIComponent("/hiring")}`,
      );
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
        window.location.replace(
          `/login?next=${encodeURIComponent("/hiring")}`,
        );
        return;
      }

      if (
        !response.ok ||
        !workspace?.ok ||
        !workspace.capabilities ||
        !Array.isArray(workspace.yachts) ||
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
        requiresAdminApproval: false,
      });
      setYachtCount(workspace.yachts.length);
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
  const canCreateJob = canPostJobs && yachtCount > 0;
  const isPublisherRole = role !== "crew";

  return (
    <main className="bd-app-page bd-ocean-shell min-h-screen overflow-x-hidden px-5 pb-24 pt-8 text-slate-900 sm:px-8 sm:pt-10 lg:px-10">
      <div className="bd-ocean-content mx-auto w-full max-w-7xl">
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
              <h1 className="bd-serif mt-5 text-4xl leading-[0.98] text-[#071f3c] sm:text-6xl">
                {c.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                {c.intro}
              </p>
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
        ) : yachtCount === 0 ? (
          <WorkspaceNotice
            icon={<Ship className="h-5 w-5" aria-hidden />}
            title={c.yachtRequiredTitle}
            text={c.yachtRequiredText}
            action={
              <Link
                href="/yachts"
                className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-white px-4 text-sm font-black text-cyan-900 transition hover:bg-cyan-50"
              >
                {c.connectYacht}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        ) : null}

        <section className="mt-6" aria-labelledby="job-postings-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
            {canCreateJob && jobs.length > 0 ? (
              <Link
                href="/hiring/jobs"
                className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {c.createPost}
              </Link>
            ) : null}
          </div>

          {!applicationCountsAvailable && jobs.length > 0 ? (
            <div
              role="status"
              className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm font-semibold leading-6 text-amber-950"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p>{c.countsUnavailable}</p>
            </div>
          ) : null}

          {jobs.length === 0 ? (
            <div className="bd-glass-card-strong mt-5 rounded-[30px] p-8 text-center sm:p-12">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
                <BriefcaseBusiness className="h-7 w-7" aria-hidden />
              </span>
              <h3 className="mt-5 text-2xl font-semibold text-[#071f3c]">
                {c.emptyTitle}
              </h3>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
                {canCreateJob ? c.emptyCreateText : c.emptyReadOnlyText}
              </p>
              {canCreateJob ? (
                <Link
                  href="/hiring/jobs"
                  className="bd-focus mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {c.createPost}
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {jobs.map((job) => (
                <JobPostCard
                  key={job.id}
                  job={job}
                  applicantCount={
                    applicationCountsAvailable
                      ? applicationCounts[job.id] ?? 0
                      : null
                  }
                  canEdit={canPostJobs}
                  language={language}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function JobPostCard({
  job,
  applicantCount,
  canEdit,
  language,
}: {
  job: EmployerJobPost;
  applicantCount: number | null;
  canEdit: boolean;
  language: "en" | "tr";
}) {
  const c = copy[language];
  const status = jobStatus(job, language);
  const expired = isEmployerJobPostExpired(job);
  const terminal = expired || job.status === "closed";
  const yachtName = [job.yacht?.name, job.yacht?.model]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="bd-glass-card-strong overflow-hidden rounded-[28px] border border-white/80">
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              data-i18n-ignore
              aria-label={`${c.listingNumber} ${formatJobListingNumber(job.listingNumber)}`}
              className="font-mono text-[11px] font-black tracking-[0.13em] text-cyan-800"
            >
              {formatJobListingNumber(job.listingNumber)}
            </p>
            <h3
              data-i18n-ignore
              className="mt-2 text-2xl font-semibold leading-tight text-[#071f3c]"
            >
              {job.position || job.title}
            </h3>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.11em] ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <JobDetail
            icon={<Ship className="h-4 w-4" aria-hidden />}
            label={c.yacht}
            value={yachtName || job.yachtBrand || c.privateYacht}
          />
          <JobDetail
            icon={<MapPin className="h-4 w-4" aria-hidden />}
            label={c.location}
            value={job.location || c.notSpecified}
          />
          <JobDetail
            icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            label={c.startDate}
            value={job.startDate ? formatDate(job.startDate, language) : c.notSpecified}
          />
          <JobDetail
            icon={<Clock3 className="h-4 w-4" aria-hidden />}
            label={c.updated}
            value={formatDate(job.updatedAt, language)}
          />
        </dl>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-cyan-800 shadow-sm">
              <UsersRound className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-800">
                {c.applicants}
              </p>
              <p className="mt-0.5 text-2xl font-semibold leading-none text-[#071f3c]">
                {applicantCount ?? "—"}
              </p>
            </div>
          </div>
          <Link
            href={`/hiring/jobs/${encodeURIComponent(job.id)}/applications`}
            className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
          >
            {c.viewApplicants}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canEdit && !terminal ? (
            <Link
              href={`/hiring/jobs?job=${encodeURIComponent(job.id)}`}
              className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <FilePenLine className="h-4 w-4" aria-hidden />
              {c.editPost}
            </Link>
          ) : null}
          {job.status === "published" && !expired ? (
            <Link
              href={`/jobs/${encodeURIComponent(job.id)}`}
              className="bd-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-[#071f3c] transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <Eye className="h-4 w-4" aria-hidden />
              {c.viewLive}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
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
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 text-cyan-700">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-500">
          {label}
        </dt>
        <dd data-i18n-ignore className="mt-0.5 truncate font-semibold text-slate-800">
          {value}
        </dd>
      </div>
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
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{text}</p>
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
      <div className="bd-ocean-content text-center" role="status" aria-live="polite">
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
