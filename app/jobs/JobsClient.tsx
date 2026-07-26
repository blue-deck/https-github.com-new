"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Compass,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Ruler,
  Search,
  ShieldCheck,
  Ship,
  SlidersHorizontal,
  UserRoundPlus,
  X,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";
import {
  formatJobCandidateType,
  formatJobListingNumber,
  formatJobSmokerPolicy,
  formatJobVisibleTattooPolicy,
} from "../lib/jobPosts";
import {
  formatJobDate,
  formatJobSalary,
  minimumYachtExperienceLabel,
  parsePublicJobs,
  type PublicJob,
  yachtLabel,
  yachtSpecificationLabel,
} from "./job-data";
import {
  getJobListingAction,
  useJobListingViewer,
  type JobListingViewer,
} from "./JobListingAction";

type LoadState = "loading" | "ready" | "error";

export function JobsClient() {
  const { language } = useLanguage();
  const c = copy[language];
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [requestVersion, setRequestVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const viewer = useJobListingViewer();

  useEffect(() => {
    const controller = new AbortController();

    async function loadJobs() {
      setLoadState("loading");

      try {
        const response = await fetch("/api/jobs", {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);

        if (
          !response.ok ||
          !isRecord(payload) ||
          payload.ok !== true
        ) {
          throw new Error("jobs_request_failed");
        }

        const parsedJobs = parsePublicJobs(payload.jobs);
        if (!parsedJobs) throw new Error("jobs_response_invalid");

        setJobs(parsedJobs);
        setLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState("error");
      }
    }

    void loadJobs();
    return () => controller.abort();
  }, [requestVersion]);

  const positions = useMemo(
    () =>
      uniqueSorted(
        jobs.map((job) => job.position || job.title),
        language,
      ),
    [jobs, language],
  );
  const locations = useMemo(
    () => uniqueSorted(jobs.map((job) => job.location), language),
    [jobs, language],
  );
  const employmentTypes = useMemo(
    () => uniqueSorted(jobs.map((job) => job.employmentType), language),
    [jobs, language],
  );

  const filteredJobs = useMemo(() => {
    const locale = language === "tr" ? "tr-TR" : "en-US";
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);

    return jobs.filter((job) => {
      const yachtSpecification = yachtSpecificationLabel(job, language);
      const minimumYachtExperience = minimumYachtExperienceLabel(
        job,
        language,
      );
      const candidateType = formatJobCandidateType(job.candidateType, language);
      const smokerPolicy = formatJobSmokerPolicy(job.smokerPolicy, language);
      const visibleTattooPolicy = formatJobVisibleTattooPolicy(
        job.visibleTattooPolicy,
        language,
      );
      const searchableText = [
        job.title,
        job.position,
        job.employmentType,
        job.location,
        job.listingNumber,
        formatJobListingNumber(job.listingNumber),
        yachtLabel(job),
        yachtSpecification,
        minimumYachtExperience,
        candidateType,
        job.candidateType,
        smokerPolicy,
        visibleTattooPolicy,
        job.requiredLanguages.join(" "),
        job.minimumYachtExperienceYears === null
          ? ""
          : String(job.minimumYachtExperienceYears),
        job.yachtType || "",
        job.yachtLength === null ? "" : String(job.yachtLength),
      ]
        .join(" ")
        .toLocaleLowerCase(locale);

      if (normalizedQuery && !searchableText.includes(normalizedQuery)) {
        return false;
      }
      if (position && (job.position || job.title) !== position) return false;
      if (location && job.location !== location) return false;
      if (employmentType && job.employmentType !== employmentType) return false;
      return true;
    });
  }, [employmentType, jobs, language, location, position, query]);

  const hasFilters = Boolean(query || position || location || employmentType);

  function clearFilters() {
    setQuery("");
    setPosition("");
    setLocation("");
    setEmploymentType("");
  }

  return (
    <main className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <section className="relative overflow-hidden border-b border-[#071f3c]/8 bg-[linear-gradient(145deg,#f7fbfd_0%,#eaf4f7_52%,#ffffff_100%)]">
        <div className="mx-auto grid max-w-[1500px] gap-10 px-5 pb-14 pt-14 sm:px-8 lg:grid-cols-[1fr_0.72fr] lg:items-end lg:px-12 lg:pb-20 lg:pt-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-800 shadow-sm">
              <Compass className="h-4 w-4" aria-hidden />
              {c.eyebrow}
            </div>
            <h1 className="bd-serif mt-6 max-w-4xl text-5xl leading-[0.98] text-[#071f3c] sm:text-7xl">
              {c.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#526b83]">
              {c.intro}
            </p>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-white/76 p-5 shadow-2xl shadow-[#071f3c]/8 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              {c.trustTitle}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{c.trustText}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        {loadState === "loading" ? (
          <JobsLoadingState label={c.loading} />
        ) : loadState === "error" ? (
          <RequestError
            title={c.errorTitle}
            text={c.errorText}
            retry={c.retry}
            onRetry={() => setRequestVersion((current) => current + 1)}
          />
        ) : jobs.length === 0 ? (
          <EmptyState
            title={c.emptyTitle}
            text={c.emptyText}
            actionLabel={c.createProfile}
          />
        ) : (
          <>
            <div className="rounded-[28px] border border-[#071f3c]/10 bg-white p-4 shadow-xl shadow-[#071f3c]/5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-black text-[#071f3c]">
                <SlidersHorizontal className="h-5 w-5 text-cyan-700" aria-hidden />
                {c.filters}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
                <label className="relative block">
                  <span className="sr-only">{c.search}</span>
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-700" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={c.searchPlaceholder}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </label>
                <FilterSelect
                  label={c.position}
                  value={position}
                  options={positions}
                  onChange={setPosition}
                />
                <FilterSelect
                  label={c.location}
                  value={location}
                  options={locations}
                  onChange={setLocation}
                />
                <FilterSelect
                  label={c.employmentType}
                  value={employmentType}
                  options={employmentTypes}
                  onChange={setEmploymentType}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <div aria-live="polite">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                  {c.results}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#071f3c]">
                  <span data-i18n-ignore>{filteredJobs.length}</span> {c.roles}
                </h2>
              </div>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-cyan-300 hover:text-cyan-800"
                >
                  <X className="h-4 w-4" aria-hidden />
                  {c.clear}
                </button>
              ) : null}
            </div>

            {filteredJobs.length > 0 ? (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    language={language}
                    viewer={viewer}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[30px] border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-14 text-center">
                <Search className="mx-auto h-10 w-10 text-cyan-700" aria-hidden />
                <h3 className="mt-5 text-2xl font-semibold text-[#071f3c]">
                  {c.noMatchesTitle}
                </h3>
                <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">
                  {c.noMatchesText}
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="bd-focus mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                >
                  {c.clear}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <PublicFooter />
    </main>
  );
}

function JobCard({
  job,
  language,
  viewer,
}: {
  job: PublicJob;
  language: "en" | "tr";
  viewer: JobListingViewer;
}) {
  const c = copy[language];
  const salary = formatJobSalary(job.salary, language);
  const yacht = yachtLabel(job);
  const yachtSpecification = yachtSpecificationLabel(job, language);
  const minimumYachtExperience = minimumYachtExperienceLabel(job, language);
  const candidateType = formatJobCandidateType(job.candidateType, language);
  const action = getJobListingAction(job.id, viewer, language);

  return (
    <article className="group flex min-h-full flex-col overflow-hidden rounded-[28px] border border-[#071f3c]/10 bg-white shadow-xl shadow-[#071f3c]/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#071f3c]/9">
      <div className="h-1.5 bg-[linear-gradient(90deg,#083344,#22d3ee,#8ed8e6)]" />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {job.employmentType ? <StatusPill>{job.employmentType}</StatusPill> : null}
          {job.candidateType !== "individual" ? (
            <StatusPill>{candidateType}</StatusPill>
          ) : null}
        </div>

        <p
          data-i18n-ignore
          aria-label={`${c.listingNumber} ${formatJobListingNumber(job.listingNumber)}`}
          className="mt-4 font-mono text-[11px] font-black tracking-[0.14em] text-cyan-800"
        >
          {formatJobListingNumber(job.listingNumber)}
        </p>

        <h3 data-i18n-ignore className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
          {job.title}
        </h3>
        {job.position && job.position !== job.title ? (
          <p data-i18n-ignore className="mt-2 text-sm font-black text-cyan-800">
            {job.position}
          </p>
        ) : null}

        {yacht ? (
          <p data-i18n-ignore className="mt-4 flex items-start gap-2.5 text-sm font-semibold text-slate-600">
            <Ship className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" aria-hidden />
            <span>{yacht}</span>
          </p>
        ) : null}

        <div className="mt-5 space-y-2.5 text-sm text-slate-600">
          {yachtSpecification ? (
            <InfoLine icon={<Ruler />} value={yachtSpecification} />
          ) : null}
          {minimumYachtExperience ? (
            <InfoLine icon={<Award />} value={minimumYachtExperience} />
          ) : null}
          {job.location ? (
            <InfoLine icon={<MapPin />} value={job.location} />
          ) : null}
          {job.startDate ? (
            <InfoLine
              icon={<CalendarDays />}
              value={`${c.start}: ${formatJobDate(job.startDate, language)}`}
            />
          ) : null}
          {salary ? (
            <InfoLine icon={<CircleDollarSign />} value={salary} />
          ) : null}
        </div>

        <div className="mt-auto pt-6">
          <Link
            href={action.href}
            className="bd-focus flex min-h-12 items-center justify-between rounded-xl bg-[#071f3c] px-4 text-sm font-black text-white transition hover:bg-cyan-800"
          >
            <span className="inline-flex items-center gap-2">
              {viewer.kind === "signed-out" ? (
                <UserRoundPlus className="h-4 w-4" aria-hidden />
              ) : null}
              {action.label}
            </span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          {viewer.kind === "signed-out" ? (
            <Link
              href={action.detailHref}
              className="bd-focus mt-2 flex min-h-10 items-center justify-center rounded-xl text-xs font-black text-cyan-800 transition hover:bg-cyan-50 hover:text-cyan-950"
            >
              {c.viewRole}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option data-i18n-ignore key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoLine({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <p data-i18n-ignore className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-cyan-700 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <span>{value}</span>
    </p>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      data-i18n-ignore
      className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-900"
    >
      {children}
    </span>
  );
}

function JobsLoadingState({ label }: { label: string }) {
  return (
    <div aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3 text-sm font-black text-cyan-800">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
        {label}
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="min-h-[360px] animate-pulse rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl shadow-[#071f3c]/5"
          >
            <div className="h-7 w-28 rounded-full bg-slate-100" />
            <div className="mt-7 h-8 w-3/4 rounded bg-slate-100" />
            <div className="mt-4 h-4 w-1/2 rounded bg-slate-100" />
            <div className="mt-9 space-y-3">
              <div className="h-4 rounded bg-slate-100" />
              <div className="h-4 w-4/5 rounded bg-slate-100" />
              <div className="h-4 w-3/5 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestError({
  title,
  text,
  retry,
  onRetry,
}: {
  title: string;
  text: string;
  retry: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="rounded-[30px] border border-rose-200 bg-rose-50/70 px-6 py-14 text-center">
      <RefreshCw className="mx-auto h-10 w-10 text-rose-700" aria-hidden />
      <h2 className="mt-5 text-2xl font-semibold text-[#071f3c]">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">{text}</p>
      <button
        type="button"
        onClick={onRetry}
        className="bd-focus mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        {retry}
      </button>
    </div>
  );
}

function EmptyState({
  title,
  text,
  actionLabel,
}: {
  title: string;
  text: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-[30px] border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-14 text-center">
      <BriefcaseBusiness className="mx-auto h-10 w-10 text-cyan-700" aria-hidden />
      <h2 className="mt-5 text-2xl font-semibold text-[#071f3c]">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">{text}</p>
      <Link
        href="/login?mode=signup&role=crew"
        className="bd-focus mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

function uniqueSorted(values: string[], language: "en" | "tr") {
  const locale = language === "tr" ? "tr-TR" : "en-GB";
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, locale),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const copy = {
  en: {
    eyebrow: "Open yacht roles",
    title: "Your next role may already be on deck.",
    intro:
      "Explore current yacht crew opportunities with clear role, location, start and employment details.",
    trustTitle: "Purposeful public listings",
    trustText:
      "Only active role information is shown here. Candidate contact details and private hiring conversations stay outside the public page.",
    filters: "Search and filters",
    search: "Search jobs",
    searchPlaceholder: "Role, yacht type or location",
    position: "All positions",
    location: "All locations",
    employmentType: "All employment types",
    results: "Current opportunities",
    roles: "open roles",
    clear: "Clear filters",
    start: "Start",
    listingNumber: "Listing no.",
    viewRole: "View role",
    loading: "Loading current opportunities…",
    errorTitle: "The job board could not be loaded",
    errorText: "Check your connection and try again.",
    retry: "Try again",
    emptyTitle: "There are no open roles right now",
    emptyText:
      "New opportunities will appear here when they are published. You can prepare your BlueDeck crew profile in the meantime.",
    createProfile: "Create crew profile",
    noMatchesTitle: "No roles match these filters",
    noMatchesText: "Clear one or more filters to explore the other open roles.",
  },
  tr: {
    eyebrow: "Açık yat pozisyonları",
    title: "Sıradaki göreviniz güvertede sizi bekliyor olabilir.",
    intro:
      "Pozisyon, konum, başlangıç ve çalışma biçimi açıkça belirtilen güncel yat mürettebatı fırsatlarını keşfedin.",
    trustTitle: "Amaca uygun herkese açık ilanlar",
    trustText:
      "Burada yalnızca aktif ilana ait bilgiler gösterilir. Aday iletişim bilgileri ve özel işe alım görüşmeleri herkese açık sayfanın dışında kalır.",
    filters: "Arama ve filtreler",
    search: "İlan ara",
    searchPlaceholder: "Pozisyon, yat türü veya konum",
    position: "Tüm pozisyonlar",
    location: "Tüm konumlar",
    employmentType: "Tüm çalışma biçimleri",
    results: "Güncel fırsatlar",
    roles: "açık pozisyon",
    clear: "Filtreleri temizle",
    start: "Başlangıç",
    listingNumber: "İlan no:",
    viewRole: "İlanı görüntüle",
    loading: "Güncel fırsatlar yükleniyor…",
    errorTitle: "İş ilanları yüklenemedi",
    errorText: "Bağlantınızı kontrol edip yeniden deneyin.",
    retry: "Tekrar dene",
    emptyTitle: "Şu anda açık pozisyon yok",
    emptyText:
      "Yeni fırsatlar yayınlandığında burada görünecek. Bu sırada BlueDeck crew profilinizi hazırlayabilirsiniz.",
    createProfile: "Crew profili oluştur",
    noMatchesTitle: "Bu filtrelere uygun ilan yok",
    noMatchesText: "Diğer açık pozisyonları görmek için bir veya daha fazla filtreyi temizleyin.",
  },
} as const;
