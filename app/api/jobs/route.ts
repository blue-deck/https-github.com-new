import { NextRequest, NextResponse } from "next/server";
import { getPublicJobs } from "@/app/lib/jobs/queries";
import { parseJobsFilters } from "@/app/lib/jobs/validation";

export async function GET(request: NextRequest) {
  const filters = parseJobsFilters(request.nextUrl.searchParams);
  const result = await getPublicJobs(filters);

  return NextResponse.json(
    {
      data: result.jobs,
      meta: {
        available: result.state === "ready",
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    },
    {
      headers: {
        "Cache-Control":
          result.state === "ready"
            ? "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
            : "no-store",
      },
    },
  );
}
