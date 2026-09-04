"use client";

import Link from "next/link";
import {
  Anchor,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  MapPin,
  Ruler,
  Ship,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import {
  formatJobEmploymentType,
  formatJobTeamCoupleAnswer,
  formatJobYachtLength,
  formatJobYachtProgram,
  formatJobYachtType,
  isJobTeamCouple,
} from "../lib/jobPosts";
import { formatJobDate, formatJobSalary, type PublicJobCard } from "./job-data";
import { getJobListingAction, type JobListingViewer } from "./JobListingAction";

export function PublicJobListingCard({
  job,
  language,
  viewer,
  compact = false,
}: {
  job: PublicJobCard;
  language: "en" | "tr";
  viewer: JobListingViewer;
  compact?: boolean;
}) {
  const c = cardCopy[language];
  const salary = formatJobSalary(job.salary, language);
  const yachtType = job.yachtType
    ? formatJobYachtType(job.yachtType, language)
    : "";
  const yachtProgram = job.yachtProgram
    ? formatJobYachtProgram(job.yachtProgram, language)
    : "";
  const yachtLength =
    job.yachtLength !== null && job.yachtLengthUnit
      ? formatJobYachtLength(job.yachtLength, job.yachtLengthUnit, language)
      : "";
  const action = getJobListingAction(job.id, viewer, language);
  const titleId = `job-title-${job.id}`;
  const teamCouple = isJobTeamCouple(job.candidateType)
    ? `${c.teamCouple}: ${formatJobTeamCoupleAnswer(job.candidateType, language)}`
    : "";

  return (
    <article
      aria-labelledby={titleId}
      data-job-card-layout="quiet-divider"
      className="group relative overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_20px_54px_-46px_rgba(7,31,60,0.55)] transition duration-300 hover:border-slate-300 hover:shadow-[0_24px_60px_-46px_rgba(7,31,60,0.6)]"
    >
      <div
        className={`min-w-0 px-5 pt-5 sm:px-7 sm:pt-6 ${
          compact ? "lg:px-5 lg:pt-5 xl:px-6" : "lg:px-7 lg:pt-6 xl:px-8"
        }`}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2">
          <h3
            id={titleId}
            data-i18n-ignore
            className="min-w-0 break-words text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-[1.75rem]"
          >
            {job.position}
          </h3>
          <p
            data-i18n-ignore
            className="max-w-[12rem] pt-0.5 text-right text-[1.05rem] font-black leading-7 tracking-[-0.02em] text-slate-950 sm:max-w-none sm:text-xl"
          >
            {salary || c.salaryNotSpecified}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5">
          <MetaLine
            icon={<BriefcaseBusiness />}
            value={formatJobEmploymentType(job.employmentType, language)}
            emphasized
          />
          <MetaLine
            icon={<Clock3 />}
            value={`${c.posted}: ${formatJobDate(job.publishedAt, language)}`}
          />
          <MetaLine icon={<MapPin />} value={job.location} />
        </div>

        <div
          aria-hidden="true"
          className="mt-5 h-px w-full bg-[linear-gradient(90deg,#071f3c_0%,#0891b2_100%)]"
        />
      </div>

      <div
        className={`grid min-w-0 grid-cols-1 gap-x-7 gap-y-3.5 px-5 py-5 min-[360px]:grid-cols-2 sm:px-7 sm:py-6 lg:grid-cols-3 ${
          compact ? "lg:px-5 lg:py-5 xl:px-6" : "lg:px-7 lg:py-6 xl:px-8"
        }`}
      >
        <InfoLine icon={<Ship />} value={yachtType || c.notSpecified} />
        <InfoLine icon={<Ruler />} value={yachtLength || c.notSpecified} />
        {teamCouple ? (
          <InfoLine
            icon={<UsersRound />}
            value={teamCouple}
            emphasized
            className="min-[360px]:col-span-2 lg:col-span-1"
          />
        ) : null}
        {yachtProgram ? (
          <InfoLine icon={<Anchor />} value={yachtProgram} />
        ) : null}
        <InfoLine
          icon={<CalendarDays />}
          value={`${c.start}: ${
            job.startDate
              ? formatJobDate(job.startDate, language)
              : c.notSpecified
          }`}
        />
      </div>

      <div
        className={`grid min-w-0 gap-2 border-t border-slate-200 px-5 py-5 sm:grid-cols-2 sm:px-7 ${
          compact ? "lg:px-5 lg:py-4 xl:px-6" : "lg:px-7 lg:py-5 xl:px-8"
        }`}
      >
        <Link
          href={action.detailHref}
          className={`bd-focus flex min-h-12 items-center justify-between rounded-xl bg-[#071f3c] px-5 text-sm font-black text-white transition hover:bg-cyan-800 ${
            action.intent === "view" ? "sm:col-span-2" : ""
          }`}
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
            className="bd-focus flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-center text-sm font-black text-[#071f3c] transition hover:border-cyan-600 hover:text-cyan-900"
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

export function PublicJobListingSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white motion-reduce:animate-none">
      <div
        className={`animate-pulse px-5 pt-5 sm:px-7 sm:pt-6 motion-reduce:animate-none ${
          compact ? "lg:px-5 lg:pt-5 xl:px-6" : "lg:px-7 lg:pt-6 xl:px-8"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="h-8 w-36 rounded bg-slate-100" />
          <div className="h-6 w-36 rounded bg-slate-100" />
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="h-4 w-28 rounded bg-slate-100" />
          <div className="h-4 w-40 rounded bg-slate-100" />
          <div className="h-4 w-32 rounded bg-slate-100" />
        </div>
        <div className="mt-5 h-px bg-slate-100" />
      </div>

      <div
        className={`grid animate-pulse grid-cols-1 gap-x-7 gap-y-4 px-5 py-5 min-[360px]:grid-cols-2 sm:px-7 sm:py-6 lg:grid-cols-3 motion-reduce:animate-none ${
          compact ? "lg:px-5 lg:py-5 xl:px-6" : "lg:px-7 lg:py-6 xl:px-8"
        }`}
      >
        {["type", "length", "team", "program", "start"].map((item) => (
          <div className="flex items-center gap-3" key={item}>
            <div className="h-5 w-5 shrink-0 rounded bg-slate-100" />
            <div className="h-4 w-full max-w-36 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div
        className={`grid animate-pulse gap-2 border-t border-slate-200 px-5 py-5 sm:grid-cols-2 sm:px-7 motion-reduce:animate-none ${
          compact ? "lg:px-5 lg:py-4 xl:px-6" : "lg:px-7 lg:py-5 xl:px-8"
        }`}
      >
        <div className="h-12 rounded-xl bg-slate-100" />
        <div className="h-12 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

function MetaLine({
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
      className={`flex min-w-0 items-center gap-2 text-sm leading-5 ${
        emphasized ? "font-black text-cyan-800" : "font-medium text-slate-500"
      }`}
    >
      <span className="shrink-0 text-cyan-700 [&>svg]:h-[1.05rem] [&>svg]:w-[1.05rem]">
        {icon}
      </span>
      <span className="min-w-0 break-words">{value}</span>
    </p>
  );
}

function InfoLine({
  icon,
  value,
  emphasized = false,
  className = "",
}: {
  icon: React.ReactNode;
  value: string;
  emphasized?: boolean;
  className?: string;
}) {
  return (
    <p
      data-i18n-ignore
      className={`${className} flex min-w-0 items-center gap-2 text-[0.8125rem] leading-5 sm:gap-2.5 sm:text-sm sm:leading-6 ${
        emphasized ? "font-black text-slate-950" : "font-medium text-slate-600"
      }`}
    >
      <span className="shrink-0 text-cyan-700 [&>svg]:h-[1.15rem] [&>svg]:w-[1.15rem]">
        {icon}
      </span>
      <span className="min-w-0 break-words">{value}</span>
    </p>
  );
}

const cardCopy = {
  en: {
    teamCouple: "Team/Couple",
    start: "Start",
    posted: "Posted",
    notSpecified: "Not specified",
    salaryNotSpecified: "Salary not specified",
    viewRole: "View role details",
  },
  tr: {
    teamCouple: "Team/Couple",
    start: "Başlangıç",
    posted: "Yayınlandı",
    notSpecified: "Belirtilmedi",
    salaryNotSpecified: "Maaş belirtilmedi",
    viewRole: "İlan detaylarını görüntüle",
  },
} as const;
