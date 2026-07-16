import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  MapPin,
  Ship,
  WalletCards,
} from "lucide-react";
import {
  formatEmploymentType,
  formatJobDate,
  formatSalary,
  formatYachtSpecification,
} from "@/app/lib/jobs/format";
import type { PublicJobListItem } from "@/app/lib/jobs/types";

export function JobCard({ job }: { job: PublicJobListItem }) {
  const employment = formatEmploymentType(job.employmentType);
  const startDate = formatJobDate(job.startDate);
  const salary = formatSalary(job.salary);
  const yachtSpecification = formatYachtSpecification(
    job.yachtType,
    job.yachtLengthMetres,
  );

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-[#071f3c]/10 bg-white p-5 shadow-[0_20px_65px_rgba(7,31,60,0.07)] transition duration-200 hover:-translate-y-1 hover:border-cyan-700/30 hover:shadow-[0_28px_80px_rgba(7,31,60,0.12)] sm:p-7">
      {job.featured ? (
        <div className="absolute right-0 top-0 rounded-bl-2xl bg-[#07182d] px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-cyan-100">
          Featured
        </div>
      ) : null}

      <div className="flex items-start gap-4 pr-16">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-800/10 bg-cyan-50 text-cyan-800">
          <Ship className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p
            data-i18n-ignore
            className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[#5b7088]"
          >
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              {job.employer.name || "Confidential employer"}
            </span>
            {job.employer.verified ? (
              <BadgeCheck
                className="h-4 w-4 text-cyan-700"
                aria-label="Verified employer"
              />
            ) : null}
          </p>
          <h2
            data-i18n-ignore
            className="mt-2 break-words text-2xl font-black leading-tight text-[#071f3c] [overflow-wrap:anywhere] sm:text-[1.7rem]"
          >
            <Link
              href={`/jobs/${job.slug}`}
              className="outline-none after:absolute after:inset-0 focus-visible:underline"
            >
              {job.title}
            </Link>
          </h2>
          <p className="mt-2 break-words text-sm font-bold text-cyan-800 [overflow-wrap:anywhere]">
            {job.position}
            {job.department ? ` · ${job.department}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {employment ? <JobPill>{employment}</JobPill> : null}
        {job.location ? (
          <JobPill icon={<MapPin className="h-3.5 w-3.5" />}>
            <span
              data-i18n-ignore
              className="min-w-0 break-words [overflow-wrap:anywhere]"
            >
              {job.location}
            </span>
          </JobPill>
        ) : null}
        {yachtSpecification ? (
          <JobPill icon={<Ship className="h-3.5 w-3.5" />}>
            <span
              data-i18n-ignore
              className="min-w-0 break-words [overflow-wrap:anywhere]"
            >
              {yachtSpecification}
            </span>
          </JobPill>
        ) : null}
        {job.rotation ? (
          <JobPill>
            <span
              data-i18n-ignore
              className="min-w-0 break-words [overflow-wrap:anywhere]"
            >
              {job.rotation}
            </span>
          </JobPill>
        ) : null}
      </div>

      {job.summary ? (
        <p
          data-i18n-ignore
          className="mt-6 line-clamp-3 break-words text-sm leading-7 text-[#61768e] [overflow-wrap:anywhere]"
        >
          {job.summary}
        </p>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[#071f3c]/8 pt-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-[#657991]">
          {startDate ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-cyan-700" />
              Starts {startDate}
            </span>
          ) : null}
          {salary ? (
            <span
              data-i18n-ignore
              className="inline-flex items-center gap-1.5 text-[#244d6e]"
            >
              <WalletCards className="h-4 w-4 text-cyan-700" />
              {salary}
            </span>
          ) : null}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#071f3c] transition group-hover:text-cyan-700">
          View role
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}

function JobPill({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-start gap-1.5 break-words rounded-full border border-[#d4dfea] bg-[#f6f9fc] px-3 py-1.5 text-xs font-bold text-[#526a83] [overflow-wrap:anywhere]">
      {icon}
      {children}
    </span>
  );
}
