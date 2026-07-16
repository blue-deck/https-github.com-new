import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  CircleCheckBig,
  Clock3,
  Languages,
  MapPin,
  Sailboat,
  ShieldCheck,
  Ship,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  formatEmploymentType,
  formatJobDate,
  formatSalary,
  formatYachtSpecification,
} from "@/app/lib/jobs/format";
import type { PublicJobDetail } from "@/app/lib/jobs/types";
import { JobApplyPanel } from "./JobApplyPanel";

export function JobDetailView({ job }: { job: PublicJobDetail }) {
  const employment = formatEmploymentType(job.employmentType);
  const salary = formatSalary(job.salary);
  const yachtSpecification = formatYachtSpecification(
    job.yachtType,
    job.yachtLengthMetres,
  );
  const publishedDate = formatJobDate(job.publishedAt);
  const startDate = formatJobDate(job.startDate);
  const endDate = formatJobDate(job.endDate);
  const deadline = formatJobDate(
    job.applicationDeadline || job.expiresAt,
  );

  return (
    <>
      <section className="relative overflow-hidden border-b border-white/10 bg-[#06172b] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_14%,rgba(34,211,238,0.2),transparent_30rem),radial-gradient(circle_at_8%_100%,rgba(15,121,236,0.2),transparent_34rem)]" />
        <div className="relative mx-auto max-w-[1500px] px-5 py-12 sm:px-8 lg:px-12 lg:py-20">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All yacht jobs
          </Link>

          <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div className="min-w-0">
              <p
                data-i18n-ignore
                className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-300"
              >
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                  {job.employer.name || "Confidential employer"}
                </span>
                {job.employer.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2 py-1 text-[0.67rem] font-black uppercase tracking-[0.12em] text-cyan-100">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : null}
              </p>
              <h1
                data-i18n-ignore
                className="bd-serif mt-4 max-w-5xl break-words text-5xl leading-[0.98] [overflow-wrap:anywhere] sm:text-6xl lg:text-7xl"
              >
                {job.title}
              </h1>
              <p
                data-i18n-ignore
                className="mt-4 break-words text-lg font-bold text-cyan-100 [overflow-wrap:anywhere]"
              >
                {job.position}
                {job.department ? ` · ${job.department}` : ""}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {employment ? <HeroPill>{employment}</HeroPill> : null}
                {job.location ? (
                  <HeroPill icon={<MapPin className="h-4 w-4" />}>
                    <span
                      data-i18n-ignore
                      className="min-w-0 break-words [overflow-wrap:anywhere]"
                    >
                      {job.location}
                    </span>
                  </HeroPill>
                ) : null}
                {yachtSpecification ? (
                  <HeroPill icon={<Ship className="h-4 w-4" />}>
                    <span
                      data-i18n-ignore
                      className="min-w-0 break-words [overflow-wrap:anywhere]"
                    >
                      {yachtSpecification}
                    </span>
                  </HeroPill>
                ) : null}
                {job.rotation ? (
                  <HeroPill icon={<Clock3 className="h-4 w-4" />}>
                    <span
                      data-i18n-ignore
                      className="min-w-0 break-words [overflow-wrap:anywhere]"
                    >
                      {job.rotation}
                    </span>
                  </HeroPill>
                ) : null}
                {job.openingsCount > 1 ? (
                  <HeroPill icon={<UsersRound className="h-4 w-4" />}>
                    {job.openingsCount} openings
                  </HeroPill>
                ) : null}
              </div>
            </div>

            {salary ? (
              <div className="rounded-3xl border border-white/15 bg-white/8 p-6 backdrop-blur-md">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-cyan-100">
                  <WalletCards className="h-4 w-4" />
                  Published salary
                </p>
                <p
                  data-i18n-ignore
                  className="mt-3 text-2xl font-black text-white"
                >
                  {salary}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:gap-12">
          <article className="min-w-0">
            {job.summary ? (
              <div className="rounded-3xl border border-cyan-800/10 bg-cyan-50/65 p-6 sm:p-8">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-800">
                  Role overview
                </p>
                <p
                  data-i18n-ignore
                  className="mt-4 break-words text-xl font-semibold leading-9 text-[#173b59] [overflow-wrap:anywhere]"
                >
                  {job.summary}
                </p>
              </div>
            ) : null}

            <DetailSection title="About this role">
              <p
                data-i18n-ignore
                className="whitespace-pre-line break-words text-base leading-8 text-[#526a83] [overflow-wrap:anywhere]"
              >
                {job.description}
              </p>
            </DetailSection>

            <JobListSection
              title="Responsibilities"
              items={job.responsibilities}
            />
            <JobListSection title="Requirements" items={job.requirements} />
            <JobListSection title="What the role offers" items={job.benefits} />

            {job.certifications.length > 0 ||
            job.languages.length > 0 ||
            job.visas.length > 0 ||
            job.minimumExperienceYears !== null ? (
              <DetailSection title="Candidate profile">
                <div className="grid gap-4 sm:grid-cols-2">
                  {job.minimumExperienceYears !== null ? (
                    <ProfileCard
                      icon={<ShieldCheck className="h-5 w-5" />}
                      label="Minimum experience"
                      values={[
                        `${job.minimumExperienceYears} ${
                          job.minimumExperienceYears === 1 ? "year" : "years"
                        }`,
                      ]}
                    />
                  ) : null}
                  {job.certifications.length > 0 ? (
                    <ProfileCard
                      icon={<CircleCheckBig className="h-5 w-5" />}
                      label="Certificates"
                      values={job.certifications}
                    />
                  ) : null}
                  {job.languages.length > 0 ? (
                    <ProfileCard
                      icon={<Languages className="h-5 w-5" />}
                      label="Languages"
                      values={job.languages}
                    />
                  ) : null}
                  {job.visas.length > 0 ? (
                    <ProfileCard
                      icon={<Sailboat className="h-5 w-5" />}
                      label="Visa requirements"
                      values={job.visas}
                    />
                  ) : null}
                </div>
              </DetailSection>
            ) : null}

            {job.applicationInstructions ? (
              <DetailSection title="Application notes">
                <p
                  data-i18n-ignore
                  className="whitespace-pre-line break-words text-base leading-8 text-[#526a83] [overflow-wrap:anywhere]"
                >
                  {job.applicationInstructions}
                </p>
              </DetailSection>
            ) : null}
          </article>

          <aside className="h-fit lg:sticky lg:top-28">
            <div className="overflow-hidden rounded-3xl border border-[#071f3c]/10 bg-white shadow-[0_26px_80px_rgba(7,31,60,0.1)]">
              <JobApplyPanel
                jobId={job.id}
                jobSlug={job.slug}
                jobTitle={job.title}
              />

              <dl className="divide-y divide-[#071f3c]/8 p-6">
                {job.yachtName ? (
                  <DetailFact
                    label="Yacht"
                    value={job.yachtName}
                    icon={<Ship className="h-4 w-4" />}
                  />
                ) : null}
                {job.yachtProgram ? (
                  <DetailFact
                    label="Program"
                    value={job.yachtProgram}
                    icon={<Sailboat className="h-4 w-4" />}
                  />
                ) : null}
                {startDate ? (
                  <DetailFact
                    label="Start date"
                    value={
                      endDate ? `${startDate} – ${endDate}` : startDate
                    }
                    icon={<CalendarDays className="h-4 w-4" />}
                  />
                ) : null}
                {deadline ? (
                  <DetailFact
                    label="Apply by"
                    value={deadline}
                    icon={<Clock3 className="h-4 w-4" />}
                  />
                ) : null}
                {publishedDate ? (
                  <DetailFact
                    label="Published"
                    value={publishedDate}
                    icon={<CalendarDays className="h-4 w-4" />}
                  />
                ) : null}
              </dl>
            </div>

            <p className="mt-5 text-center text-xs leading-6 text-[#7890a8]">
              BlueDeck never asks crew to pay a fee to view a listing.
              Questions about this role?{" "}
              <Link
                href="/contact"
                className="font-bold text-[#315a7a] underline underline-offset-2"
              >
                Contact BlueDeck
              </Link>
              .
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[#071f3c]/10 py-9 last:border-b-0 sm:py-11">
      <h2 className="text-2xl font-black text-[#071f3c] sm:text-3xl">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function JobListSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;

  return (
    <DetailSection title={title}>
      <ul className="grid gap-3">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            data-i18n-ignore
            className="flex items-start gap-3 rounded-2xl border border-[#071f3c]/8 bg-white p-4 text-sm leading-7 text-[#526a83]"
          >
            <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-800">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}

function ProfileCard({
  icon,
  label,
  values,
}: {
  icon: React.ReactNode;
  label: string;
  values: string[];
}) {
  return (
    <div className="rounded-2xl border border-[#071f3c]/10 bg-white p-5">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-cyan-800">
        {icon}
        {label}
      </p>
      <p
        data-i18n-ignore
        className="mt-3 break-words text-sm font-semibold leading-7 text-[#526a83] [overflow-wrap:anywhere]"
      >
        {values.join(" · ")}
      </p>
    </div>
  );
}

function HeroPill({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-start gap-2 break-words rounded-full border border-white/15 bg-white/8 px-3.5 py-2 text-xs font-bold text-slate-100 backdrop-blur-sm [overflow-wrap:anywhere]">
      {icon}
      {children}
    </span>
  );
}

function DetailFact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span className="mt-0.5 text-cyan-700">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[0.67rem] font-black uppercase tracking-[0.14em] text-[#8799ac]">
          {label}
        </dt>
        <dd
          data-i18n-ignore
          className="mt-1 break-words text-sm font-bold leading-6 text-[#294c68] [overflow-wrap:anywhere]"
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
