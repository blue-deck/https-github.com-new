import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isJobEmploymentType,
  isJobPostStatus,
  isSupportedJobListingNumber,
} from "./jobPosts";
import {
  logJobApplicationError,
  ownJobApplicationFromRow,
  ownJobApplicationSelect,
} from "./jobApplicationsServer";
import type {
  MyJobApplication,
  MyJobApplicationJob,
} from "./myJobApplications";
import { cleanText, isRecord, isUuid } from "./employerAccessServer";

const maximumOwnApplicationResults = 200;
const ownPortalApplicationSelect =
  `${ownJobApplicationSelect},applicant_user_id`;
const ownApplicationJobSelect =
  "id,listing_number,title,position,department,employment_type,location,start_date,closes_at,status";

export async function listOwnJobApplications(
  serviceClient: SupabaseClient,
  authenticatedUserId: string,
) {
  if (!isUuid(authenticatedUserId)) {
    return {
      ok: false as const,
      error: "Your applications could not be loaded.",
    };
  }

  // This filter is intentionally derived only from the server-verified access
  // token. The service client bypasses RLS, so accepting a user id from the
  // request body or query string here would expose another applicant's data.
  const { data: applicationRows, error: applicationError } =
    await serviceClient
      .from("job_applications")
      .select(ownPortalApplicationSelect)
      .eq("applicant_user_id", authenticatedUserId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(maximumOwnApplicationResults);

  if (applicationError) {
    logJobApplicationError(
      "own_application_portal_list_failed",
      applicationError,
      { actorUserId: authenticatedUserId },
    );
    return {
      ok: false as const,
      error: "Your applications could not be loaded.",
    };
  }

  if (
    (applicationRows || []).some(
      (row) =>
        !isRecord(row) ||
        cleanText(row.applicant_user_id) !== authenticatedUserId,
    )
  ) {
    logJobApplicationError("own_application_portal_scope_violation", undefined, {
      actorUserId: authenticatedUserId,
    });
    return {
      ok: false as const,
      error: "Your applications could not be loaded.",
    };
  }

  const applications = (applicationRows || []).map(ownJobApplicationFromRow);
  if (applications.some((application) => !application)) {
    logJobApplicationError("invalid_own_application_portal_record", undefined, {
      actorUserId: authenticatedUserId,
    });
    return {
      ok: false as const,
      error: "Your applications could not be loaded.",
    };
  }

  const validApplications = applications.filter(
    (application): application is NonNullable<typeof application> =>
      application !== null,
  );
  if (!validApplications.length) {
    return { ok: true as const, applications: [] as MyJobApplication[] };
  }

  const jobPostIds = Array.from(
    new Set(validApplications.map((application) => application.jobPostId)),
  );
  const { data: jobRows, error: jobsError } = await serviceClient
    .from("job_posts")
    .select(ownApplicationJobSelect)
    .in("id", jobPostIds);

  if (jobsError) {
    logJobApplicationError("own_application_job_summary_load_failed", jobsError, {
      actorUserId: authenticatedUserId,
    });
    return {
      ok: false as const,
      error: "Your applications could not be loaded.",
    };
  }

  const jobs = new Map<string, MyJobApplicationJob>();
  for (const row of jobRows || []) {
    const job = ownApplicationJobFromRow(row);
    if (!job) {
      logJobApplicationError("invalid_own_application_job_summary", undefined, {
        actorUserId: authenticatedUserId,
      });
      return {
        ok: false as const,
        error: "Your applications could not be loaded.",
      };
    }
    jobs.set(job.id, job);
  }

  const result: MyJobApplication[] = [];
  for (const application of validApplications) {
    const job = jobs.get(application.jobPostId);
    if (!job) {
      logJobApplicationError("own_application_job_summary_missing", undefined, {
        actorUserId: authenticatedUserId,
        jobPostId: application.jobPostId,
      });
      return {
        ok: false as const,
        error: "Your applications could not be loaded.",
      };
    }
    result.push({ ...application, job });
  }

  return { ok: true as const, applications: result };
}

function ownApplicationJobFromRow(value: unknown): MyJobApplicationJob | null {
  if (!isRecord(value)) return null;

  const id = cleanText(value.id);
  const listingNumber = cleanText(value.listing_number);
  const title = cleanText(value.title);
  const position = cleanText(value.position);
  const department = cleanText(value.department);
  const location = cleanText(value.location);
  const startDate = optionalDate(value.start_date);
  const closesAt = optionalTimestamp(value.closes_at);

  if (
    !isUuid(id) ||
    !isSupportedJobListingNumber(listingNumber) ||
    !title ||
    !position ||
    !department ||
    !isJobEmploymentType(value.employment_type) ||
    !location ||
    startDate === undefined ||
    closesAt === undefined ||
    !isJobPostStatus(value.status)
  ) {
    return null;
  }

  return {
    id,
    listingNumber,
    title,
    position,
    department,
    employmentType: value.employment_type,
    location,
    startDate,
    closesAt,
    status: value.status,
  };
}

function optionalDate(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function optionalTimestamp(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}
