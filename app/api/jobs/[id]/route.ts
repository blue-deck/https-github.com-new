import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "../../../lib/employerAccessServer";
import {
  currentPublicJobPostIds,
  jobPostServiceClient,
  logJobPostError,
  publicJobPostFromRow,
  publicJobPostServiceSelect,
} from "../../../lib/jobPostsServer";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  void request;
  const id = (await context.params).id.trim().toLowerCase();
  if (!isUuid(id)) {
    return publicResponse({ ok: false, error: "Job post not found." }, 404);
  }

  const service = jobPostServiceClient();
  if (!service.ok) {
    return publicResponse({ ok: false, error: service.error }, 503);
  }

  const now = new Date().toISOString();
  const { data, error } = await service.client
    .from("job_posts")
    .select(publicJobPostServiceSelect)
    .eq("id", id)
    .eq("status", "published")
    .lte("published_at", now)
    .gt("closes_at", now)
    .maybeSingle();

  if (error) {
    logJobPostError("public_detail_load_failed", error, { jobPostId: id });
    return publicResponse(
      { ok: false, error: "The job post could not be loaded." },
      503,
    );
  }

  if (!data) {
    return publicResponse({ ok: false, error: "Job post not found." }, 404);
  }

  const currentAuthority = await currentPublicJobPostIds(
    service.client,
    [data],
  );
  if (!currentAuthority.ok) {
    return publicResponse(
      { ok: false, error: "The job post could not be loaded." },
      503,
    );
  }
  if (!currentAuthority.jobPostIds.has(id)) {
    return publicResponse({ ok: false, error: "Job post not found." }, 404);
  }

  const job = publicJobPostFromRow(data);
  if (!job) {
    logJobPostError("invalid_public_job_record", undefined, {
      jobPostId: id,
    });
    return publicResponse(
      { ok: false, error: "The job post could not be loaded." },
      500,
    );
  }

  return publicResponse({ ok: true, job });
}

function publicResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
