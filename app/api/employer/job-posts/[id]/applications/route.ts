import { NextRequest } from "next/server";
import {
  cleanText,
  isRecord,
  isUuid,
} from "../../../../../lib/employerAccessServer";
import {
  applicationResponse,
  authenticatedApplicationClients,
  employerJobApplicationFromRow,
  jobApplicationSummaryFromRow,
  loadApplicationTeamMembers,
  logJobApplicationError,
} from "../../../../../lib/jobApplicationsServer";
import { consumeRequestRateLimit } from "../../../../../lib/requestRateLimitServer";
import { getClientIp } from "../../../../../lib/turnstileServer";

export const dynamic = "force-dynamic";
const applicationPageSize = 50;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const ipLimit = consumeRequestRateLimit(
    `managed-applications:get:ip:${getClientIp(request) || "unknown"}`,
    180,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds);

  const jobPostId = (await context.params).id.trim().toLowerCase();
  if (!isUuid(jobPostId)) {
    return applicationResponse({ ok: false, error: "Job post not found." }, 404);
  }

  const query = parseApplicationQuery(request.nextUrl.searchParams);
  if (!query) {
    return applicationResponse({ ok: false, error: "Invalid application query." }, 400);
  }

  const clients = await authenticatedApplicationClients(request);
  if ("error" in clients) {
    return applicationResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }
  const userLimit = consumeRequestRateLimit(
    `managed-applications:get:user:${clients.user.id}`,
    120,
    10 * 60 * 1_000,
  );
  if (!userLimit.allowed) return rateLimitedResponse(userLimit.retryAfterSeconds);

  const [jobResult, pageResult] = await Promise.all([
    clients.serviceClient
      .from("job_posts")
      .select(
        "id,listing_number,title,position,start_date,status,closes_at,closure_reason",
      )
      .eq("id", jobPostId)
      .maybeSingle(),
    clients.serviceClient.rpc("bluedeck_job_applications_page", {
      p_actor_user_id: clients.user.id,
      p_job_post_id: jobPostId,
      p_before_submitted_at: query.cursor?.submittedAt || null,
      p_before_id: query.cursor?.id || null,
      p_limit: query.summary ? 1 : applicationPageSize,
    }),
  ]);

  if (jobResult.error || pageResult.error) {
    logJobApplicationError(
      "managed_application_workspace_lookup_failed",
      jobResult.error || pageResult.error,
      { actorUserId: clients.user.id, jobPostId },
    );
    return applicationResponse(
      { ok: false, error: "Applications could not be loaded." },
      cleanText(pageResult.error?.code) === "42501" ? 403 : 500,
    );
  }

  const job = jobApplicationSummaryFromRow(jobResult.data);
  if (!job) {
    return applicationResponse({ ok: false, error: "Job post not found." }, 404);
  }
  const page = parseAuthorizedApplicationPage(pageResult.data);
  if (!page) {
    return applicationResponse(
      { ok: false, error: "Applications could not be loaded." },
      500,
    );
  }

  if (query.summary) {
    return applicationResponse({
      ok: true,
      job,
      total: page.total,
    });
  }

  const applicationRows = page.rows;

  const candidateMembers = await loadApplicationTeamMembers(
    clients.serviceClient,
    applicationRows,
  );
  if (!candidateMembers.ok) {
    return applicationResponse(
      { ok: false, error: candidateMembers.error },
      500,
    );
  }

  const applications = applicationRows
    .map((row) =>
      employerJobApplicationFromRow(
        row,
        candidateMembers.members.get(
          cleanText(isRecord(row) ? row.id : ""),
        ) || [],
      ),
    )
    .filter((application) => application !== null)
    .sort(
      (left, right) =>
        Date.parse(right.submittedAt) - Date.parse(left.submittedAt),
    );
  if (applications.length !== applicationRows.length) {
    logJobApplicationError("invalid_managed_application_record", undefined, {
      actorUserId: clients.user.id,
      jobPostId,
    });
    return applicationResponse(
      { ok: false, error: "Applications could not be loaded." },
      500,
    );
  }

  const nextCursor = page.hasMore
    ? encodeApplicationCursor(applicationRows.at(-1))
    : null;
  if (page.hasMore && !nextCursor) {
    logJobApplicationError("invalid_managed_application_cursor", undefined, {
      actorUserId: clients.user.id,
      jobPostId,
    });
    return applicationResponse(
      { ok: false, error: "Applications could not be loaded." },
      500,
    );
  }

  return applicationResponse({
    ok: true,
    job,
    total: page.total,
    nextCursor,
    limit: applicationPageSize,
    hasMore: page.hasMore,
    candidateAccess: {
      level: "preview",
      contactDetails: "locked",
      applicationNote: "locked",
      freeTextProfile: "locked",
    },
    applications,
  });
}

function parseApplicationQuery(searchParams: URLSearchParams) {
  if (
    Array.from(searchParams.keys()).some(
      (key) => key !== "summary" && key !== "cursor",
    )
  ) {
    return null;
  }
  const summaries = searchParams.getAll("summary");
  const cursors = searchParams.getAll("cursor");
  if (summaries.length > 1 || cursors.length > 1) return null;
  if (summaries.length === 1 && summaries[0] !== "1") return null;
  if (summaries.length === 1 && cursors.length > 0) return null;
  const cursor = cursors.length === 1 ? decodeApplicationCursor(cursors[0]) : null;
  if (cursors.length === 1 && !cursor) return null;
  return { summary: summaries[0] === "1", cursor };
}

function parseAuthorizedApplicationPage(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.rows)) return null;
  const total = value.total;
  if (
    typeof total !== "number" ||
    !Number.isSafeInteger(total) ||
    total < 0 ||
    typeof value.has_more !== "boolean" ||
    value.rows.length > applicationPageSize ||
    (value.has_more && value.rows.length !== applicationPageSize)
  ) {
    return null;
  }
  return { total, rows: value.rows, hasMore: value.has_more };
}

function encodeApplicationCursor(value: unknown) {
  if (!isRecord(value)) return null;
  const submittedAt = normalizeCursorTimestamp(value.submitted_at);
  const id = cleanText(value.id).toLowerCase();
  if (!submittedAt || !isUuid(id)) return null;
  return Buffer.from(JSON.stringify([submittedAt, id]), "utf8").toString(
    "base64url",
  );
}

function decodeApplicationCursor(value: string) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(value)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const submittedAt = normalizeCursorTimestamp(parsed[0]);
    const id = cleanText(parsed[1]).toLowerCase();
    return submittedAt && isUuid(id) ? { submittedAt, id } : null;
  } catch {
    return null;
  }
}

function normalizeCursorTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 64) return "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function rateLimitedResponse(retryAfterSeconds: number) {
  return applicationResponse(
    { ok: false, error: "Too many application review requests." },
    429,
    { "Retry-After": String(retryAfterSeconds) },
  );
}
