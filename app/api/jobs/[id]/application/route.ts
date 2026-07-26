import { NextRequest } from "next/server";
import {
  accountRole,
  applicationResponse,
  authenticatedApplicationClients,
  canApplyToJob,
  coverNoteFromBody,
  logJobApplicationError,
  ownJobApplicationFromRow,
  ownJobApplicationSelect,
  readApplicationBody,
} from "../../../../lib/jobApplicationsServer";
import { canWithdrawJobApplication } from "../../../../lib/jobApplications";
import { cleanText, isRecord, isUuid } from "../../../../lib/employerAccessServer";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const jobPostId = (await context.params).id.trim().toLowerCase();
  if (!isUuid(jobPostId)) {
    return applicationResponse({ ok: false, error: "Job post not found." }, 404);
  }

  const clients = await authenticatedApplicationClients(request);
  if ("error" in clients) {
    return applicationResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }

  const [roleResult, applicationResult, eligibility] = await Promise.all([
    accountRole(clients.serviceClient, clients.user.id),
    clients.serviceClient
      .from("job_applications")
      .select(ownJobApplicationSelect)
      .eq("job_post_id", jobPostId)
      .eq("applicant_user_id", clients.user.id)
      .maybeSingle(),
    canApplyToJob(clients.serviceClient, clients.user.id, jobPostId),
  ]);

  if (applicationResult.error) {
    logJobApplicationError(
      "own_application_lookup_failed",
      applicationResult.error,
      {
        actorUserId: clients.user.id,
        jobPostId,
      },
    );
    return applicationResponse(
      { ok: false, error: "Your application could not be loaded." },
      500,
    );
  }
  if (!roleResult.ok || !eligibility.ok) {
    return applicationResponse(
      { ok: false, error: "Application access could not be verified." },
      503,
    );
  }

  const application = applicationResult.data
    ? ownJobApplicationFromRow(applicationResult.data)
    : null;
  if (applicationResult.data && !application) {
    logJobApplicationError("invalid_own_application_record", undefined, {
      actorUserId: clients.user.id,
      jobPostId,
    });
    return applicationResponse(
      { ok: false, error: "Your application could not be loaded." },
      500,
    );
  }

  return applicationResponse({
    ok: true,
    eligible: eligibility.allowed,
    role: roleResult.role,
    application,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const jobPostId = (await context.params).id.trim().toLowerCase();
  if (!isUuid(jobPostId)) {
    return applicationResponse({ ok: false, error: "Job post not found." }, 404);
  }

  const clients = await authenticatedApplicationClients(request);
  if ("error" in clients) {
    return applicationResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }

  const body = await readApplicationBody(request);
  if (!body.ok) {
    return applicationResponse({ ok: false, error: body.error }, body.status);
  }
  const parsed = coverNoteFromBody(body.value);
  if (!parsed.ok) {
    return applicationResponse({ ok: false, error: parsed.error }, 400);
  }

  const eligibility = await canApplyToJob(
    clients.serviceClient,
    clients.user.id,
    jobPostId,
  );
  if (!eligibility.ok) {
    return applicationResponse({ ok: false, error: eligibility.error }, 503);
  }
  if (!eligibility.allowed) {
    return applicationResponse(
      {
        ok: false,
        error:
          "Only active Crew and Captain accounts can apply to a currently open role.",
      },
      403,
    );
  }

  const { data, error } = await clients.serviceClient.rpc(
    "bluedeck_submit_job_application",
    {
      p_job_post_id: jobPostId,
      p_applicant_user_id: clients.user.id,
      p_cover_note: parsed.coverNote,
    },
  );

  if (error) {
    const code = cleanText(error.code);
    logJobApplicationError("application_submit_failed", error, {
      actorUserId: clients.user.id,
      jobPostId,
      duplicate: code === "23505",
    });
    return applicationResponse(
      {
        ok: false,
        error:
          code === "23505"
            ? "You have already applied to this role."
            : code === "42501"
              ? "This role is not accepting applications."
              : "Your application could not be submitted.",
      },
      code === "23505" ? 409 : code === "42501" ? 403 : 500,
    );
  }

  const application = ownJobApplicationFromRow(firstRow(data));
  if (!application) {
    logJobApplicationError("invalid_submitted_application_record", undefined, {
      actorUserId: clients.user.id,
      jobPostId,
    });
    return applicationResponse(
      { ok: false, error: "The submitted application could not be loaded." },
      500,
    );
  }

  return applicationResponse({ ok: true, application }, 201);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const body = await readApplicationBody(request);
  if (!body.ok) {
    return applicationResponse({ ok: false, error: body.error }, body.status);
  }
  if (
    Object.keys(body.value).some(
      (key) => key !== "action" && key !== "version",
    ) ||
    body.value.action !== "withdraw" ||
    typeof body.value.version !== "number" ||
    !Number.isSafeInteger(body.value.version) ||
    body.value.version < 1
  ) {
    return applicationResponse(
      { ok: false, error: "The withdrawal request is invalid." },
      400,
    );
  }

  return withdrawOwnApplication(
    request,
    (await context.params).id,
    body.value.version,
  );
}

async function withdrawOwnApplication(
  request: NextRequest,
  rawJobPostId: string,
  expectedVersion: number,
) {
  const jobPostId = rawJobPostId.trim().toLowerCase();
  if (!isUuid(jobPostId)) {
    return applicationResponse({ ok: false, error: "Job post not found." }, 404);
  }

  const clients = await authenticatedApplicationClients(request);
  if ("error" in clients) {
    return applicationResponse(
      { ok: false, error: clients.error },
      clients.status,
    );
  }

  const { data: existingData, error: existingError } =
    await clients.serviceClient
      .from("job_applications")
      .select(ownJobApplicationSelect)
      .eq("job_post_id", jobPostId)
      .eq("applicant_user_id", clients.user.id)
      .maybeSingle();

  if (existingError) {
    logJobApplicationError("application_withdraw_lookup_failed", existingError, {
      actorUserId: clients.user.id,
      jobPostId,
    });
    return applicationResponse(
      { ok: false, error: "Your application could not be loaded." },
      500,
    );
  }

  const existing = ownJobApplicationFromRow(existingData);
  if (!existing) {
    return applicationResponse({ ok: false, error: "Application not found." }, 404);
  }
  if (existing.version !== expectedVersion) {
    return applicationResponse(
      {
        ok: false,
        error: "Your application changed in another session. Refresh and try again.",
      },
      409,
    );
  }
  if (!canWithdrawJobApplication(existing.status)) {
    return applicationResponse(
      { ok: false, error: "This application can no longer be withdrawn." },
      409,
    );
  }

  const { data, error } = await clients.serviceClient.rpc(
    "bluedeck_withdraw_job_application",
    {
      p_application_id: existing.id,
      p_applicant_user_id: clients.user.id,
      p_expected_version: expectedVersion,
    },
  );

  if (error) {
    const code = cleanText(error.code);
    logJobApplicationError("application_withdraw_failed", error, {
      actorUserId: clients.user.id,
      jobPostId,
      applicationId: existing.id,
    });
    return applicationResponse(
      {
        ok: false,
        error:
          code === "40001"
            ? "Your application changed in another session. Refresh and try again."
            : code === "42501" || code === "22023"
              ? "This application can no longer be withdrawn."
              : "Your application could not be withdrawn.",
      },
      code === "40001" || code === "42501" || code === "22023" ? 409 : 500,
    );
  }

  const application = ownJobApplicationFromRow(firstRow(data));
  if (!application) {
    logJobApplicationError("invalid_withdrawn_application_record", undefined, {
      actorUserId: clients.user.id,
      jobPostId,
      applicationId: existing.id,
    });
    return applicationResponse(
      { ok: false, error: "The withdrawn application could not be loaded." },
      500,
    );
  }

  return applicationResponse({ ok: true, application });
}

function firstRow(value: unknown) {
  if (Array.isArray(value)) return value[0];
  return isRecord(value) ? value : null;
}
