import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, SearchX } from "lucide-react";
import type { JobsDataState } from "@/app/lib/jobs/types";

export function JobsEmptyState({
  state,
  hasFilters,
}: {
  state: JobsDataState;
  hasFilters: boolean;
}) {
  const unavailable = state === "unavailable";

  return (
    <div className="rounded-3xl border border-dashed border-[#aebed0] bg-white px-6 py-14 text-center shadow-[0_18px_60px_rgba(7,31,60,0.05)] sm:px-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
        {hasFilters ? (
          <SearchX className="h-8 w-8" />
        ) : (
          <BriefcaseBusiness className="h-8 w-8" />
        )}
      </div>
      <h2 className="mt-6 text-2xl font-black text-[#071f3c]">
        {unavailable
          ? "The jobs board is getting ready"
          : hasFilters
            ? "No roles match these filters"
            : "No published roles yet"}
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#657991]">
        {unavailable
          ? "Public opportunities will appear here as soon as the recruitment board is available."
          : hasFilters
            ? "Try widening your position, location or employment preferences."
            : "New opportunities will appear here after an employer publishes them."}
      </p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        {hasFilters ? (
          <Link
            href="/jobs"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#07182d] px-5 text-xs font-black uppercase tracking-[0.15em] text-white transition hover:-translate-y-0.5 hover:bg-[#0b2949]"
          >
            Clear filters
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href="/login?mode=signup"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#07182d] px-5 text-xs font-black uppercase tracking-[0.15em] text-white transition hover:-translate-y-0.5 hover:bg-[#0b2949]"
          >
            Create your crew profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        <Link
          href="/hire-crew"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#b8c6d5] bg-white px-5 text-xs font-black uppercase tracking-[0.15em] text-[#071f3c] transition hover:-translate-y-0.5 hover:border-[#7890a8]"
        >
          Hire crew
        </Link>
      </div>
    </div>
  );
}
