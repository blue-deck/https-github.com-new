import { NextRequest } from "next/server";
import {
  cleanText,
  isUuid,
} from "../../../../../../lib/employerAccessServer";
import { isEmployerJobApplicationStatus } from "../../../../../../lib/jobApplications";
import {
  applicationResponse,
  authenticatedApplicationClients,
  canManageJobApplications,
  employerJobApplicationFromRow,
  loadApplicationCandidateDetails,
  loadApplicationTeamMembers,
  logJobApplicationError,
  readApplicationBody,
} from "../../../../../../lib/jobApplicationsServer";
import { consumeRequestRateLimit } from "../../../../../../lib/requestRateLimitServer";
import { getClientIp } from "../../../../../../lib/turnstileServer";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; applicationId: string }> },
) {
  const ipLimit = consumeRequestRateLimit(
    `managed-application:get:ip:${getClientIp(request) || "unknown"}`,
    180,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds);

  const params = await context.params;
  const jobPostId = params.id.trim().toLowerCase();
  const applicationId = params.applicationId.trim().toLowerCase();
  if (!isUuid(jobPostId) || !isUuid(applicationId)) {
    return applicationResponse({ ok: false, error: "Application not found." }, 404);
  }
  const requestedMemberId = parseRequestedMemberId(request.nextUrl.searchParams);
  if (requestedMemberId === null) {
    return applicationResponse({ ok: false, error: "Invalid profile query." }, 400);
  }

  const clients = await authenticatedApplicationClients(request);
  if ("error" in clients) {
    return applicationResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }
  const userLimit = consumeRequestRateLimit(
    `managed-application:get:user:${clients.user.id}`,
    120,
    10 * 60 * 1_000,
  );
  if (!userLimit.allowed) return rateLimitedResponse(userLimit.retryAfterSeconds);

  const authority = await canManageJobApplications(
    clients.serviceClient,
    clients.user.id,
    jobPostId,
  );
  if (!authority.ok) {
    return applicationResponse(
      { ok: false, error: "The application could not be loaded." },
      500,
    );
  }
  if (!authority.allowed) {
    return applicationResponse(
      { ok: false, error: "You cannot manage this application." },
      403,
    );
  }

  const { data: applicationRow, error: applicationError } =
    await clients.serviceClient
      .from("job_applications")
      .select(
        "id,job_post_id,application_mode,applicant_user_id,crew_profile_id,applicant_name_snapshot,applicant_position_snapshot",
      )
      .eq("id", applicationId)
      .eq("job_post_id", jobPostId)
      .neq("status", "withdrawn")
      .maybeSingle();

  if (applicationError) {
    logJobApplicationError(
      "candidate_detail_application_load_failed",
      applicationError,
      { actorUserId: clients.user.id, jobPostId, applicationId },
    );
    return applicationResponse(
      { ok: false, error: "The application could not be loaded." },
      500,
    );
  }
  if (!applicationRow) {
    return applicationResponse({ ok: false, error: "Application not found." }, 404);
  }

  const candidateDetails = await loadApplicationCandidateDetails(
    clients.serviceClient,
    applicationRow,
    requestedMemberId,
  );
  if (!candidateDetails.ok) {
    return applicationResponse(
      { ok: false, error: candidateDetails.error },
      500,
    );
  }

  return applicationResponse({
    ok: true,
    details: candidateDetails.details,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; applicationId: string }> },
) {
  const ipLimit = consumeRequestRateLimit(
    `managed-application:patch:ip:${getClientIp(request) || "unknown"}`,
    90,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds);

  const params = await context.params;
  const jobPostId = params.id.trim().toLowerCase();
  const applicationId = params.applicationId.trim().toLowerCase();
  if (!isUuid(jobPostId) || !isUuid(applicationId)) {
    return applicationResponse({ ok: false, error: "Application not found." }, 404);
  }

  const clients = await authenticatedApplicationClients(request);
  if ("error" in clients) {
    return applicationResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }
  const userLimit = consumeRequestRateLimit(
    `managed-application:patch:user:${clients.user.id}`,
    60,
    10 * 60 * 1_000,
  );
  if (!userLimit.allowed) return rateLimitedResponse(userLimit.retryAfterSeconds);

  const body = await readApplicationBody(request);
  if (!body.ok) {
    return applicationResponse({ ok: false, error: body.error }, body.status);
  }
  if (
    Object.keys(body.value).some(
      (key) => key !== "status" && key !== "version",
    ) ||
    !isEmployerJobApplicationStatus(body.value.status) ||
    typeof body.value.version !== "number" ||
    !Number.isSafeInteger(body.value.version) ||
    body.value.version < 1
  ) {
    return applicationResponse(
      { ok: false, error: "Select a valid application status." },
      400,
    );
  }

  const [applicationResult, authority] = await Promise.all([
    clients.serviceClient
      .from("job_applications")
      .select("id,job_post_id,version,status")
      .eq("id", applicationId)
      .eq("job_post_id", jobPostId)
      .neq("status", "withdrawn")
      .maybeSingle(),
    canManageJobApplications(
      clients.serviceClient,
      clients.user.id,
      jobPostId,
    ),
  ]);

  if (applicationResult.error || !authority.ok) {
    logJobApplicationError(
      "managed_application_update_lookup_failed",
      applicationResult.error,
      { actorUserId: clients.user.id, jobPostId, applicationId },
    );
    return applicationResponse(
      { ok: false, error: "The application could not be loaded." },
      500,
    );
  }
  if (!applicationResult.data) {
    return applicationResponse({ ok: false, error: "Application not found." }, 404);
  }
  if (!authority.allowed) {
    return applicationResponse(
      { ok: false, error: "You cannot manage this application." },
      403,
    );
  }
  if (applicationResult.data.version !== body.value.version) {
    return applicationResponse(
      {
        ok: false,
        error: "This application changed in another session. Refresh and try again.",
      },
      409,
    );
  }

  const { data, error } = await clients.serviceClient.rpc(
    "bluedeck_update_job_application_status",
    {
      p_application_id: applicationId,
      p_publisher_user_id: clients.user.id,
      p_status: body.value.status,
      p_expected_version: body.value.version,
    },
  );

  if (error) {
    const code = cleanText(error.code);
    logJobApplicationError("managed_application_update_failed", error, {
      actorUserId: clients.user.id,
      jobPostId,
      applicationId,
    });
    return applicationResponse(
      {
        ok: false,
        error:
          code === "40001"
            ? "This application changed in another session. Refresh and try again."
            : code === "42501"
              ? "You cannot manage this application."
              : code === "22023" || code === "23514"
                ? "This application cannot move to the selected status."
                : "The application status could not be updated.",
      },
      code === "40001"
        ? 409
        : code === "42501"
          ? 403
          : code === "22023" || code === "23514"
            ? 409
            : 500,
    );
  }

  const updatedRows = Array.isArray(data) ? data : [];
  const candidateMembers = await loadApplicationTeamMembers(
    clients.serviceClient,
    updatedRows,
  );

  const updatedRow = updatedRows[0] || null;
  const application = employerJobApplicationFromRow(
    updatedRow,
    candidateMembers.ok && updatedRow
      ? candidateMembers.members.get(cleanText(updatedRow.id)) || []
      : [],
  );
  if (!application) {
    logJobApplicationError(
      "invalid_managed_application_update_record",
      undefined,
      { actorUserId: clients.user.id, jobPostId, applicationId },
    );
    return applicationResponse(
      {
        ok: true,
        refreshRequired: true,
        message:
          "The application status was updated. Refresh to load the latest candidate preview.",
      },
      202,
    );
  }

  return applicationResponse({ ok: true, application });
}

function parseRequestedMemberId(searchParams: URLSearchParams) {
  if (Array.from(searchParams.keys()).some((key) => key !== "member")) {
    return null;
  }
  const values = searchParams.getAll("member");
  if (values.length === 0) return "";
  if (values.length !== 1) return null;
  const memberId = values[0].trim().toLowerCase();
  return isUuid(memberId) ? memberId : null;
}

function rateLimitedResponse(retryAfterSeconds: number) {
  return applicationResponse(
    { ok: false, error: "Too many application review requests." },
    429,
    { "Retry-After": String(retryAfterSeconds) },
  );
}
