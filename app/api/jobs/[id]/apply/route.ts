import { NextResponse } from "next/server";
import {
  RequestAuthError,
  requireRequestUser,
} from "@/app/lib/server/auth";
import { getSupabaseAdmin } from "@/app/lib/server/supabaseAdmin";

type ApplyRouteContext = {
  params: Promise<{ id: string }>;
};

type DatabaseRow = Record<string, unknown>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COVER_NOTE_MINIMUM_LENGTH = 40;
const COVER_NOTE_MAXIMUM_LENGTH = 2_000;
const CREW_PROFILE_SELECT = [
  "id",
  "public_crew_id",
  "full_name",
  "email",
  "current_position",
  "location",
  "bio",
  "nationality",
  "profile_photo_url",
  "seeking_positions",
  "work_preferences",
  "languages",
].join(",");
const JOB_SELECT = [
  "id",
  "slug",
  "title",
  "status",
  "employer_id",
  "published_at",
  "expires_at",
  "application_deadline",
].join(",");
const APPLICATION_SELECT = "id,status,submitted_at";

export async function GET(request: Request, context: ApplyRouteContext) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return apiError(
        400,
        "INVALID_JOB_ID",
        "The requested job identifier is invalid.",
      );
    }

    const { user } = await requireRequestUser(request);
    const state = await loadCandidateApplyState(id, user.id, user.email || "");

    if (state.error) return state.error;

    return NextResponse.json(
      {
        data: {
          profile: state.profile,
          application: state.application,
        },
        meta: { available: true },
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return handleRouteException(error);
  }
}

export async function POST(request: Request, context: ApplyRouteContext) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return apiError(
        400,
        "INVALID_JOB_ID",
        "The requested job identifier is invalid.",
      );
    }

    const { user } = await requireRequestUser(request);
    const input = await parseApplyInput(request);
    if ("error" in input) return input.error;

    const state = await loadCandidateApplyState(id, user.id, user.email || "");
    if (state.error) return state.error;
    if (!state.profile?.ready || !state.profileRow) {
      return NextResponse.json(
        {
          data: {
            profile: state.profile,
            application: null,
          },
          error: {
            code: "PROFILE_NOT_READY",
            message:
              "Complete the required crew profile fields before applying.",
          },
        },
        { status: 422, headers: noStoreHeaders },
      );
    }

    if (state.application) {
      return NextResponse.json(
        {
          data: { application: state.application },
          error: {
            code: "ALREADY_APPLIED",
            message: "You have already applied to this role.",
          },
        },
        { status: 409, headers: noStoreHeaders },
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from("job_applications")
      .insert({
        job_id: id,
        crew_profile_id: state.profile.id,
        applicant_user_id: user.id,
        status: "applied",
        cover_note: input.coverNote,
        answers: {},
        profile_snapshot: buildProfileSnapshot(
          state.profileRow,
          user.email || "",
        ),
        consent_to_share_profile: true,
      })
      .select(APPLICATION_SELECT)
      .single();

    if (error) {
      if (error.code === "23505") {
        const existing = await loadExistingApplication(id, user.id);
        return NextResponse.json(
          {
            data: { application: existing },
            error: {
              code: "ALREADY_APPLIED",
              message: "You have already applied to this role.",
            },
          },
          { status: 409, headers: noStoreHeaders },
        );
      }
      if (isSchemaUnavailable(error)) return jobsUnavailableResponse();
      if (error.code === "42501") {
        return apiError(
          409,
          "APPLICATION_NOT_ACCEPTED",
          "This role is no longer accepting applications.",
        );
      }

      console.error("[jobs/apply] Application insert failed", {
        code: error.code,
      });
      return apiError(
        500,
        "APPLICATION_FAILED",
        "Your application could not be submitted. Please try again.",
      );
    }

    return NextResponse.json(
      {
        data: {
          application: mapApplication(data as unknown as DatabaseRow),
        },
        message: "Application submitted.",
      },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    return handleRouteException(error);
  }
}

async function loadCandidateApplyState(
  jobId: string,
  userId: string,
  fallbackEmail: string,
): Promise<{
  profile: CandidateProfileDto | null;
  profileRow: DatabaseRow | null;
  application: ApplicationDto | null;
  error: NextResponse | null;
}> {
  const admin = getSupabaseAdmin();
  const [jobResult, profileResult, applicationResult] = await Promise.all([
    admin.from("job_posts").select(JOB_SELECT).eq("id", jobId).maybeSingle(),
    admin
      .from("crew_profiles")
      .select(CREW_PROFILE_SELECT)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("job_applications")
      .select(APPLICATION_SELECT)
      .eq("job_id", jobId)
      .eq("applicant_user_id", userId)
      .maybeSingle(),
  ]);

  const databaseError =
    jobResult.error || profileResult.error || applicationResult.error;
  if (databaseError) {
    if (isSchemaUnavailable(databaseError)) {
      return {
        profile: null,
        profileRow: null,
        application: null,
        error: jobsUnavailableResponse(),
      };
    }

    console.error("[jobs/apply] Candidate state query failed", {
      code: databaseError.code,
    });
    return {
      profile: null,
      profileRow: null,
      application: null,
      error: apiError(
        500,
        "APPLICATION_STATE_FAILED",
        "Application readiness could not be checked.",
      ),
    };
  }

  const job = asRow(jobResult.data);
  if (!job) {
    return {
      profile: null,
      profileRow: null,
      application: null,
      error: apiError(
        404,
        "JOB_NOT_FOUND",
        "This role is not available.",
      ),
    };
  }

  const employerId = asString(job.employer_id);
  if (!isOpenJob(job) || !employerId) {
    return {
      profile: null,
      profileRow: null,
      application: null,
      error: apiError(
        409,
        "JOB_CLOSED",
        "Applications for this role are closed.",
      ),
    };
  }

  const { data: employerData, error: employerError } = await admin
    .from("employer_profiles")
    .select("id,verification_status")
    .eq("id", employerId)
    .maybeSingle();

  if (employerError) {
    if (isSchemaUnavailable(employerError)) {
      return {
        profile: null,
        profileRow: null,
        application: null,
        error: jobsUnavailableResponse(),
      };
    }

    console.error("[jobs/apply] Employer verification query failed", {
      code: employerError.code,
    });
    return {
      profile: null,
      profileRow: null,
      application: null,
      error: apiError(
        500,
        "APPLICATION_STATE_FAILED",
        "Application readiness could not be checked.",
      ),
    };
  }

  const employer = asRow(employerData);
  if (!employer || employer.verification_status !== "verified") {
    return {
      profile: null,
      profileRow: null,
      application: null,
      error: apiError(
        409,
        "JOB_CLOSED",
        "Applications for this role are closed.",
      ),
    };
  }

  const profileRow = asRow(profileResult.data);

  return {
    profile: profileRow
      ? mapCandidateProfile(profileRow, fallbackEmail)
      : null,
    profileRow,
    application: applicationResult.data
      ? mapApplication(applicationResult.data as unknown as DatabaseRow)
      : null,
    error: null,
  };
}

async function loadExistingApplication(
  jobId: string,
  userId: string,
): Promise<ApplicationDto | null> {
  const { data } = await getSupabaseAdmin()
    .from("job_applications")
    .select(APPLICATION_SELECT)
    .eq("job_id", jobId)
    .eq("applicant_user_id", userId)
    .maybeSingle();

  return data
    ? mapApplication(data as unknown as DatabaseRow)
    : null;
}

async function parseApplyInput(
  request: Request,
): Promise<
  | { coverNote: string; consentToShareProfile: true }
  | { error: NextResponse }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      error: apiError(
        400,
        "INVALID_BODY",
        "A valid application request is required.",
      ),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      error: apiError(
        400,
        "INVALID_BODY",
        "A valid application request is required.",
      ),
    };
  }

  const record = body as Record<string, unknown>;
  const coverNote = cleanCoverNote(record.coverNote);
  if (
    coverNote.length < COVER_NOTE_MINIMUM_LENGTH ||
    coverNote.length > COVER_NOTE_MAXIMUM_LENGTH
  ) {
    return {
      error: apiError(
        422,
        "INVALID_COVER_NOTE",
        `Your cover note must be between ${COVER_NOTE_MINIMUM_LENGTH} and ${COVER_NOTE_MAXIMUM_LENGTH} characters.`,
      ),
    };
  }

  if (record.consentToShareProfile !== true) {
    return {
      error: apiError(
        422,
        "CONSENT_REQUIRED",
        "Consent to share your crew profile is required.",
      ),
    };
  }

  return {
    coverNote,
    consentToShareProfile: true,
  };
}

function mapCandidateProfile(
  row: DatabaseRow,
  fallbackEmail: string,
): CandidateProfileDto {
  const fullName = asString(row.full_name) || "";
  const email = asString(row.email) || fallbackEmail.trim();
  const currentPosition = asString(row.current_position) || "";
  const location = asString(row.location) || "";
  const professionalSummary = asString(row.bio) || "";
  const missingFields = [
    !fullName ? "Name and surname" : null,
    !isEmail(email) ? "Email" : null,
    !currentPosition ? "Current position" : null,
    !location ? "Location" : null,
    professionalSummary.length < 40 ? "Professional summary" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    id: asString(row.id) || "",
    fullName,
    currentPosition,
    location,
    ready: Boolean(asString(row.id)) && missingFields.length === 0,
    missingFields,
  };
}

function buildProfileSnapshot(
  row: DatabaseRow,
  fallbackEmail: string,
): Record<string, unknown> {
  return {
    publicCrewId: boundedString(row.public_crew_id, 80),
    fullName: boundedString(row.full_name, 160),
    email:
      boundedString(row.email, 320) ||
      boundedString(fallbackEmail, 320),
    currentPosition: boundedString(row.current_position, 120),
    location: boundedString(row.location, 160),
    nationality: boundedString(row.nationality, 100),
    professionalSummary: boundedString(row.bio, 2_000),
    profilePhotoUrl: boundedString(row.profile_photo_url, 2_048),
    seekingPositions: asStringArray(row.seeking_positions),
    workPreferences: asStringArray(row.work_preferences),
    languages: asLanguages(row.languages),
    capturedAt: new Date().toISOString(),
  };
}

function mapApplication(row: DatabaseRow): ApplicationDto {
  return {
    id: asString(row.id) || "",
    status: normalizeApplicationStatus(row.status),
    submittedAt: asDateString(row.submitted_at),
  };
}

function isOpenJob(row: DatabaseRow): boolean {
  if (row.status !== "published") return false;

  const now = Date.now();
  const publishedAt = dateNumber(row.published_at);
  const expiresAt = dateNumber(row.expires_at);
  const deadline = dateNumber(row.application_deadline);

  return (
    publishedAt !== null &&
    publishedAt <= now &&
    (expiresAt === null || expiresAt > now) &&
    (deadline === null || deadline > now)
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

function jobsUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      data: null,
      meta: { available: false },
      error: {
        code: "JOBS_UNAVAILABLE",
        message: "The protected applications service is not available yet.",
      },
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
      data: null,
      error: { code, message },
    },
    { status, headers: noStoreHeaders },
  );
}

function handleRouteException(error: unknown): NextResponse {
  if (error instanceof RequestAuthError) {
    return apiError(error.status, "AUTH_REQUIRED", error.message);
  }

  if (
    error instanceof Error &&
    /server credentials are not configured/i.test(error.message)
  ) {
    return jobsUnavailableResponse();
  }

  console.error("[jobs/apply] Unexpected route failure", error);
  return apiError(
    500,
    "APPLICATION_FAILED",
    "Your application could not be processed.",
  );
}

function asRow(value: unknown): DatabaseRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DatabaseRow)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean || null;
}

function boundedString(
  value: unknown,
  maximumLength: number,
): string | null {
  const clean = asString(value);
  return clean ? clean.slice(0, maximumLength) : null;
}

function cleanCoverNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => boundedString(item, 160))
    .filter((item): item is string => Boolean(item))
    .slice(0, 30);
}

function asLanguages(value: unknown): Array<{
  name: string;
  level: string | null;
}> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const record = item as Record<string, unknown>;
      const name = boundedString(record.name, 100);
      if (!name) return null;
      return {
        name,
        level: boundedString(record.level, 80),
      };
    })
    .filter(
      (
        item,
      ): item is {
        name: string;
        level: string | null;
      } => item !== null,
    )
    .slice(0, 20);
}

function asDateString(value: unknown): string | null {
  const timestamp = dateNumber(value);
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

function dateNumber(value: unknown): number | null {
  const clean = asString(value);
  if (!clean) return null;
  const timestamp = new Date(clean).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function normalizeApplicationStatus(value: unknown): string {
  const status = asString(value);
  return status || "applied";
}

type CandidateProfileDto = {
  id: string;
  fullName: string;
  currentPosition: string;
  location: string;
  ready: boolean;
  missingFields: string[];
};

type ApplicationDto = {
  id: string;
  status: string;
  submittedAt: string | null;
};

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
};
