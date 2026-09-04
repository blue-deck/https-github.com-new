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
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-300 hover:border-slate-300"
    >
      <div
        className={`min-w-0 px-4 pt-6 sm:px-7 ${
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

        <div className="mt-[1.625rem] flex min-w-0 flex-nowrap items-start justify-between gap-x-1.5 min-[420px]:gap-x-3 sm:mt-5 sm:gap-x-6">
          <MetaLine
            icon={<BriefcaseBusiness />}
            value={formatJobEmploymentType(job.employmentType, language)}
          />
          <MetaLine
            icon={<Clock3 />}
            value={`${c.posted}: ${formatJobDate(job.publishedAt, language)}`}
          />
          <MetaLine icon={<MapPin />} value={job.location} />
        </div>

        <div
          aria-hidden="true"
          className="mt-6 h-px w-full bg-[linear-gradient(90deg,#071f3c_0%,#0891b2_100%)]"
        />
      </div>

      <div
        className={`grid min-w-0 grid-cols-3 gap-y-8 px-4 pb-5 pt-10 sm:gap-y-5 sm:px-7 sm:py-7 ${
          compact ? "lg:px-5 lg:py-6 xl:px-6" : "lg:px-7 lg:py-7 xl:px-8"
        }`}
      >
        <InfoLine
          icon={<Ship />}
          value={yachtType || c.notSpecified}
          className="col-start-1 row-start-1 pr-1 min-[420px]:pr-2 sm:pr-5"
        />
        <InfoLine
          icon={<Ruler />}
          value={yachtLength || c.notSpecified}
          className="relative col-start-2 row-start-1 px-1 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-6 before:w-px before:-translate-y-1/2 before:bg-slate-200 min-[420px]:px-2 sm:px-5 sm:before:h-8"
        />
        {teamCouple ? (
          <InfoLine
            icon={<UsersRound />}
            value={teamCouple}
            className="relative col-start-3 row-start-1 pl-1 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-6 before:w-px before:-translate-y-1/2 before:bg-slate-200 min-[420px]:pl-2 sm:pl-5 sm:before:h-8"
          />
        ) : null}
        {yachtProgram ? (
          <InfoLine
            icon={<Anchor />}
            value={yachtProgram}
            className="col-start-1 row-start-2 pr-1 min-[420px]:pr-2 sm:pr-5"
          />
        ) : null}
        <InfoLine
          icon={<CalendarDays />}
          value={`${c.start}: ${
            job.startDate
              ? formatJobDate(job.startDate, language)
              : c.notSpecified
          }`}
          className={
            yachtProgram
              ? "relative col-start-2 row-start-2 px-1 before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-6 before:w-px before:-translate-y-1/2 before:bg-slate-200 min-[420px]:px-2 sm:px-5 sm:before:h-8"
              : "col-start-1 row-start-2 pr-1 min-[420px]:pr-2 sm:pr-5"
          }
        />
      </div>

      <div
        className={`grid min-w-0 grid-cols-2 gap-2.5 px-4 pb-3.5 pt-5 sm:px-7 sm:pb-7 ${
          compact ? "lg:px-5 lg:pb-6 xl:px-6" : "lg:px-7 lg:pb-7 xl:px-8"
        }`}
      >
        <Link
          href={action.detailHref}
          className={`bd-focus flex min-h-12 items-center justify-between gap-2 rounded-xl bg-[#071f3c] px-3 text-[0.6875rem] font-black text-white transition hover:bg-cyan-800 min-[420px]:px-4 min-[420px]:text-xs sm:px-5 sm:text-sm ${
            action.intent === "view" ? "col-span-2" : ""
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
            className="bd-focus flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-400 bg-white px-2 text-center text-[0.6875rem] font-black text-[#071f3c] transition hover:border-cyan-600 hover:text-cyan-900 min-[420px]:gap-2 min-[420px]:px-3 min-[420px]:text-xs sm:px-4 sm:text-sm"
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white motion-reduce:animate-none">
      <div
        className={`animate-pulse px-4 pt-6 sm:px-7 motion-reduce:animate-none ${
          compact ? "lg:px-5 lg:pt-5 xl:px-6" : "lg:px-7 lg:pt-6 xl:px-8"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="h-8 w-36 rounded bg-slate-100" />
          <div className="h-6 w-36 rounded bg-slate-100" />
        </div>
        <div className="mt-[1.625rem] grid grid-cols-3 gap-2 sm:mt-5 sm:gap-6">
          <div className="h-4 rounded bg-slate-100" />
          <div className="h-4 rounded bg-slate-100" />
          <div className="h-4 rounded bg-slate-100" />
        </div>
        <div className="mt-6 h-px bg-slate-100" />
      </div>

      <div
        className={`grid animate-pulse grid-cols-3 gap-y-8 px-4 pb-5 pt-10 sm:gap-y-5 sm:px-7 sm:py-7 motion-reduce:animate-none ${
          compact ? "lg:px-5 lg:py-6 xl:px-6" : "lg:px-7 lg:py-7 xl:px-8"
        }`}
      >
        {["type", "length", "team", "program", "start"].map((item, index) => (
          <div
            className={`flex items-center gap-1 px-1.5 sm:gap-3 sm:px-5 ${
              index === 1 || index === 2 || index === 4
                ? "border-l border-slate-200"
                : ""
            }`}
            key={item}
          >
            <div className="h-5 w-5 shrink-0 rounded bg-slate-100" />
            <div className="h-4 w-full max-w-36 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div
        className={`grid animate-pulse grid-cols-2 gap-2.5 px-4 pb-3.5 pt-5 sm:px-7 sm:pb-7 motion-reduce:animate-none ${
          compact ? "lg:px-5 lg:pb-6 xl:px-6" : "lg:px-7 lg:pb-7 xl:px-8"
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
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <p
      data-i18n-ignore
      className="flex min-w-0 shrink items-center gap-1 text-[0.6875rem] font-medium leading-4 text-slate-600 min-[420px]:gap-2 min-[420px]:text-xs sm:text-sm sm:leading-5"
    >
      <span className="shrink-0 text-cyan-700 [&>svg]:h-[0.9375rem] [&>svg]:w-[0.9375rem] sm:[&>svg]:h-[1.05rem] sm:[&>svg]:w-[1.05rem]">
        {icon}
      </span>
      <span className="min-w-0 whitespace-nowrap">{value}</span>
    </p>
  );
}

function InfoLine({
  icon,
  value,
  className = "",
}: {
  icon: React.ReactNode;
  value: string;
  className?: string;
}) {
  return (
    <p
      data-i18n-ignore
      className={`${className} flex min-w-0 items-center gap-0.5 text-[0.65625rem] font-medium leading-4 text-slate-600 min-[420px]:gap-1.5 min-[420px]:text-[0.6875rem] sm:gap-2.5 sm:text-sm sm:leading-6`}
    >
      <span className="shrink-0 text-cyan-700 [&>svg]:h-3.5 [&>svg]:w-3.5 min-[420px]:[&>svg]:h-[0.9375rem] min-[420px]:[&>svg]:w-[0.9375rem] sm:[&>svg]:h-[1.15rem] sm:[&>svg]:w-[1.15rem]">
        {icon}
      </span>
      <span className="min-w-0 whitespace-nowrap">{value}</span>
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
