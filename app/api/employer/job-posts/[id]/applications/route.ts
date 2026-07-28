import { NextRequest } from "next/server";
import { isUuid } from "../../../../../lib/employerAccessServer";
import {
  applicationCandidatePreviewKey,
  applicationResponse,
  authenticatedApplicationClients,
  canManageJobApplications,
  employerJobApplicationFromRow,
  jobApplicationSummaryFromRow,
  listAuthorizedJobApplications,
  loadApplicationCandidatePreviews,
  logJobApplicationError,
} from "../../../../../lib/jobApplicationsServer";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

  const [jobResult, authority, applicationResult] = await Promise.all([
    clients.serviceClient
      .from("job_posts")
      .select(
        "id,listing_number,title,position,start_date,status,closes_at,closure_reason",
      )
      .eq("id", jobPostId)
      .maybeSingle(),
    canManageJobApplications(
      clients.serviceClient,
      clients.user.id,
      jobPostId,
    ),
    listAuthorizedJobApplications(
      clients.serviceClient,
      clients.user.id,
      jobPostId,
    ),
  ]);

  if (jobResult.error || !authority.ok) {
    logJobApplicationError(
      "managed_application_workspace_lookup_failed",
      jobResult.error,
      { actorUserId: clients.user.id, jobPostId },
    );
    return applicationResponse(
      { ok: false, error: "Applications could not be loaded." },
      500,
    );
  }

  const job = jobApplicationSummaryFromRow(jobResult.data);
  if (!job) {
    return applicationResponse({ ok: false, error: "Job post not found." }, 404);
  }
  if (!authority.allowed) {
    return applicationResponse(
      { ok: false, error: "You cannot manage applications for this job post." },
      403,
    );
  }
  if (!applicationResult.ok) {
    return applicationResponse(
      { ok: false, error: applicationResult.error },
      applicationResult.forbidden ? 403 : 500,
    );
  }

  if (request.nextUrl.searchParams.get("summary") === "1") {
    return applicationResponse({
      ok: true,
      job,
      total: applicationResult.rows.length,
    });
  }

  const candidatePreviews = await loadApplicationCandidatePreviews(
    clients.serviceClient,
    applicationResult.rows,
  );
  if (!candidatePreviews.ok) {
    return applicationResponse(
      { ok: false, error: candidatePreviews.error },
      500,
    );
  }

  const applications = applicationResult.rows
    .map((row) =>
      employerJobApplicationFromRow(
        row,
        candidatePreviews.previews.get(applicationCandidatePreviewKey(row)),
      ),
    )
    .filter((application) => application !== null)
    .sort(
      (left, right) =>
        Date.parse(right.submittedAt) - Date.parse(left.submittedAt),
    );
  if (applications.length !== applicationResult.rows.length) {
    logJobApplicationError("invalid_managed_application_record", undefined, {
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
    total: applications.length,
    candidateAccess: {
      level: "preview",
      contactDetails: "locked",
      applicationNote: "locked",
      freeTextProfile: "locked",
    },
    applications,
  });
}
