import { NextResponse } from "next/server";
import {
  RequestAuthError,
  requireRequestUser,
} from "@/app/lib/server/auth";
import { getSupabaseAdmin } from "@/app/lib/server/supabaseAdmin";

type DatabaseRow = Record<string, unknown>;

const APPLICATION_SELECT = [
  "id",
  "job_id",
  "status",
  "cover_note",
  "submitted_at",
  "created_at",
  "updated_at",
].join(",");
const JOB_SELECT = [
  "id",
  "slug",
  "title",
  "position",
  "department",
  "location",
  "employment_type",
  "employer_id",
].join(",");

export async function GET(request: Request) {
  try {
    const { user } = await requireRequestUser(request);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("job_applications")
      .select(APPLICATION_SELECT)
      .eq("applicant_user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (error) {
      if (isSchemaUnavailable(error)) return applicationsUnavailable();
      console.error("[applications] Candidate query failed", {
        code: error.code,
      });
      return apiError(
        500,
        "APPLICATIONS_FAILED",
        "Applications could not be loaded.",
      );
    }

    const applicationRows = asRows(data);
    const jobIds = uniqueStrings(
      applicationRows.map((row) => row.job_id),
    );
    const { rows: jobRows, errorResponse: jobsError } =
      await loadRowsByIds("job_posts", JOB_SELECT, jobIds);
    if (jobsError) return jobsError;

    const employerIds = uniqueStrings(
      jobRows.map((row) => row.employer_id),
    );
    const { rows: employerRows, errorResponse: employersError } =
      await loadRowsByIds(
        "employer_profiles",
        "id,display_name,company_name",
        employerIds,
      );
    if (employersError) return employersError;

    const jobsById = new Map(
      jobRows
        .map((row) => {
          const id = asString(row.id);
          return id ? ([id, row] as const) : null;
        })
        .filter(
          (
            item,
          ): item is readonly [string, DatabaseRow] => item !== null,
        ),
    );
    const employersById = new Map(
      employerRows
        .map((row) => {
          const id = asString(row.id);
          return id ? ([id, row] as const) : null;
        })
        .filter(
          (
            item,
          ): item is readonly [string, DatabaseRow] => item !== null,
        ),
    );

    const applications = applicationRows
      .map((row) => mapApplication(row, jobsById, employersById))
      .filter(
        (item): item is CandidateApplicationDto => item !== null,
      );

    return NextResponse.json(
      {
        ok: true,
        available: true,
        applications,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return apiError(error.status, "AUTH_REQUIRED", error.message);
    }
    if (
      error instanceof Error &&
      /server credentials are not configured/i.test(error.message)
    ) {
      return applicationsUnavailable();
    }

    console.error("[applications] Unexpected route failure", error);
    return apiError(
      500,
      "APPLICATIONS_FAILED",
      "Applications could not be loaded.",
    );
  }
}

async function loadRowsByIds(
  table: "job_posts" | "employer_profiles",
  columns: string,
  ids: string[],
): Promise<{
  rows: DatabaseRow[];
  errorResponse: NextResponse | null;
}> {
  if (ids.length === 0) {
    return { rows: [], errorResponse: null };
  }

  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .select(columns)
    .in("id", ids);

  if (error) {
    if (isSchemaUnavailable(error)) {
      return { rows: [], errorResponse: applicationsUnavailable() };
    }

    console.error(`[applications] ${table} DTO query failed`, {
      code: error.code,
    });
    return {
      rows: [],
      errorResponse: apiError(
        500,
        "APPLICATIONS_FAILED",
        "Applications could not be loaded.",
      ),
    };
  }

  return { rows: asRows(data), errorResponse: null };
}

function mapApplication(
  row: DatabaseRow,
  jobsById: Map<string, DatabaseRow>,
  employersById: Map<string, DatabaseRow>,
): CandidateApplicationDto | null {
  const id = asString(row.id);
  const jobId = asString(row.job_id);
  if (!id || !jobId) return null;

  const job = jobsById.get(jobId);
  const employerId = job ? asString(job.employer_id) : null;
  const employer = employerId
    ? employersById.get(employerId)
    : undefined;
  const submittedAt =
    asDateString(row.submitted_at) ||
    asDateString(row.created_at) ||
    new Date(0).toISOString();

  return {
    id,
    status: normalizeClientStatus(row.status),
    cover_note: nullableString(row.cover_note),
    created_at: submittedAt,
    updated_at: asDateString(row.updated_at),
    job: job
      ? {
          id: asString(job.id) || jobId,
          slug: asString(job.slug) || "",
          title: asString(job.title) || "Yacht position",
          position: nullableString(job.position),
          department: nullableString(job.department),
          location: nullableString(job.location),
          employment_type: nullableString(job.employment_type),
          employer_name: employer
            ? nullableString(employer.display_name) ||
              nullableString(employer.company_name)
            : null,
        }
      : null,
  };
}

function normalizeClientStatus(
  value: unknown,
): CandidateApplicationStatus {
  const status = asString(value);
  if (
    status &&
    [
      "applied",
      "viewed",
      "shortlisted",
      "interview",
      "reference_check",
      "offer",
      "hired",
      "rejected",
      "withdrawn",
    ].includes(status)
  ) {
    return status as CandidateApplicationStatus;
  }
  return "applied";
}

function applicationsUnavailable(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      available: false,
      applications: [],
      error: "The protected applications service is not available yet.",
      errorCode: "JOBS_UNAVAILABLE",
    },
    { status: 503, headers: noStoreHeaders },
  );
}

function apiError(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      available: true,
      applications: [],
      error: message,
      errorCode: code,
    },
    { status, headers: noStoreHeaders },
  );
}

function isSchemaUnavailable(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(
      error.code || "",
    ) ||
    /schema cache|does not exist|could not find/i.test(error.message || "")
  );
}

function asRows(value: unknown): DatabaseRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is DatabaseRow =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean || null;
}

function nullableString(value: unknown): string | null {
  return asString(value);
}

function uniqueStrings(values: unknown[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => asString(value))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function asDateString(value: unknown): string | null {
  const clean = asString(value);
  if (!clean) return null;
  const timestamp = new Date(clean).getTime();
  return Number.isNaN(timestamp)
    ? null
    : new Date(timestamp).toISOString();
}

type CandidateApplicationStatus =
  | "applied"
  | "viewed"
  | "shortlisted"
  | "interview"
  | "reference_check"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

type CandidateApplicationDto = {
  id: string;
  status: CandidateApplicationStatus;
  cover_note: string | null;
  created_at: string;
  updated_at: string | null;
  job: {
    id: string;
    slug: string;
    title: string;
    position: string | null;
    department: string | null;
    location: string | null;
    employment_type: string | null;
    employer_name: string | null;
  } | null;
};

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
};
