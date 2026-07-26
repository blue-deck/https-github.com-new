import { NextResponse } from "next/server";
import {
  currentPublicJobPostIds,
  jobPostServiceClient,
  logJobPostError,
  maximumPublicJobResults,
  publicJobPostFromRow,
  publicJobPostServiceSelect,
} from "../../lib/jobPostsServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const service = jobPostServiceClient();
  if (!service.ok) {
    return publicResponse({ ok: false, error: service.error }, 503);
  }

  const now = new Date().toISOString();
  const { data, error } = await service.client
    .from("job_posts")
    .select(publicJobPostServiceSelect)
    .eq("status", "published")
    .lte("published_at", now)
    .gt("closes_at", now)
    .order("published_at", { ascending: false })
    .limit(maximumPublicJobResults);

  if (error) {
    logJobPostError("public_listing_load_failed", error);
    return publicResponse(
      { ok: false, error: "Job posts could not be loaded." },
      503,
    );
  }

  const currentAuthority = await currentPublicJobPostIds(
    service.client,
    data || [],
  );
  if (!currentAuthority.ok) {
    return publicResponse(
      { ok: false, error: "Job posts could not be loaded." },
      503,
    );
  }

  const jobs = [];
  for (const row of data || []) {
    if (
      typeof row.id !== "string" ||
      !currentAuthority.jobPostIds.has(row.id)
    ) {
      continue;
    }
    const job = publicJobPostFromRow(row);
    if (!job) {
      logJobPostError("invalid_public_job_record", undefined, {
        recordId:
          typeof row.id === "string" && row.id ? row.id : "unknown",
      });
      return publicResponse(
        { ok: false, error: "Job posts could not be loaded." },
        500,
      );
    }
    jobs.push(job);
  }

  return publicResponse({ ok: true, jobs });
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
