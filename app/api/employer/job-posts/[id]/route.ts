import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedEmployerClients,
  cleanText,
  isUuid,
} from "../../../../lib/employerAccessServer";
import {
  employerJobPostFromRow,
  employerJobPostSelect,
  jobPostMutationColumns,
  logJobPostError,
  parseJobPostMutation,
  readJobPostBody,
  verifyJobManagementAuthority,
} from "../../../../lib/jobPostsServer";
import { consumeRequestRateLimit } from "../../../../lib/requestRateLimitServer";
import { getClientIp } from "../../../../lib/turnstileServer";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const ipLimit = consumeRequestRateLimit(
    `employer-job-post:patch:ip:${getClientIp(request) || "unknown"}`,
    90,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds);

  const jobPostId = (await context.params).id.trim().toLowerCase();
  if (!isUuid(jobPostId)) {
    return employerResponse({ ok: false, error: "Job post not found." }, 404);
  }

  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return employerResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }
  const userLimit = consumeRequestRateLimit(
    `employer-job-post:patch:user:${clients.user.id}`,
    60,
    10 * 60 * 1_000,
  );
  if (!userLimit.allowed) return rateLimitedResponse(userLimit.retryAfterSeconds);

  const { data: existingData, error: existingError } =
    await clients.serviceClient
      .from("job_posts")
      .select("id,created_by")
      .eq("id", jobPostId)
      .maybeSingle();

  if (existingError) {
    logJobPostError("job_post_update_lookup_failed", existingError, {
      actorUserId: clients.user.id,
      jobPostId,
    });
    return employerResponse(
      { ok: false, error: "The job post could not be loaded." },
      500,
    );
  }

  if (!existingData) {
    return employerResponse({ ok: false, error: "Job post not found." }, 404);
  }

  const authority = await verifyJobManagementAuthority(
    clients.serviceClient,
    clients.user.id,
    jobPostId,
  );
  if (!authority.ok) {
    return employerResponse(
      { ok: false, error: authority.error },
      authority.status,
    );
  }

  const body = await readJobPostBody(request);
  if (!body.ok) {
    return employerResponse(
      { ok: false, error: body.error },
      body.status,
    );
  }

  const parsed = parseJobPostMutation(body.value, "update");
  if (!parsed.ok || parsed.data.version === null) {
    return employerResponse(
      {
        ok: false,
        error: parsed.ok
          ? "Refresh this job post before saving it again."
          : parsed.error,
      },
      400,
    );
  }

  const { data, error } = await clients.serviceClient
    .from("job_posts")
    .update({
      ...jobPostMutationColumns(parsed.data),
      updated_by: clients.user.id,
    })
    .eq("id", jobPostId)
    .eq("created_by", clients.user.id)
    .eq("version", parsed.data.version)
    .select(employerJobPostSelect)
    .maybeSingle();

  if (error) {
    const code = cleanText(error.code);
    const databaseMessage = cleanText(error.message);
    const publishingValidationFailed =
      code === "23514" &&
      databaseMessage.startsWith("Published job posts require");
    logJobPostError("job_post_update_failed", error, {
      actorUserId: clients.user.id,
      jobPostId,
      forbidden: code === "42501",
    });
    return employerResponse(
      {
        ok: false,
        error:
          code === "42501"
            ? "Your job-posting access changed before the post was saved."
            : publishingValidationFailed
              ? "Complete the public job details before publishing."
            : code === "23514" || code === "22023"
              ? "This status change is not available. Refresh the job post and try again."
              : "The job post could not be updated.",
      },
      code === "42501"
        ? 403
        : publishingValidationFailed
          ? 400
        : code === "23514" || code === "22023"
          ? 409
          : 500,
    );
  }

  if (!data) {
    return employerResponse(
      {
        ok: false,
        error:
          "This job post changed in another session. Refresh it before saving again.",
      },
      409,
    );
  }

  const job = employerJobPostFromRow(data);
  if (!job) {
    logJobPostError("invalid_updated_job_record", undefined, {
      actorUserId: clients.user.id,
      jobPostId,
    });
    return employerResponse(
      { ok: false, error: "The saved job post could not be loaded." },
      500,
    );
  }

  return employerResponse({ ok: true, job });
}

function employerResponse(
  body: object,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Authorization");
  return NextResponse.json(body, {
    status,
    headers,
  });
}

function rateLimitedResponse(retryAfterSeconds: number) {
  return employerResponse(
    { ok: false, error: "Too many job-posting requests." },
    429,
    { "Retry-After": String(retryAfterSeconds) },
  );
}
