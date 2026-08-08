"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Compass,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Ruler,
  Search,
  Ship,
  SlidersHorizontal,
  UserRoundPlus,
  X,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../components/PublicSiteChrome";
import { useLanguage } from "../components/LanguageProvider";
import {
  formatJobCandidateType,
  formatJobEmploymentType,
  formatJobYachtLength,
  formatJobYachtType,
  isJobEmploymentType,
  jobEmploymentTypes,
} from "../lib/jobPosts";
import {
  formatJobDate,
  formatJobSalary,
  parsePublicJobCards,
  type PublicJobCard,
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
  const [jobs, setJobs] = useState<PublicJobCard[]>([]);
  const [requestVersion, setRequestVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const viewer = useJobListingViewer();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedEmploymentType = params.get("employmentType") || "";

    setQuery((params.get("query") || "").slice(0, 120));
    setLocation((params.get("location") || "").slice(0, 120));
    setEmploymentType(
      isJobEmploymentType(requestedEmploymentType)
        ? requestedEmploymentType
        : "",
    );
  }, []);

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

        const parsedJobs = parsePublicJobCards(payload.jobs);
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
        jobs.map((job) => job.position),
        language,
      ),
    [jobs, language],
  );
  const locations = useMemo(
    () =>
      uniqueSorted(
        [...jobs.map((job) => job.location), ...(location ? [location] : [])],
        language,
      ),
    [jobs, language, location],
  );
  const employmentTypes = jobEmploymentTypes;

  const filteredJobs = useMemo(() => {
    const locale = language === "tr" ? "tr-TR" : "en-US";
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    const normalizedLocation = location.trim().toLocaleLowerCase(locale);

    return jobs.filter((job) => {
      const yachtType = job.yachtType
        ? formatJobYachtType(job.yachtType, language)
        : "";
      const yachtLength =
        job.yachtLength !== null && job.yachtLengthUnit
          ? formatJobYachtLength(
              job.yachtLength,
              job.yachtLengthUnit,
              language,
            )
          : "";
      const searchableText = [
        job.position,
        formatJobEmploymentType(job.employmentType, language),
        job.location,
        yachtType,
        yachtLength,
        job.candidateType === "individual"
          ? ""
          : formatJobCandidateType(job.candidateType, language),
        formatJobSalary(job.salary, language),
      ]
        .join(" ")
        .toLocaleLowerCase(locale);

      if (normalizedQuery && !searchableText.includes(normalizedQuery)) {
        return false;
      }
      if (position && job.position !== position) return false;
      if (
        normalizedLocation &&
        !job.location.toLocaleLowerCase(locale).includes(normalizedLocation)
      ) {
        return false;
      }
      if (employmentType && job.employmentType !== employmentType) return false;
      return true;
    });
  }, [employmentType, jobs, language, location, position, query]);

  const hasFilters = Boolean(query || position || location || employmentType);
  const isEmployerViewer =
    viewer.kind === "signed-in" &&
    (viewer.role === "owner" || viewer.role === "management");
  const emptyAction =
    viewer.kind === "loading"
      ? null
      : isEmployerViewer
        ? { href: "/hiring", label: c.openHiring }
        : viewer.kind === "signed-in"
          ? viewer.role === "crew" || viewer.role === "captain"
            ? { href: "/profile", label: c.manageProfile }
            : { href: "/dashboard", label: c.openDashboard }
          : {
              href: "/login?mode=signup&role=crew",
              label: c.createProfile,
            };

  function clearFilters() {
    setQuery("");
    setPosition("");
    setLocation("");
    setEmploymentType("");
    window.history.replaceState(null, "", "/jobs");
  }

  return (
    <div className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      <main id="main-content">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                <Compass className="h-4 w-4" aria-hidden />
                {c.eyebrow}
              </p>
              <h1 className="bd-serif mt-4 max-w-4xl text-4xl leading-[1.02] text-[#071f3c] sm:text-5xl lg:text-6xl">
                {c.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#526b83]">
                {c.intro}
              </p>
            </div>
          </div>
        </section>

        <section
          id="jobs-board"
          aria-label={c.results}
          className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-12"
        >
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
              text={isEmployerViewer ? c.employerEmptyText : c.emptyText}
              action={emptyAction}
            />
          ) : (
            <>
              <section
                aria-labelledby="jobs-filter-heading"
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              >
                <h2
                  id="jobs-filter-heading"
                  className="flex items-center gap-2 text-sm font-black text-[#071f3c]"
                >
                  <SlidersHorizontal className="h-5 w-5 text-cyan-700" aria-hidden />
                  {c.filters}
                </h2>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">
                      {c.search}
                    </span>
                    <span className="relative block">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-700" aria-hidden />
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={c.searchPlaceholder}
                        className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      />
                    </span>
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
                    optionLabel={(option) =>
                      isJobEmploymentType(option)
                        ? formatJobEmploymentType(option, language)
                        : option
                    }
                    onChange={setEmploymentType}
                  />
                </div>
              </section>

              <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
                <div aria-live="polite">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                    {c.results}
                  </p>
                  <h2
                    id="jobs-results-heading"
                    className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[#071f3c]"
                  >
                    <span data-i18n-ignore>{filteredJobs.length}</span> {c.roles}
                  </h2>
                </div>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-cyan-500 hover:text-cyan-900"
                  >
                    <X className="h-4 w-4" aria-hidden />
                    {c.clear}
                  </button>
                ) : null}
              </div>

              {filteredJobs.length > 0 ? (
                <div className="mt-5 grid gap-5">
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
                <div className="mt-5 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-12 text-center">
                  <Search className="mx-auto h-9 w-9 text-cyan-700" aria-hidden />
                  <h3 className="mt-4 text-2xl font-semibold text-[#071f3c]">
                    {c.noMatchesTitle}
                  </h3>
                  <p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">
                    {c.noMatchesText}
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="bd-focus mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
                  >
                    {c.clear}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function JobCard({
  job,
  language,
  viewer,
}: {
  job: PublicJobCard;
  language: "en" | "tr";
  viewer: JobListingViewer;
}) {
  const c = copy[language];
  const salary = formatJobSalary(job.salary, language);
  const yachtType = job.yachtType
    ? formatJobYachtType(job.yachtType, language)
    : "";
  const yachtLength =
    job.yachtLength !== null && job.yachtLengthUnit
      ? formatJobYachtLength(job.yachtLength, job.yachtLengthUnit, language)
      : "";
  const action = getJobListingAction(job.id, viewer, language);
  const titleId = `job-title-${job.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className="group relative grid overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white shadow-[0_18px_55px_-42px_rgba(7,31,60,0.48)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_24px_70px_-42px_rgba(8,145,178,0.38)] motion-reduce:transform-none lg:grid-cols-[minmax(13rem,0.9fr)_minmax(24rem,1.75fr)_minmax(16.5rem,0.85fr)]"
    >
      <div className="flex min-w-0 flex-col justify-center px-5 py-6 sm:px-7 lg:border-r lg:border-slate-200 lg:px-7 lg:py-7 xl:px-8">
        {job.candidateType !== "individual" ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill>
              {formatJobCandidateType(job.candidateType, language)}
            </StatusPill>
          </div>
        ) : null}

        <h3
          id={titleId}
          data-i18n-ignore
          className="min-w-0 break-words text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-[1.75rem]"
        >
          {job.position}
        </h3>
        <p
          data-i18n-ignore
          className="mt-3 flex items-center gap-2 text-sm font-black text-cyan-800"
        >
          <BriefcaseBusiness className="h-[1.1rem] w-[1.1rem] shrink-0" aria-hidden />
          <span>{formatJobEmploymentType(job.employmentType, language)}</span>
        </p>
        <p
          data-i18n-ignore
          className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-500"
        >
          <Clock3 className="h-[1.1rem] w-[1.1rem] shrink-0 text-cyan-700" aria-hidden />
          <span>
            {c.posted}: {formatJobDate(job.publishedAt, language)}
          </span>
        </p>
      </div>

      <div className="grid min-w-0 gap-x-8 gap-y-3 border-t border-slate-200 px-5 py-6 sm:grid-cols-2 sm:px-7 lg:border-t-0 lg:px-8 lg:py-7 xl:gap-x-10 xl:px-10">
        <div className="grid content-center gap-3">
          <InfoLine icon={<Ship />} value={yachtType || c.notSpecified} />
          <InfoLine icon={<Ruler />} value={yachtLength || c.notSpecified} />
          <InfoLine icon={<MapPin />} value={job.location} />
        </div>
        <div className="grid content-center gap-3">
          <InfoLine
            icon={<CalendarDays />}
            value={`${c.start}: ${
              job.startDate
                ? formatJobDate(job.startDate, language)
                : c.notSpecified
            }`}
          />
          <InfoLine
            icon={<CircleDollarSign />}
            value={salary || c.salaryNotSpecified}
            emphasized
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-center gap-2 border-t border-slate-200 px-5 py-6 sm:px-7 lg:border-l lg:border-t-0 lg:px-6 lg:py-7 xl:px-7">
        <Link
          href={action.detailHref}
          className="bd-focus flex min-h-14 items-center justify-between rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white shadow-[0_12px_28px_-18px_rgba(7,31,60,0.9)] transition hover:bg-cyan-800"
        >
          {c.viewRole}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden />
        </Link>
        {action.intent !== "view" ? (
          <Link
            href={action.href}
            className="bd-focus flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-center text-sm font-black text-[#071f3c] transition hover:border-cyan-500 hover:bg-cyan-50"
          >
            {action.intent === "signup" ? (
              <UserRoundPlus className="h-4 w-4" aria-hidden />
            ) : null}
            {action.label}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  options,
  optionLabel = (option) => option,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  optionLabel?: (option: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option data-i18n-ignore key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoLine({
  icon,
  value,
  emphasized = false,
}: {
  icon: React.ReactNode;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <p
      data-i18n-ignore
      className={`flex min-w-0 items-start gap-3 text-sm leading-6 ${
        emphasized ? "font-black text-slate-950" : "font-medium text-slate-600"
      }`}
    >
      <span className="mt-0.5 shrink-0 text-cyan-700 [&>svg]:h-[1.15rem] [&>svg]:w-[1.15rem]">
        {icon}
      </span>
      <span className="min-w-0 break-words">{value}</span>
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
      <div className="mt-6 grid gap-5">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="grid min-h-[250px] animate-pulse overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white lg:min-h-[190px] lg:grid-cols-[minmax(13rem,0.9fr)_minmax(24rem,1.75fr)_minmax(16.5rem,0.85fr)]"
          >
            <div className="px-7 py-7 lg:border-r lg:border-slate-100">
              <div className="h-8 w-3/4 rounded bg-slate-100" />
              <div className="mt-4 h-4 w-1/2 rounded bg-slate-100" />
              <div className="mt-4 h-4 w-2/3 rounded bg-slate-100" />
            </div>
            <div className="grid gap-5 border-t border-slate-100 px-7 py-7 sm:grid-cols-2 lg:border-t-0">
              <div className="space-y-4">
                <div className="h-4 rounded bg-slate-100" />
                <div className="h-4 w-3/4 rounded bg-slate-100" />
                <div className="h-4 w-5/6 rounded bg-slate-100" />
              </div>
              <div className="space-y-4">
                <div className="h-4 rounded bg-slate-100" />
                <div className="h-4 w-4/5 rounded bg-slate-100" />
              </div>
            </div>
            <div className="border-t border-slate-100 px-7 py-7 lg:border-l lg:border-t-0">
              <div className="h-14 rounded-xl bg-slate-100" />
              <div className="mt-2 h-12 rounded-xl bg-slate-100" />
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
    <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/70 px-6 py-12 text-center">
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
  action,
}: {
  title: string;
  text: string;
  action: { href: string; label: string } | null;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/50 px-6 py-12 text-center">
      <BriefcaseBusiness className="mx-auto h-10 w-10 text-cyan-700" aria-hidden />
      <h2 className="mt-5 text-2xl font-semibold text-[#071f3c]">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">{text}</p>
      {action ? (
        <Link
          href={action.href}
          className="bd-focus mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
        >
          {action.label}
        </Link>
      ) : null}
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
    posted: "Posted",
    notSpecified: "Not specified",
    salaryNotSpecified: "Salary not specified",
    viewRole: "View role details",
    loading: "Loading current opportunities…",
    errorTitle: "The job board could not be loaded",
    errorText: "Check your connection and try again.",
    retry: "Try again",
    emptyTitle: "There are no open roles right now",
    emptyText:
      "New opportunities will appear here when they are published. You can prepare your BlueDeck crew profile in the meantime.",
    employerEmptyText:
      "New opportunities will appear here when they are published. Continue to your hiring workspace to create and manage your own roles.",
    createProfile: "Create crew profile",
    manageProfile: "Manage crew profile",
    openHiring: "My Job Postings & Hiring",
    openDashboard: "Open dashboard",
    noMatchesTitle: "No roles match these filters",
    noMatchesText: "Clear one or more filters to explore the other open roles.",
  },
  tr: {
    eyebrow: "Açık yat pozisyonları",
    title: "Sıradaki göreviniz güvertede sizi bekliyor olabilir.",
    intro:
      "Pozisyon, konum, başlangıç ve çalışma biçimi açıkça belirtilen güncel yat mürettebatı fırsatlarını keşfedin.",
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
    posted: "Yayınlandı",
    notSpecified: "Belirtilmedi",
    salaryNotSpecified: "Maaş belirtilmedi",
    viewRole: "İlan detaylarını görüntüle",
    loading: "Güncel fırsatlar yükleniyor…",
    errorTitle: "İş ilanları yüklenemedi",
    errorText: "Bağlantınızı kontrol edip yeniden deneyin.",
    retry: "Tekrar dene",
    emptyTitle: "Şu anda açık pozisyon yok",
    emptyText:
      "Yeni fırsatlar yayınlandığında burada görünecek. Bu sırada BlueDeck crew profilinizi hazırlayabilirsiniz.",
    employerEmptyText:
      "Yeni fırsatlar yayınlandığında burada görünecek. Kendi ilanlarınızı oluşturmak ve yönetmek için işe alım alanınıza devam edin.",
    createProfile: "Crew profili oluştur",
    manageProfile: "Crew profilini yönet",
    openHiring: "İş İlanlarım ve İşe Alım",
    openDashboard: "Dashboard’u aç",
    noMatchesTitle: "Bu filtrelere uygun ilan yok",
    noMatchesText: "Diğer açık pozisyonları görmek için bir veya daha fazla filtreyi temizleyin.",
  },
} as const;
