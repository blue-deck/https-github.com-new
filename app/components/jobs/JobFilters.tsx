import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  JOB_DEPARTMENTS,
  JOB_EMPLOYMENT_OPTIONS,
  JOB_POSITIONS,
  JOB_SORT_OPTIONS,
} from "@/app/lib/jobs/constants";
import type { JobsFilters } from "@/app/lib/jobs/types";
import { getActiveJobFilterCount } from "@/app/lib/jobs/validation";

export function JobFilters({ filters }: { filters: JobsFilters }) {
  const activeCount = getActiveJobFilterCount(filters);

  return (
    <aside className="h-fit rounded-3xl border border-[#071f3c]/10 bg-white p-5 shadow-[0_24px_70px_rgba(7,31,60,0.08)] lg:sticky lg:top-28 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[#071f3c]">
            <SlidersHorizontal className="h-4 w-4 text-cyan-700" />
            Refine roles
          </p>
          <p className="mt-2 text-sm leading-6 text-[#657991]">
            Narrow the board to the work that fits you.
          </p>
        </div>
        {activeCount > 0 ? (
          <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-800">
            {activeCount}
          </span>
        ) : null}
      </div>

      <form action="/jobs" method="get" className="mt-6 space-y-4">
        <FilterField label="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7990a8]" />
            <input
              type="search"
              name="q"
              defaultValue={filters.query}
              maxLength={100}
              placeholder="Position, yacht or keyword"
              className="min-h-12 w-full rounded-xl border border-[#cdd8e5] bg-[#f8fbfe] py-3 pl-10 pr-3 text-sm font-semibold text-[#071f3c] outline-none transition placeholder:font-normal placeholder:text-[#8799ac] focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
            />
          </div>
        </FilterField>

        <FilterField label="Department">
          <select
            name="department"
            defaultValue={filters.department}
            className={selectClassName}
          >
            <option value="">All departments</option>
            {JOB_DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Position">
          <select
            name="position"
            defaultValue={filters.position}
            className={selectClassName}
          >
            <option value="">All positions</option>
            {JOB_DEPARTMENTS.map((department) => (
              <optgroup key={department} label={department}>
                {JOB_POSITIONS.filter(
                  (position) => position.department === department,
                ).map((position) => (
                  <option key={position.title} value={position.title}>
                    {position.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </FilterField>

        <FilterField label="Employment">
          <select
            name="employment"
            defaultValue={filters.employmentType}
            className={selectClassName}
          >
            <option value="">All employment types</option>
            {JOB_EMPLOYMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Location">
          <input
            type="text"
            name="location"
            defaultValue={filters.location}
            maxLength={100}
            placeholder="Country, city or cruising area"
            className={inputClassName}
          />
        </FilterField>

        <FilterField label="Sort">
          <select
            name="sort"
            defaultValue={filters.sort}
            className={selectClassName}
          >
            {JOB_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FilterField>

        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#07182d] px-4 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_35px_rgba(7,24,45,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0b2949]"
        >
          <Search className="h-4 w-4" />
          Show roles
        </button>

        {activeCount > 0 ? (
          <Link
            href="/jobs"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#cdd8e5] bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-[#526a83] transition hover:border-[#9fb3c8] hover:text-[#071f3c]"
          >
            <X className="h-4 w-4" />
            Clear filters
          </Link>
        ) : null}
      </form>
    </aside>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#526a83]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "min-h-12 w-full rounded-xl border border-[#cdd8e5] bg-[#f8fbfe] px-3 py-3 text-sm font-semibold text-[#071f3c] outline-none transition placeholder:font-normal placeholder:text-[#8799ac] focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100";

const selectClassName = `${inputClassName} cursor-pointer`;
