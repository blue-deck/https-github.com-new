import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { JobCard } from "@/app/components/jobs/JobCard";
import { JobFilters } from "@/app/components/jobs/JobFilters";
import { JobPagination } from "@/app/components/jobs/JobPagination";
import { JobsEmptyState } from "@/app/components/jobs/JobsEmptyState";
import { JobsHero } from "@/app/components/jobs/JobsHero";
import { getPublicJobs } from "@/app/lib/jobs/queries";
import type { JobsSearchParams } from "@/app/lib/jobs/types";
import {
  getActiveJobFilterCount,
  parseJobsFilters,
} from "@/app/lib/jobs/validation";

type JobsPageProps = {
  searchParams: Promise<JobsSearchParams>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const filters = parseJobsFilters(await searchParams);
  const result = await getPublicJobs(filters);
  const activeFilterCount = getActiveJobFilterCount(filters);
  const firstResult =
    result.total > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const lastResult = Math.min(
    result.page * result.pageSize,
    result.total,
  );

  return (
    <>
      <JobsHero total={result.total} />

      <section className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        <div className="mb-8 flex flex-col gap-4 border-b border-[#071f3c]/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-800">
              Live opportunities
            </p>
            <h2 className="mt-3 text-3xl font-black text-[#071f3c] sm:text-4xl">
              Explore yacht roles
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#657991]">
              {result.state === "ready" && result.total > 0
                ? `Showing ${firstResult}–${lastResult} of ${result.total} published ${
                    result.total === 1 ? "role" : "roles"
                  }.`
                : activeFilterCount > 0
                  ? "Review the current filters or widen your search."
                  : "Published roles will be listed here."}
            </p>
          </div>
          <Link
            href="/login?mode=signup"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full border border-[#b8c6d5] bg-white px-5 text-xs font-black uppercase tracking-[0.14em] text-[#071f3c] transition hover:-translate-y-0.5 hover:border-[#7890a8] sm:self-auto"
          >
            Build your crew profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-7 lg:grid-cols-[20rem_minmax(0,1fr)] xl:gap-9">
          <JobFilters filters={filters} />

          <div className="min-w-0">
            {result.jobs.length > 0 ? (
              <>
                <div className="grid gap-5 xl:grid-cols-2">
                  {result.jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
                <JobPagination
                  filters={filters}
                  page={result.page}
                  totalPages={result.totalPages}
                />
              </>
            ) : (
              <JobsEmptyState
                state={result.state}
                hasFilters={activeFilterCount > 0}
              />
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-[#071f3c]/10 bg-white">
        <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-12 sm:px-8 md:grid-cols-3 lg:px-12">
          <TrustItem
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Focused public board"
            text="Only roles published through the BlueDeck recruitment workspace appear here."
          />
          <TrustItem
            icon={<UserRoundCheck className="h-6 w-6" />}
            title="Profile-led journey"
            text="Keep your professional crew details ready before applying for a role."
          />
          <TrustItem
            icon={<BriefcaseBusiness className="h-6 w-6" />}
            title="For yacht employers"
            text="Publish opportunities and manage recruitment from one connected workspace."
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#07182d] p-7 text-white shadow-[0_30px_90px_rgba(7,24,45,0.18)] sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(34,211,238,0.22),transparent_24rem)]" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
              Recruiting yacht crew?
            </p>
            <h2 className="bd-serif mt-4 text-4xl leading-tight sm:text-5xl">
              Bring the right people on board.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              Discover how BlueDeck connects hiring with the crew and yacht
              operations already in your workspace.
            </p>
          </div>
          <Link
            href="/hire-crew"
            className="relative mt-7 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-white px-6 text-xs font-black uppercase tracking-[0.15em] text-[#07182d] transition hover:-translate-y-0.5 hover:bg-cyan-50 lg:mt-0"
          >
            Explore hiring
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

function TrustItem({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-[#071f3c]/8 bg-[#f8fbfe] p-6">
      <div className="text-cyan-800">{icon}</div>
      <h3 className="mt-5 text-lg font-black text-[#071f3c]">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[#657991]">{text}</p>
    </div>
  );
}
