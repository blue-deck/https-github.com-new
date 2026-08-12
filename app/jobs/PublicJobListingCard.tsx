"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  MapPin,
  Ruler,
  Ship,
  UserRoundPlus,
} from "lucide-react";
import {
  formatJobCandidateType,
  formatJobEmploymentType,
  formatJobYachtLength,
  formatJobYachtType,
} from "../lib/jobPosts";
import {
  formatJobDate,
  formatJobSalary,
  type PublicJobCard,
} from "./job-data";
import {
  getJobListingAction,
  type JobListingViewer,
} from "./JobListingAction";

export function PublicJobListingCard({
  job,
  language,
  viewer,
}: {
  job: PublicJobCard;
  language: "en" | "tr";
  viewer: JobListingViewer;
}) {
  const c = cardCopy[language];
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
          <BriefcaseBusiness
            className="h-[1.1rem] w-[1.1rem] shrink-0"
            aria-hidden
          />
          <span>{formatJobEmploymentType(job.employmentType, language)}</span>
        </p>
        <p
          data-i18n-ignore
          className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-500"
        >
          <Clock3
            className="h-[1.1rem] w-[1.1rem] shrink-0 text-cyan-700"
            aria-hidden
          />
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
          <ArrowRight
            className="h-5 w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
            aria-hidden
          />
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

export function PublicJobListingSkeleton() {
  return (
    <div className="grid min-h-[250px] animate-pulse overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white motion-reduce:animate-none lg:min-h-[190px] lg:grid-cols-[minmax(13rem,0.9fr)_minmax(24rem,1.75fr)_minmax(16.5rem,0.85fr)]">
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

const cardCopy = {
  en: {
    start: "Start",
    posted: "Posted",
    notSpecified: "Not specified",
    salaryNotSpecified: "Salary not specified",
    viewRole: "View role details",
  },
  tr: {
    start: "Başlangıç",
    posted: "Yayınlandı",
    notSpecified: "Belirtilmedi",
    salaryNotSpecified: "Maaş belirtilmedi",
    viewRole: "İlan detaylarını görüntüle",
  },
} as const;
