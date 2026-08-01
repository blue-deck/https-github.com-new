import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedEmployerClients,
  cleanText,
} from "../../../lib/employerAccessServer";
import {
  employerJobPostFromRow,
  employerJobPostSelect,
  jobPostMutationColumns,
  loadJobPostingWorkspaceAuthority,
  logJobPostError,
  parseJobPostMutation,
  readJobPostBody,
  verifyJobPostingAuthority,
} from "../../../lib/jobPostsServer";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import { getClientIp } from "../../../lib/turnstileServer";

export const dynamic = "force-dynamic";
const maximumJobPostsPerAccount = 250;

export async function GET(request: NextRequest) {
  const ipLimit = consumeRequestRateLimit(
    `employer-job-posts:get:ip:${getClientIp(request) || "unknown"}`,
    180,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds);

  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return employerResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }
  const userLimit = consumeRequestRateLimit(
    `employer-job-posts:get:user:${clients.user.id}`,
    120,
    10 * 60 * 1_000,
  );
  if (!userLimit.allowed) return rateLimitedResponse(userLimit.retryAfterSeconds);

  const authority = await loadJobPostingWorkspaceAuthority(
    clients.serviceClient,
    clients.user.id,
  );
  if (!authority.ok) {
    return employerResponse(
      { ok: false, error: authority.error },
      authority.status,
    );
  }

  const { capabilities } = authority;

  const { data, error } = await clients.serviceClient
    .from("job_posts")
    .select(employerJobPostSelect)
    .eq("created_by", clients.user.id)
    .order("updated_at", { ascending: false })
    .limit(maximumJobPostsPerAccount + 1);

  if (error) {
    logJobPostError("employer_job_listing_load_failed", error, {
      actorUserId: clients.user.id,
    });
    return employerResponse(
      { ok: false, error: "Your job posts could not be loaded." },
      500,
    );
  }
  if ((data || []).length > maximumJobPostsPerAccount) {
    logJobPostError("employer_job_listing_limit_exceeded", undefined, {
      actorUserId: clients.user.id,
    });
    return employerResponse(
      {
        ok: false,
        error:
          "This account has more job records than the workspace can safely display. Contact BlueDeck support.",
      },
      409,
    );
  }

  const jobs = [];
  for (const row of data || []) {
    const job = employerJobPostFromRow(row);
    if (!job) {
      logJobPostError("invalid_employer_job_record", undefined, {
        actorUserId: clients.user.id,
        recordId:
          typeof row.id === "string" && row.id ? row.id : "unknown",
      });
      return employerResponse(
        { ok: false, error: "Your job posts could not be loaded." },
        500,
      );
    }
    jobs.push(job);
  }

  let applicationCounts: Record<string, number> = Object.fromEntries(
    jobs.map((job) => [job.id, 0]),
  );
  let applicationCountsAvailable = true;

  if (jobs.length > 0) {
    const authorizedJobIds = new Set(jobs.map((job) => job.id));

    try {
      const { data: applicationRows, error: applicationError } =
        await clients.serviceClient.rpc("bluedeck_job_application_counts", {
          p_actor_user_id: clients.user.id,
        });

      if (
        applicationError ||
        !Array.isArray(applicationRows)
      ) {
        throw (
          applicationError ||
          new Error("The application count result was incomplete.")
        );
      }

      const nextCounts: Record<string, number> = Object.fromEntries(
        jobs.map((job) => [job.id, 0]),
      );

      for (const row of applicationRows) {
        const jobPostId = cleanText(row.job_post_id);
        const applicationCount = row.application_count;
        if (
          !authorizedJobIds.has(jobPostId) ||
          (typeof applicationCount !== "number" &&
            typeof applicationCount !== "string") ||
          !/^\d+$/.test(String(applicationCount)) ||
          !Number.isSafeInteger(Number(applicationCount))
        ) {
          throw new Error("The application count result was invalid.");
        }
        nextCounts[jobPostId] = Number(applicationCount);
      }

      applicationCounts = nextCounts;
    } catch (error) {
      applicationCounts = {};
      applicationCountsAvailable = false;
      logJobPostError("employer_job_application_counts_load_failed", error, {
        actorUserId: clients.user.id,
        jobPostCount: jobs.length,
      });
    }
  }

  return employerResponse({
    ok: true,
    capabilities,
    jobs,
    applicationCounts,
    applicationCountsAvailable,
  });
}

export async function POST(request: NextRequest) {
  const ipLimit = consumeRequestRateLimit(
    `employer-job-posts:post:ip:${getClientIp(request) || "unknown"}`,
    45,
    60 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds);

  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return employerResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }
  const userLimit = consumeRequestRateLimit(
    `employer-job-posts:post:user:${clients.user.id}`,
    15,
    60 * 60 * 1_000,
  );
  if (!userLimit.allowed) return rateLimitedResponse(userLimit.retryAfterSeconds);

  const body = await readJobPostBody(request);
  if (!body.ok) {
    return employerResponse(
      { ok: false, error: body.error },
      body.status,
    );
  }

  const parsed = parseJobPostMutation(body.value, "create");
  if (!parsed.ok) {
    return employerResponse({ ok: false, error: parsed.error }, 400);
  }

  const authority = await verifyJobPostingAuthority(
    clients.serviceClient,
    clients.user.id,
  );
  if (!authority.ok) {
    return employerResponse(
      { ok: false, error: authority.error },
      authority.status,
    );
  }

  const { data, error } = await clients.serviceClient
    .from("job_posts")
    .insert({
      id: crypto.randomUUID(),
      created_by: clients.user.id,
      updated_by: clients.user.id,
      ...jobPostMutationColumns(parsed.data),
    })
    .select(employerJobPostSelect)
    .single();

  if (error) {
    const code = cleanText(error.code);
    logJobPostError("job_post_create_failed", error, {
      actorUserId: clients.user.id,
      forbidden: code === "42501",
    });
    return employerResponse(
      {
        ok: false,
        error:
          code === "42501"
            ? "Your job-posting access changed before the post was saved."
            : code === "23514"
              ? "The job post does not meet the publishing requirements."
              : "The job post could not be created.",
      },
      code === "42501" ? 403 : code === "23514" ? 400 : 500,
    );
  }

  const job = employerJobPostFromRow(data);
  if (!job) {
    logJobPostError("invalid_created_job_record", undefined, {
      actorUserId: clients.user.id,
    });
    return employerResponse(
      { ok: false, error: "The saved job post could not be loaded." },
      500,
    );
  }

  return employerResponse({ ok: true, job }, 201);
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
