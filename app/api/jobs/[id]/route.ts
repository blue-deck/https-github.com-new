import { NextResponse } from "next/server";
import { getPublicJobBySlug } from "@/app/lib/jobs/queries";
import { isValidJobSlug } from "@/app/lib/jobs/validation";

type JobRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: JobRouteContext) {
  const { id: slug } = await context.params;

  if (!isValidJobSlug(slug)) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "INVALID_JOB_SLUG",
          message: "The requested job identifier is invalid.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await getPublicJobBySlug(slug);

  if (result.state === "unavailable") {
    return NextResponse.json(
      {
        data: null,
        meta: { available: false },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!result.job) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "JOB_NOT_FOUND",
          message: "This job is not published or is no longer available.",
        },
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      data: result.job,
      meta: { available: true },
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
