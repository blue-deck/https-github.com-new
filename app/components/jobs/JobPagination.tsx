import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { JobsFilters } from "@/app/lib/jobs/types";

export function JobPagination({
  filters,
  page,
  totalPages,
}: {
  filters: JobsFilters;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pages = paginationPages(page, totalPages);

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#071f3c]/10 bg-white p-3"
      aria-label="Job results pagination"
    >
      <PaginationLink
        href={page > 1 ? jobsPageHref(filters, page - 1) : null}
        label="Previous"
        icon={<ArrowLeft className="h-4 w-4" />}
      />

      <div className="flex flex-wrap items-center justify-center gap-1">
        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-10 w-8 items-center justify-center text-sm font-bold text-[#8799ac]"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Link
              key={item}
              href={jobsPageHref(filters, item)}
              aria-current={item === page ? "page" : undefined}
              className={`flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-black transition ${
                item === page
                  ? "bg-[#07182d] text-white"
                  : "text-[#526a83] hover:bg-cyan-50 hover:text-cyan-800"
              }`}
            >
              {item}
            </Link>
          ),
        )}
      </div>

      <PaginationLink
        href={page < totalPages ? jobsPageHref(filters, page + 1) : null}
        label="Next"
        icon={<ArrowRight className="h-4 w-4" />}
        iconAfter
      />
    </nav>
  );
}

function PaginationLink({
  href,
  label,
  icon,
  iconAfter = false,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  iconAfter?: boolean;
}) {
  const className =
    "inline-flex min-h-10 min-w-[7.25rem] items-center justify-center gap-2 rounded-xl border border-[#d2dce7] px-3 text-xs font-black uppercase tracking-[0.12em] transition";

  if (!href) {
    return (
      <span
        className={`${className} cursor-not-allowed bg-[#f6f8fb] text-[#a5b2c0]`}
        aria-disabled="true"
      >
        {!iconAfter ? icon : null}
        {label}
        {iconAfter ? icon : null}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${className} bg-white text-[#526a83] hover:border-[#8da1b6] hover:text-[#071f3c]`}
    >
      {!iconAfter ? icon : null}
      {label}
      {iconAfter ? icon : null}
    </Link>
  );
}

function jobsPageHref(filters: JobsFilters, page: number): string {
  const parameters = new URLSearchParams();
  if (filters.query) parameters.set("q", filters.query);
  if (filters.department) parameters.set("department", filters.department);
  if (filters.position) parameters.set("position", filters.position);
  if (filters.employmentType) {
    parameters.set("employment", filters.employmentType);
  }
  if (filters.location) parameters.set("location", filters.location);
  if (filters.sort !== "newest") parameters.set("sort", filters.sort);
  if (page > 1) parameters.set("page", String(page));

  const query = parameters.toString();
  return query ? `/jobs?${query}` : "/jobs";
}

function paginationPages(
  page: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((left, right) => left - right);
  const result: Array<number | "ellipsis"> = [];

  sorted.forEach((item, index) => {
    const previous = sorted[index - 1];
    if (previous && item - previous > 1) result.push("ellipsis");
    result.push(item);
  });

  return result;
}
