"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleDollarSign,
  LoaderCircle,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../../components/PublicSiteChrome";
import { useLanguage } from "../../components/LanguageProvider";
import { formatCountryWithFlag } from "../../lib/countries";
import {
  formatJobCandidateType,
  formatJobEmploymentType,
  formatJobMinimumYachtExperience,
  formatJobCrewMemberCount,
  formatJobListingNumber,
  formatJobRequiredLanguage,
  formatJobSmokerPolicy,
  formatJobVisa,
  formatJobVisibleTattooPolicy,
  formatJobYachtLength,
  formatJobYachtType,
} from "../../lib/jobPosts";
import {
  formatJobDate,
  formatJobSalary,
  parsePublicJob,
  type PublicJob,
} from "../job-data";
import { JobApplicationPanel } from "./JobApplicationPanel";

type LoadState = "loading" | "ready" | "not-found" | "error";

export function JobDetailClient({
  jobId,
  initialJob = null,
  embedded = false,
}: {
  jobId: string;
  initialJob?: PublicJob | null;
  embedded?: boolean;
}) {
  const { language } = useLanguage();
  const c = copy[language];
  const hasInitialJob = initialJob?.id === jobId;
  const [loadState, setLoadState] = useState<LoadState>(
    hasInitialJob ? "ready" : "loading",
  );
  const [job, setJob] = useState<PublicJob | null>(
    hasInitialJob ? initialJob : null,
  );
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (hasInitialJob && requestVersion === 0) return;

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
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setJob(null);
        setLoadState("error");
      }
    }

    void loadJob();
    return () => controller.abort();
  }, [hasInitialJob, jobId, requestVersion]);

  useEffect(() => {
    if (loadState !== "ready" || !job || window.location.hash !== "#apply") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const applicationSection = document.getElementById("apply");
      applicationSection?.scrollIntoView({ block: "start" });
      document.getElementById("apply-title")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [job, loadState]);

  const content =
    loadState === "loading" ? (
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
      <JobDetail job={job} language={language} embedded={embedded} />
    ) : null;

  if (embedded) {
    return <div className="min-h-full text-[#071f3c]">{content}</div>;
  }

  return (
    <>
      <PublicHeader />
      <main id="main-content" className="bd-site-shell min-h-screen text-[#071f3c]">
        {content}
      </main>
      <PublicFooter />
    </>
  );
}

function JobDetail({
  job,
  language,
  embedded,
}: {
  job: PublicJob;
  language: "en" | "tr";
  embedded: boolean;
}) {
  const c = copy[language];
  const salary = formatJobSalary(job.salary, language);
  const yachtType = job.yachtType
    ? formatJobYachtType(job.yachtType, language)
    : "";
  const yachtFlag = job.yachtFlagCountryCode
    ? formatCountryWithFlag(job.yachtFlagCountryCode)
    : "";
  const yachtLength =
    job.yachtLength !== null && job.yachtLengthUnit
      ? formatJobYachtLength(job.yachtLength, job.yachtLengthUnit, language)
      : "";
  const minimumYachtExperience =
    job.minimumYachtExperience === null
      ? ""
      : formatJobMinimumYachtExperience(job.minimumYachtExperience, language);
  const crewMemberCount =
    job.crewMemberCount === null
      ? ""
      : formatJobCrewMemberCount(job.crewMemberCount, language);
  const smokerPolicy = formatJobSmokerPolicy(job.smokerPolicy, language);
  const visibleTattooPolicy = formatJobVisibleTattooPolicy(
    job.visibleTattooPolicy,
    language,
  );
  const requiredLanguages = job.requiredLanguages
    .map((item) => formatJobRequiredLanguage(item, language))
    .join(", ");
  const roleOverview = plainJobText(job.description || job.summary);
  const essentialFacts: DetailItem[] = [];
  if (job.location) {
    essentialFacts.push({
      icon: <MapPin />,
      label: c.location,
      value: job.location,
    });
  }
  essentialFacts.push({
    icon: <BriefcaseBusiness />,
    label: c.employmentType,
    value: formatJobEmploymentType(job.employmentType, language),
  });
  if (job.startDate) {
    essentialFacts.push({
      icon: <CalendarDays />,
      label: c.start,
      value: formatJobDate(job.startDate, language),
    });
  }
  if (salary) {
    essentialFacts.push({
      icon: <CircleDollarSign />,
      label: c.salary,
      value: salary,
    });
  }

  const candidateDetails: DefinitionItem[] = [
    {
      label: c.candidateType,
      value:
        job.candidateType === "individual"
          ? c.individualCandidate
          : formatJobCandidateType(job.candidateType, language),
    },
  ];
  if (minimumYachtExperience) {
    candidateDetails.push({
      label: c.minimumYachtExperience,
      value: minimumYachtExperience,
    });
  }
  if (requiredLanguages) {
    candidateDetails.push({ label: c.languages, value: requiredLanguages });
  }
  if (job.smokerPolicy !== "no_preference") {
    candidateDetails.push({ label: c.smoker, value: smokerPolicy });
  }
  if (job.visibleTattooPolicy !== "no_preference") {
    candidateDetails.push({
      label: c.visibleTattoos,
      value: visibleTattooPolicy,
    });
  }

  const yachtDetails: DefinitionItem[] = [];
  if (job.yachtBrand) {
    yachtDetails.push({ label: c.yachtBrand, value: job.yachtBrand });
  }
  if (yachtType) {
    yachtDetails.push({ label: c.yachtType, value: yachtType });
  }
  if (yachtLength) {
    yachtDetails.push({ label: c.yachtLength, value: yachtLength });
  }
  if (yachtFlag) {
    yachtDetails.push({ label: c.yachtFlag, value: yachtFlag });
  }
  if (job.yachtBuildYear !== null) {
    yachtDetails.push({
      label: c.yachtBuildYear,
      value: String(job.yachtBuildYear),
    });
  }
  if (crewMemberCount) {
    yachtDetails.push({
      label: c.crewMemberCount,
      value: crewMemberCount,
    });
  }
  const hasRoleLists =
    job.responsibilities.length > 0 || job.requirements.length > 0;
  const hasCandidateRequirements =
    candidateDetails.length > 0 ||
    job.requiredSkills.length > 0 ||
    job.requiredCharacteristics.length > 0 ||
    job.requiredCertificates.length > 0 ||
    job.requiredVisas.length > 0;

  return (
    <>
      <section className="border-b border-[#071f3c]/10 bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          {!embedded ? (
            <Link
              href="/jobs"
              className="bd-focus inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-bold text-slate-600 transition hover:text-cyan-800"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {c.back}
            </Link>
          ) : null}

          <div className={`${embedded ? "" : "mt-7"} max-w-4xl`}>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] text-cyan-800">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                {c.publishedRole}
              </span>
              <span
                data-i18n-ignore
                aria-label={`${c.listingNumber} ${formatJobListingNumber(job.listingNumber)}`}
                className="font-mono text-xs font-black tracking-[0.12em] text-slate-500"
              >
                {formatJobListingNumber(job.listingNumber)}
              </span>
            </div>
            <h1
              data-i18n-ignore
              className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.5rem]"
            >
              {job.position || job.title}
            </h1>
            {job.department ? (
              <p
                data-i18n-ignore
                className="mt-3 text-sm font-semibold text-cyan-800"
              >
                {job.department}
              </p>
            ) : null}

            {essentialFacts.length > 0 ? (
              <dl className="mt-7 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4">
                {essentialFacts.map((item) => (
                  <EssentialFact key={item.label} {...item} />
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f9fc]">
        <div className="mx-auto grid max-w-[1180px] gap-6 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 lg:px-10 lg:py-12">
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm shadow-slate-950/5 sm:px-8 sm:py-8 lg:col-start-1 lg:row-start-1">
            {roleOverview ? (
              <DetailSection title={c.description} first>
                <p
                  data-i18n-ignore
                  className="whitespace-pre-line text-[15px] leading-7 text-slate-600 sm:text-base sm:leading-8"
                >
                  {roleOverview}
                </p>
              </DetailSection>
            ) : null}

            {hasRoleLists ? (
              <DetailSection title={c.roleDetails} first={!roleOverview}>
                <div className="grid gap-7 md:grid-cols-2">
                  <JobList
                    title={c.responsibilities}
                    items={job.responsibilities}
                  />
                  <JobList title={c.requirements} items={job.requirements} />
                </div>
              </DetailSection>
            ) : null}

            {hasCandidateRequirements ? (
              <DetailSection
                title={c.candidateRequirements}
                first={!roleOverview && !hasRoleLists}
              >
                <DefinitionGrid items={candidateDetails} />
                <div className="mt-7 grid gap-7 md:grid-cols-2">
                  <JobTagList title={c.skills} items={job.requiredSkills} />
                  <JobTagList
                    title={c.characteristics}
                    items={job.requiredCharacteristics}
                  />
                  <JobList
                    title={c.certificatesDocuments}
                    items={job.requiredCertificates}
                  />
                  <JobList
                    title={c.visas}
                    items={job.requiredVisas.map(formatJobVisa)}
                  />
                </div>
              </DetailSection>
            ) : null}

            {yachtDetails.length > 0 ? (
              <DetailSection
                title={c.yachtDetails}
                first={
                  !roleOverview && !hasRoleLists && !hasCandidateRequirements
                }
              >
                <DefinitionGrid items={yachtDetails} />
              </DetailSection>
            ) : null}

            {job.benefits.length > 0 ? (
              <DetailSection title={c.benefits}>
                <BulletList items={job.benefits} />
              </DetailSection>
            ) : null}
          </article>

          <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-[calc(var(--public-header-height)+1.5rem)]">
            <section
              id="apply"
              aria-labelledby="apply-title"
              className="scroll-mt-[calc(var(--public-header-height)+1.5rem)] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/5 sm:p-6"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">
                {c.applicationEyebrow}
              </p>
              <h2
                id="apply-title"
                tabIndex={-1}
                className="bd-focus mt-2 rounded-sm text-2xl font-semibold tracking-[-0.03em] text-slate-950"
              >
                {c.secureTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {c.secureText}
              </p>
              <JobApplicationPanel jobId={job.id} language={language} />
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}

type DetailItem = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

type DefinitionItem = {
  label: string;
  value: string;
};

function EssentialFact({ icon, label, value }: DetailItem) {
  return (
    <div className="min-w-0 border-l border-cyan-200 pl-3.5">
      <dt className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 [&>span>svg]:h-3.5 [&>span>svg]:w-3.5 [&>span>svg]:text-cyan-700">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd
        data-i18n-ignore
        className="mt-1 min-w-0 break-words text-sm font-semibold leading-5 text-slate-900 [overflow-wrap:anywhere]"
      >
        {value}
      </dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
  first = false,
}: {
  title: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <section className={first ? "" : "mt-8 border-t border-slate-200 pt-8"}>
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#071f3c] sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function JobList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="mt-3">
        <BulletList items={items} />
      </div>
    </section>
  );
}

function JobTagList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            data-i18n-ignore
            key={item}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function DefinitionGrid({ items }: { items: DefinitionItem[] }) {
  if (items.length === 0) return null;

  return (
    <dl className="grid gap-x-8 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="grid min-w-0 gap-1 border-b border-slate-100 py-3 sm:flex sm:items-baseline sm:justify-between sm:gap-4"
        >
          <dt className="text-sm text-slate-500">{item.label}</dt>
          <dd
            data-i18n-ignore
            className="min-w-0 break-words text-left text-sm font-semibold text-slate-900 [overflow-wrap:anywhere] sm:max-w-[65%] sm:text-right"
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li
          data-i18n-ignore
          key={`${item}-${index}`}
          className="flex items-start gap-2.5 text-sm leading-6 text-slate-600"
        >
          <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
            <Check className="h-3 w-3" aria-hidden />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailLoading({ label }: { label: string }) {
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
      <div
        role="status"
        className="flex items-center gap-3 text-sm font-bold text-cyan-800"
        aria-live="polite"
        aria-busy="true"
      >
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
        {label}
      </div>
      <div className="mt-7 animate-pulse" aria-hidden="true">
        <div className="h-6 w-44 rounded-full bg-slate-100" />
        <div className="mt-5 h-12 w-3/5 rounded bg-slate-100" />
        <div className="mt-7 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-12 border-l border-slate-200 pl-3">
              <div className="h-3 w-16 rounded bg-slate-100" />
              <div className="mt-2 h-4 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
      <div
        className="mt-10 grid animate-pulse gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8"
        aria-hidden="true"
      >
        <div className="min-h-[430px] rounded-2xl border border-slate-200 bg-white p-8">
          <div className="h-7 w-40 rounded bg-slate-100" />
          <div className="mt-6 h-4 rounded bg-slate-100" />
          <div className="mt-3 h-4 rounded bg-slate-100" />
          <div className="mt-3 h-4 w-4/5 rounded bg-slate-100" />
        </div>
        <div className="h-[250px] rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-3 w-24 rounded bg-slate-100" />
          <div className="mt-4 h-8 w-3/4 rounded bg-slate-100" />
          <div className="mt-5 h-4 rounded bg-slate-100" />
          <div className="mt-3 h-12 rounded-xl bg-slate-100" />
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
      <div
        role="alert"
        className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm shadow-[#071f3c]/5"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 [&>svg]:h-7 [&>svg]:w-7"
        >
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

function plainJobText(value: string) {
  return value
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1");
}

const copy = {
  en: {
    back: "Back to jobs",
    publishedRole: "Open BlueDeck role",
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
    candidateType: "Candidate type",
    individualCandidate: "Individual",
    smoker: "Smoking",
    visibleTattoos: "Visible tattoos",
    languages: "Required languages",
    start: "Start date",
    salary: "Salary",
    description: "About the role",
    roleDetails: "Role details",
    responsibilities: "Responsibilities",
    requirements: "Requirements",
    candidateRequirements: "Candidate requirements",
    yachtDetails: "Yacht details",
    skills: "Skills",
    characteristics: "Characteristics",
    certificatesDocuments: "Certificates & documents",
    visas: "Required visas",
    benefits: "Benefits",
    applicationEyebrow: "Private application",
    secureTitle: "Apply for this role",
    secureText:
      "Apply with your BlueDeck profile. Your private documents stay protected.",
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
    publishedRole: "Açık BlueDeck ilanı",
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
    candidateType: "Aday türü",
    individualCandidate: "Bireysel",
    smoker: "Sigara",
    visibleTattoos: "Görünür dövme",
    languages: "Gerekli diller",
    start: "Başlangıç tarihi",
    salary: "Maaş",
    description: "Pozisyon hakkında",
    roleDetails: "Pozisyon detayları",
    responsibilities: "Sorumluluklar",
    requirements: "Gereksinimler",
    candidateRequirements: "Aday gereksinimleri",
    yachtDetails: "Yat detayları",
    skills: "Beceriler",
    characteristics: "Karakter özellikleri",
    certificatesDocuments: "Sertifikalar ve evraklar",
    visas: "Gerekli vizeler",
    benefits: "Yan haklar",
    applicationEyebrow: "Özel başvuru",
    secureTitle: "Bu ilana başvur",
    secureText:
      "BlueDeck profilinizle başvurun. Özel belgeleriniz korunmaya devam eder.",
    loading: "İlan ayrıntıları yükleniyor…",
    notFoundTitle: "Bu pozisyon artık açık değil",
    notFoundText:
      "İlan kapanmış veya kaldırılmış olabilir. Bunun yerine güncel fırsatlara göz atın.",
    errorTitle: "İlan yüklenemedi",
    errorText: "Bağlantınızı kontrol edip yeniden deneyin.",
    retry: "Tekrar dene",
  },
} as const;
