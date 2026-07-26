"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleDollarSign,
  Cigarette,
  Clock3,
  Fingerprint,
  Languages,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Ruler,
  ShieldCheck,
  Ship,
  UsersRound,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../../components/PublicSiteChrome";
import { useLanguage } from "../../components/LanguageProvider";
import { formatCountryWithFlag } from "../../lib/countries";
import {
  formatJobMinimumYachtExperience,
  formatJobCrewMemberCount,
  formatJobListingNumber,
  formatJobRequiredLanguage,
  formatJobSmokerPolicy,
  formatJobVisibleTattooPolicy,
  formatJobYachtLength,
  formatJobYachtBuildYear,
  formatJobYachtType,
} from "../../lib/jobPosts";
import {
  formatJobDate,
  formatJobSalary,
  parsePublicJob,
  type PublicJob,
  yachtLabel,
} from "../job-data";
import { JobApplicationPanel } from "./JobApplicationPanel";

type LoadState = "loading" | "ready" | "not-found" | "error";

export function JobDetailClient({ jobId }: { jobId: string }) {
  const { language } = useLanguage();
  const c = copy[language];
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [job, setJob] = useState<PublicJob | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadJob() {
      if (!jobId.trim()) {
        setLoadState("not-found");
        return;
      }

      setLoadState("loading");

      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (response.status === 404) {
          setJob(null);
          setLoadState("not-found");
          return;
        }

        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || !isRecord(payload) || payload.ok !== true) {
          throw new Error("job_request_failed");
        }

        const parsedJob = parsePublicJob(payload.job);
        if (!parsedJob) throw new Error("job_response_invalid");

        setJob(parsedJob);
        setLoadState("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setJob(null);
        setLoadState("error");
      }
    }

    void loadJob();
    return () => controller.abort();
  }, [jobId, requestVersion]);

  useEffect(() => {
    if (loadState !== "ready" || !job || window.location.hash !== "#apply") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("apply")?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [job, loadState]);

  return (
    <main className="bd-site-shell min-h-screen text-[#071f3c]">
      <PublicHeader />

      {loadState === "loading" ? (
        <DetailLoading label={c.loading} />
      ) : loadState === "not-found" ? (
        <DetailMessage
          icon={<BriefcaseBusiness />}
          title={c.notFoundTitle}
          text={c.notFoundText}
          actionLabel={c.back}
        />
      ) : loadState === "error" ? (
        <DetailMessage
          icon={<RefreshCw />}
          title={c.errorTitle}
          text={c.errorText}
          actionLabel={c.retry}
          onAction={() => setRequestVersion((current) => current + 1)}
        />
      ) : job ? (
        <JobDetail job={job} language={language} />
      ) : null}

      <PublicFooter />
    </main>
  );
}

function JobDetail({
  job,
  language,
}: {
  job: PublicJob;
  language: "en" | "tr";
}) {
  const c = copy[language];
  const salary = formatJobSalary(job.salary, language);
  const yacht = yachtLabel(job);
  const yachtType = job.yachtType
    ? formatJobYachtType(job.yachtType, language)
    : "";
  const yachtFlag = job.yachtFlagCountryCode
    ? formatCountryWithFlag(job.yachtFlagCountryCode)
    : "";
  const yachtBuildYear =
    job.yachtBuildYear === null
      ? ""
      : formatJobYachtBuildYear(job.yachtBuildYear, language);
  const yachtLength =
    job.yachtLength !== null && job.yachtLengthUnit
      ? formatJobYachtLength(
          job.yachtLength,
          job.yachtLengthUnit,
          language,
        )
      : "";
  const minimumYachtExperience =
    job.minimumYachtExperience === null
      ? ""
      : formatJobMinimumYachtExperience(
          job.minimumYachtExperience,
          language,
        );
  const crewMemberCount =
    job.crewMemberCount === null
      ? ""
      : formatJobCrewMemberCount(job.crewMemberCount, language);
  const teamCouple = job.candidateType === "individual" ? c.no : c.yes;
  const smokerPolicy = formatJobSmokerPolicy(job.smokerPolicy, language);
  const visibleTattooPolicy = formatJobVisibleTattooPolicy(
    job.visibleTattooPolicy,
    language,
  );
  const requiredLanguages = job.requiredLanguages
    .map((item) => formatJobRequiredLanguage(item, language))
    .join(", ");

  return (
    <>
      <section className="border-b border-[#071f3c]/8 bg-[linear-gradient(145deg,#f4fafc,#ffffff)]">
        <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
          <Link
            href="/jobs"
            className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-cyan-300 hover:text-cyan-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {c.back}
          </Link>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <article className="overflow-hidden rounded-[32px] border border-[#071f3c]/10 bg-white shadow-2xl shadow-[#071f3c]/7">
              <div className="h-2 bg-[linear-gradient(90deg,#083344,#22d3ee,#8ed8e6)]" />
              <div className="p-6 sm:p-9">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                    <BadgeCheck className="h-4 w-4" aria-hidden />
                    {c.publishedRole}
                  </div>
                  <p
                    data-i18n-ignore
                    aria-label={`${c.listingNumber} ${formatJobListingNumber(job.listingNumber)}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-black tracking-[0.12em] text-cyan-800"
                  >
                    {formatJobListingNumber(job.listingNumber)}
                  </p>
                </div>
                <h1 data-i18n-ignore className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-6xl">
                  {job.title}
                </h1>
                {job.position && job.position !== job.title ? (
                  <p data-i18n-ignore className="mt-3 text-xl font-black text-cyan-800">
                    {job.position}
                  </p>
                ) : null}
                {yacht ? (
                  <p data-i18n-ignore className="mt-5 flex items-start gap-2.5 text-base font-semibold text-slate-600">
                    <Ship className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700" aria-hidden />
                    <span>{yacht}</span>
                  </p>
                ) : null}

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {job.yachtBrand ? (
                    <JobFact
                      icon={<Ship />}
                      label={c.yachtBrand}
                      value={job.yachtBrand}
                    />
                  ) : null}
                  {yachtFlag ? (
                    <JobFact
                      icon={<Ship />}
                      label={c.yachtFlag}
                      value={yachtFlag}
                    />
                  ) : null}
                  {yachtBuildYear ? (
                    <JobFact
                      icon={<CalendarDays />}
                      label={c.yachtBuildYear}
                      value={yachtBuildYear}
                    />
                  ) : null}
                  {yachtType ? (
                    <JobFact
                      icon={<Ship />}
                      label={c.yachtType}
                      value={yachtType}
                    />
                  ) : null}
                  {yachtLength ? (
                    <JobFact
                      icon={<Ruler />}
                      label={c.yachtLength}
                      value={yachtLength}
                    />
                  ) : null}
                  {crewMemberCount ? (
                    <JobFact
                      icon={<UsersRound />}
                      label={c.crewMemberCount}
                      value={crewMemberCount}
                    />
                  ) : null}
                  {minimumYachtExperience ? (
                    <JobFact
                      icon={<Award />}
                      label={c.minimumYachtExperience}
                      value={minimumYachtExperience}
                    />
                  ) : null}
                  {job.location ? (
                    <JobFact
                      icon={<MapPin />}
                      label={c.location}
                      value={job.location}
                    />
                  ) : null}
                  {job.employmentType ? (
                    <JobFact
                      icon={<BriefcaseBusiness />}
                      label={c.employmentType}
                      value={job.employmentType}
                    />
                  ) : null}
                  <JobFact
                    icon={<UsersRound />}
                    label={c.teamCouple}
                    value={teamCouple}
                  />
                  {job.smokerPolicy !== "no_preference" ? (
                    <JobFact
                      icon={<Cigarette />}
                      label={c.smoker}
                      value={smokerPolicy}
                    />
                  ) : null}
                  {job.visibleTattooPolicy !== "no_preference" ? (
                    <JobFact
                      icon={<Fingerprint />}
                      label={c.visibleTattoos}
                      value={visibleTattooPolicy}
                    />
                  ) : null}
                  {requiredLanguages ? (
                    <JobFact
                      icon={<Languages />}
                      label={c.languages}
                      value={requiredLanguages}
                    />
                  ) : null}
                  {job.startDate ? (
                    <JobFact
                      icon={<CalendarDays />}
                      label={c.start}
                      value={formatJobDate(job.startDate, language)}
                    />
                  ) : null}
                  {salary ? (
                    <JobFact
                      icon={<CircleDollarSign />}
                      label={c.salary}
                      value={salary}
                    />
                  ) : null}
                </div>

                {job.description ? (
                  <section className="mt-9 border-t border-slate-200 pt-8">
                    <SectionLabel>{c.description}</SectionLabel>
                    <p data-i18n-ignore className="mt-4 whitespace-pre-line text-base leading-8 text-slate-600">
                      {job.description}
                    </p>
                  </section>
                ) : null}

                <div className="mt-9 grid gap-8 border-t border-slate-200 pt-8 md:grid-cols-2">
                  <JobTagList title={c.skills} items={job.requiredSkills} />
                  <JobTagList
                    title={c.characteristics}
                    items={job.requiredCharacteristics}
                  />
                  <JobList
                    title={c.certificatesDocuments}
                    items={job.requiredCertificates}
                  />
                  <JobList title={c.visas} items={job.requiredVisas} />
                  <JobList title={c.benefits} items={job.benefits} />
                </div>
              </div>
            </article>

            <aside className="space-y-5 lg:sticky lg:top-[calc(var(--public-header-height)+2rem)]">
              <div
                id="apply"
                className="scroll-mt-28 overflow-hidden rounded-[28px] border border-[#071f3c]/10 bg-white shadow-2xl shadow-[#071f3c]/7"
              >
                <div className="h-1.5 bg-[linear-gradient(90deg,#083344,#22d3ee,#8ed8e6)]" />
                <div className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#071f3c] text-cyan-200">
                    <ShieldCheck className="h-6 w-6" aria-hidden />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    {c.secureTitle}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {c.secureText}
                  </p>

                  <div className="mt-6 grid gap-3 border-t border-slate-200 pt-6">
                    {job.publishedAt ? (
                      <SidebarFact
                        label={c.published}
                        value={formatJobDate(job.publishedAt, language)}
                      />
                    ) : null}
                  </div>

                  <JobApplicationPanel jobId={job.id} language={language} />
                </div>
              </div>

              <div className="rounded-[24px] border border-cyan-100 bg-cyan-50/70 p-5">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-800">
                  <Clock3 className="h-4 w-4" aria-hidden />
                  {c.keepReady}
                </div>
                <p className="mt-3 text-sm leading-6 text-cyan-950">{c.keepReadyText}</p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}

function JobFact({
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
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
      </div>
      <p data-i18n-ignore className="mt-2 font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
      {children}
    </h2>
  );
}

function JobList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li
            data-i18n-ignore
            key={`${item}-${index}`}
            className="flex items-start gap-3 text-sm leading-6 text-slate-600"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function JobTagList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            data-i18n-ignore
            key={item}
            className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-[#173f4a]"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function SidebarFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span data-i18n-ignore className="text-right font-black text-slate-900">
        {value}
      </span>
    </div>
  );
}

function DetailLoading({ label }: { label: string }) {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
      <div className="flex items-center gap-3 text-sm font-black text-cyan-800" aria-live="polite" aria-busy="true">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
        {label}
      </div>
      <div className="mt-8 grid animate-pulse gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-[620px] rounded-[32px] border border-slate-200 bg-white p-8">
          <div className="h-7 w-40 rounded-full bg-slate-100" />
          <div className="mt-8 h-12 w-3/4 rounded bg-slate-100" />
          <div className="mt-5 h-5 w-1/2 rounded bg-slate-100" />
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-2xl bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="h-[420px] rounded-[28px] border border-slate-200 bg-white p-6">
          <div className="h-12 w-12 rounded-2xl bg-slate-100" />
          <div className="mt-6 h-8 w-3/4 rounded bg-slate-100" />
          <div className="mt-5 h-4 rounded bg-slate-100" />
          <div className="mt-3 h-4 w-5/6 rounded bg-slate-100" />
        </div>
      </div>
    </section>
  );
}

function DetailMessage({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <section className="mx-auto max-w-[920px] px-5 py-16 sm:px-8 lg:py-24">
      <div role="alert" className="rounded-[30px] border border-cyan-200 bg-white px-6 py-14 text-center shadow-xl shadow-[#071f3c]/5">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 [&>svg]:h-7 [&>svg]:w-7">
          {icon}
        </span>
        <h1 className="mt-5 text-3xl font-semibold text-[#071f3c]">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-600">{text}</p>
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="bd-focus mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
          >
            {actionLabel}
          </button>
        ) : (
          <Link
            href="/jobs"
            className="bd-focus mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const copy = {
  en: {
    back: "Back to jobs",
    publishedRole: "Published BlueDeck role",
    listingNumber: "Listing no.",
    yachtBrand: "Yacht brand",
    yachtFlag: "Yacht flag",
    yachtBuildYear: "Yacht build year",
    yachtType: "Yacht type",
    yachtLength: "Yacht length",
    crewMemberCount: "Crew members",
    minimumYachtExperience: "Minimum yacht experience",
    location: "Location",
    employmentType: "Employment",
    teamCouple: "Team / Couple",
    yes: "Yes",
    no: "No",
    smoker: "Smoking",
    visibleTattoos: "Visible tattoos",
    languages: "Required languages",
    start: "Start date",
    salary: "Salary",
    description: "About the role",
    skills: "Skills",
    characteristics: "Characteristics",
    certificatesDocuments: "Certificates & documents",
    visas: "Required visas",
    benefits: "Benefits",
    published: "Published",
    secureTitle: "Apply securely",
    secureText:
      "Crew and Captain accounts can apply with a short note and their professional BlueDeck profile summary.",
    keepReady: "A professional first step",
    keepReadyText:
      "Keep your experience, certificates and availability current so your profile is ready for secure hiring workflows.",
    loading: "Loading role details…",
    notFoundTitle: "This role is no longer available",
    notFoundText:
      "The listing may have closed or been removed. Browse the current opportunities instead.",
    errorTitle: "The role could not be loaded",
    errorText: "Check your connection and try again.",
    retry: "Try again",
  },
  tr: {
    back: "İş ilanlarına dön",
    publishedRole: "Yayınlanmış BlueDeck ilanı",
    listingNumber: "İlan no:",
    yachtBrand: "Yat markası",
    yachtFlag: "Yat bayrağı",
    yachtBuildYear: "Yat yapım yılı",
    yachtType: "Yat türü",
    yachtLength: "Yat uzunluğu",
    crewMemberCount: "Mürettebat sayısı",
    minimumYachtExperience: "Minimum yat deneyimi",
    location: "Konum",
    employmentType: "Çalışma biçimi",
    teamCouple: "Team / Couple",
    yes: "Evet",
    no: "Hayır",
    smoker: "Sigara",
    visibleTattoos: "Görünür dövme",
    languages: "Gerekli diller",
    start: "Başlangıç tarihi",
    salary: "Maaş",
    description: "Pozisyon hakkında",
    skills: "Beceriler",
    characteristics: "Karakter özellikleri",
    certificatesDocuments: "Sertifikalar ve evraklar",
    visas: "Gerekli vizeler",
    benefits: "Yan haklar",
    published: "Yayınlandı",
    secureTitle: "Güvenle başvurun",
    secureText:
      "Crew ve Captain hesapları kısa bir not ve profesyonel BlueDeck profil özetiyle başvurabilir.",
    keepReady: "Profesyonel bir ilk adım",
    keepReadyText:
      "Profilinizin güvenli işe alım akışlarına hazır olması için deneyim, sertifika ve müsaitlik bilgilerinizi güncel tutun.",
    loading: "İlan ayrıntıları yükleniyor…",
    notFoundTitle: "Bu pozisyon artık açık değil",
    notFoundText:
      "İlan kapanmış veya kaldırılmış olabilir. Bunun yerine güncel fırsatlara göz atın.",
    errorTitle: "İlan yüklenemedi",
    errorText: "Bağlantınızı kontrol edip yeniden deneyin.",
    retry: "Tekrar dene",
  },
} as const;
