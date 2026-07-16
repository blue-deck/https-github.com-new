import { NextResponse } from "next/server";
import { getPosition } from "../../../../lib/yachtOperations";
import { requireRequestUser, RequestAuthError } from "../../../../lib/server/auth";
import { getSupabaseAdmin } from "../../../../lib/server/supabaseAdmin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const transitions: Record<string, readonly string[]> = {
  draft: ["published", "closed"],
  pending_review: ["draft", "published", "closed"],
  published: ["paused", "filled", "closed"],
  paused: ["published", "closed"],
  filled: ["closed"],
  rejected: ["draft"],
  expired: ["draft"],
};

const editableStatuses = new Set(["draft", "paused", "rejected", "expired"]);
const employmentTypes = new Set([
  "permanent",
  "seasonal",
  "rotational",
  "temporary",
  "delivery",
  "daywork",
  "freelance",
]);
const yachtTypes = new Set([
  "motor_yacht",
  "sailing_yacht",
  "catamaran",
  "motor_catamaran",
  "gulet",
  "expedition_yacht",
  "support_vessel",
  "chase_boat",
  "commercial_vessel",
  "other",
]);
const yachtPrograms = new Set([
  "private",
  "charter",
  "private_charter",
  "new_build",
  "refit",
  "delivery",
  "yard_period",
  "race_regatta",
  "other",
]);
const salaryPeriods = new Set(["hour", "day", "week", "month", "year", "contract"]);
const safeJobSelect =
  "id,slug,title,position,department,employment_type,yacht_id,location,country_code,yacht_name,yacht_type,yacht_length_metres,yacht_program,rotation,start_date,end_date,summary,description,responsibilities,requirements,benefits,certifications,visas,languages,minimum_experience_years,application_instructions,salary_currency,salary_minimum,salary_maximum,salary_period,salary_visible,featured,openings_count,status,application_deadline,published_at,expires_at,closed_at,created_at,updated_at";

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { user } = await requireRequestUser(request);
    const { id } = await context.params;

    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid job identifier." }, { status: 400 });
    }

    const parsedBody = await request.json();
    if (!isRecord(parsedBody)) {
      return NextResponse.json({ error: "Invalid job status request." }, { status: 400 });
    }
    const body = parsedBody;
    const nextStatus =
      typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    const admin = getSupabaseAdmin();

    const jobResult = await admin
      .from("job_posts")
      .select(
        "id,employer_id,status,yacht_id,summary,description,responsibilities,requirements,application_deadline,published_at,expires_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (jobResult.error) {
      return unavailableResponse();
    }
    if (!jobResult.data) {
      return notFoundResponse();
    }

    const employerResult = await admin
      .from("employer_profiles")
      .select("id,verification_status")
      .eq("id", jobResult.data.employer_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (employerResult.error) {
      return unavailableResponse();
    }
    if (!employerResult.data) {
      return notFoundResponse();
    }

    const currentStatus = String(jobResult.data.status || "");
    if (!transitions[currentStatus]?.includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Job cannot move from ${currentStatus || "its current status"} to ${
            nextStatus || "that status"
          }.`,
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const updatePayload: {
      status: string;
      published_at?: string;
      expires_at?: string;
      closed_at: string | null;
    } = {
      status: nextStatus,
      closed_at: nextStatus === "filled" || nextStatus === "closed" ? nowIso : null,
    };

    if (nextStatus === "published") {
      if (employerResult.data.verification_status !== "verified") {
        return NextResponse.json(
          { error: "Employer verification is required before publishing." },
          { status: 409 },
        );
      }
      if (!jobResult.data.yacht_id) {
        return NextResponse.json(
          { error: "Connect an owned yacht before publishing this role." },
          { status: 409 },
        );
      }
      if (
        !hasText(jobResult.data.summary, 20) ||
        !hasText(jobResult.data.description, 60) ||
        !hasTextItems(jobResult.data.responsibilities) ||
        !hasTextItems(jobResult.data.requirements)
      ) {
        return NextResponse.json(
          {
            error:
              "Complete the summary, description, responsibilities and requirements before publishing.",
          },
          { status: 409 },
        );
      }
      const applicationDeadline = parseTimestamp(jobResult.data.application_deadline);
      if (
        jobResult.data.application_deadline &&
        (!applicationDeadline || applicationDeadline.getTime() < now.getTime())
      ) {
        return NextResponse.json(
          { error: "Choose a future application deadline before publishing." },
          { status: 409 },
        );
      }

      const yachtResult = await admin
        .from("yachts")
        .select("id")
        .eq("id", jobResult.data.yacht_id)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (yachtResult.error) {
        return unavailableResponse();
      }
      if (!yachtResult.data) {
        return NextResponse.json(
          { error: "The connected yacht must be owned by this BlueDeck account." },
          { status: 409 },
        );
      }

      let publishedAt = parseTimestamp(jobResult.data.published_at);
      if (!publishedAt || publishedAt.getTime() > now.getTime()) {
        publishedAt = now;
        updatePayload.published_at = nowIso;
      }

      const expiresAt = parseTimestamp(jobResult.data.expires_at);
      if (
        !expiresAt ||
        expiresAt.getTime() <= now.getTime() ||
        expiresAt.getTime() <= publishedAt.getTime()
      ) {
        updatePayload.expires_at = new Date(
          Math.max(now.getTime(), publishedAt.getTime()) + 60 * 24 * 60 * 60 * 1000,
        ).toISOString();
      }
    }

    const updateResult = await admin
      .from("job_posts")
      .update(updatePayload)
      .eq("id", id)
      .eq("employer_id", jobResult.data.employer_id)
      .eq("status", currentStatus)
      .select("id,status,published_at,expires_at,closed_at,updated_at")
      .maybeSingle();

    if (updateResult.error) {
      return unavailableResponse();
    }
    if (!updateResult.data) {
      return NextResponse.json(
        { error: "The job status changed before this request could be completed." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, job: updateResult.data });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid job status request." }, { status: 400 });
    }
    return unavailableResponse();
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { user } = await requireRequestUser(request);
    const { id } = await context.params;

    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid job identifier." }, { status: 400 });
    }

    const parsedBody = await request.json();
    if (!isRecord(parsedBody)) {
      return NextResponse.json({ error: "Invalid job update request." }, { status: 400 });
    }
    const body = parsedBody;
    const admin = getSupabaseAdmin();

    const jobResult = await admin
      .from("job_posts")
      .select("id,employer_id,status")
      .eq("id", id)
      .maybeSingle();

    if (jobResult.error) {
      return unavailableResponse();
    }
    if (!jobResult.data) {
      return notFoundResponse();
    }

    const employerResult = await admin
      .from("employer_profiles")
      .select("id")
      .eq("id", jobResult.data.employer_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (employerResult.error) {
      return unavailableResponse();
    }
    if (!employerResult.data) {
      return notFoundResponse();
    }

    const currentStatus = String(jobResult.data.status || "");
    if (!editableStatuses.has(currentStatus)) {
      return NextResponse.json(
        { error: "Only draft, paused, rejected or expired jobs can be edited." },
        { status: 409 },
      );
    }

    const title = cleanText(body.title, 160);
    const position = getPosition(cleanText(body.position, 100));
    const employmentType = cleanText(body.employment_type, 30).toLowerCase();
    const yachtType = cleanText(body.yacht_type, 40).toLowerCase();
    const location = cleanText(body.location, 160);

    if (title.length < 3) {
      return NextResponse.json(
        { error: "Job title must contain at least 3 characters." },
        { status: 400 },
      );
    }
    if (!position) {
      return NextResponse.json(
        { error: "Select a valid yacht position." },
        { status: 400 },
      );
    }
    if (!employmentTypes.has(employmentType)) {
      return NextResponse.json(
        { error: "Select a valid employment type." },
        { status: 400 },
      );
    }
    if (!yachtTypes.has(yachtType)) {
      return NextResponse.json(
        { error: "Select a valid yacht type." },
        { status: 400 },
      );
    }
    if (location.length < 2) {
      return NextResponse.json(
        { error: "Enter the job location or cruising area." },
        { status: 400 },
      );
    }

    const rawYachtId = cleanText(body.yacht_id, 80);
    if (rawYachtId && !isUuid(rawYachtId)) {
      return NextResponse.json(
        { error: "Select a valid BlueDeck yacht." },
        { status: 400 },
      );
    }

    const countryCode = cleanText(body.country_code, 8).toUpperCase();
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
      return NextResponse.json(
        { error: "Country must use a valid two-letter code." },
        { status: 400 },
      );
    }

    const yachtProgram = cleanText(body.yacht_program, 60).toLowerCase();
    if (yachtProgram && !yachtPrograms.has(yachtProgram)) {
      return NextResponse.json(
        { error: "Select a valid yacht program." },
        { status: 400 },
      );
    }

    const startDate = parseOptionalDate(body.start_date);
    const endDate = parseOptionalDate(body.end_date);
    if (!startDate.valid || !endDate.valid) {
      return NextResponse.json(
        { error: "Enter valid start and end dates." },
        { status: 400 },
      );
    }
    if (startDate.value && endDate.value && endDate.value < startDate.value) {
      return NextResponse.json(
        { error: "End date cannot be earlier than the start date." },
        { status: 400 },
      );
    }

    const applicationDeadline = parseOptionalDeadline(body.application_deadline);
    if (!applicationDeadline.valid) {
      return NextResponse.json(
        { error: "Enter a valid application deadline." },
        { status: 400 },
      );
    }
    if (
      applicationDeadline.value &&
      applicationDeadline.value.getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: "Application deadline cannot be in the past." },
        { status: 400 },
      );
    }

    const yachtLength = parseOptionalNumber(body.yacht_length_metres, 1, 300);
    if (!yachtLength.valid) {
      return NextResponse.json(
        { error: "Yacht length must be between 1 and 300 metres." },
        { status: 400 },
      );
    }

    const minimumExperience = parseOptionalNumber(
      body.minimum_experience_years,
      0,
      80,
    );
    if (!minimumExperience.valid) {
      return NextResponse.json(
        { error: "Minimum experience must be between 0 and 80 years." },
        { status: 400 },
      );
    }

    const salaryMinimum = parseOptionalNumber(body.salary_minimum, 0, 100_000_000);
    const salaryMaximum = parseOptionalNumber(body.salary_maximum, 0, 100_000_000);
    if (!salaryMinimum.valid || !salaryMaximum.valid) {
      return NextResponse.json(
        { error: "Enter a valid salary amount." },
        { status: 400 },
      );
    }
    if (
      salaryMinimum.value !== null &&
      salaryMaximum.value !== null &&
      salaryMaximum.value < salaryMinimum.value
    ) {
      return NextResponse.json(
        { error: "Maximum salary cannot be lower than minimum salary." },
        { status: 400 },
      );
    }

    const hasSalary = salaryMinimum.value !== null || salaryMaximum.value !== null;
    const salaryCurrency = cleanText(body.salary_currency, 3).toUpperCase();
    const salaryPeriod = cleanText(body.salary_period, 20).toLowerCase();
    if (
      hasSalary &&
      (!/^[A-Z]{3}$/.test(salaryCurrency) || !salaryPeriods.has(salaryPeriod))
    ) {
      return NextResponse.json(
        { error: "Salary currency and period are required when a salary is entered." },
        { status: 400 },
      );
    }
    const salaryVisible = body.salary_visible === true && hasSalary;

    const openings = parseOptionalInteger(body.openings_count, 1, 100);
    if (!openings.valid) {
      return NextResponse.json(
        { error: "Open positions must be a whole number between 1 and 100." },
        { status: 400 },
      );
    }

    const summary = cleanMultiline(body.summary, 600);
    const description = cleanMultiline(body.description, 12_000);
    if (!summary || !description) {
      return NextResponse.json(
        { error: "A role summary and full description are required." },
        { status: 400 },
      );
    }

    let yacht: { id: string; name: string | null } | null = null;
    if (rawYachtId) {
      const yachtResult = await admin
        .from("yachts")
        .select("id,name")
        .eq("id", rawYachtId)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (yachtResult.error) {
        return unavailableResponse();
      }
      if (!yachtResult.data) {
        return NextResponse.json(
          { error: "Select a yacht owned by this BlueDeck account." },
          { status: 403 },
        );
      }
      yacht = yachtResult.data;
    }

    const updatePayload = {
      title,
      position: position.title,
      department: position.department,
      employment_type: employmentType,
      yacht_id: yacht?.id || null,
      location,
      country_code: countryCode || null,
      yacht_name: yacht?.name || cleanText(body.yacht_name, 160) || null,
      yacht_type: yachtType,
      yacht_length_metres: yachtLength.value,
      yacht_program: yachtProgram || null,
      rotation: cleanText(body.rotation, 120) || null,
      start_date: startDate.value,
      end_date: endDate.value,
      summary,
      description,
      responsibilities: cleanStringArray(body.responsibilities, 30, 300),
      requirements: cleanStringArray(body.requirements, 30, 300),
      benefits: cleanStringArray(body.benefits, 30, 300),
      certifications: cleanStringArray(body.certifications, 30, 120),
      visas: cleanStringArray(body.visas, 20, 80),
      languages: cleanStringArray(body.languages, 20, 80),
      minimum_experience_years: minimumExperience.value ?? 0,
      application_instructions: cleanMultiline(body.application_instructions, 3000),
      salary_currency: salaryVisible ? salaryCurrency : null,
      salary_minimum: salaryVisible ? salaryMinimum.value : null,
      salary_maximum: salaryVisible ? salaryMaximum.value : null,
      salary_period: salaryVisible ? salaryPeriod : null,
      salary_visible: salaryVisible,
      openings_count: openings.value ?? 1,
      application_deadline: applicationDeadline.value?.toISOString() || null,
    };

    const applicationCountResult = await admin
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .eq("job_id", id);

    if (applicationCountResult.error) {
      return unavailableResponse();
    }

    const updateResult = await admin
      .from("job_posts")
      .update(updatePayload)
      .eq("id", id)
      .eq("employer_id", jobResult.data.employer_id)
      .eq("status", currentStatus)
      .select(safeJobSelect)
      .maybeSingle();

    if (updateResult.error) {
      return unavailableResponse();
    }
    if (!updateResult.data) {
      return NextResponse.json(
        { error: "The job changed before this request could be completed." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      job: {
        ...updateResult.data,
        application_count: applicationCountResult.count || 0,
      },
    });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid job update request." }, { status: 400 });
    }
    return unavailableResponse();
  }
}

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maximumLength)
    : "";
}

function cleanMultiline(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value
        .replace(/\u0000/g, "")
        .replace(/\r\n?/g, "\n")
        .trim()
        .slice(0, maximumLength)
    : "";
}

function cleanStringArray(
  value: unknown,
  maximumItems: number,
  maximumLength: number,
) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];

  return source
    .map((item) => cleanText(item, maximumLength))
    .filter(Boolean)
    .slice(0, maximumItems);
}

function parseOptionalDate(
  value: unknown,
): { valid: true; value: string | null } | { valid: false; value: null } {
  const clean = cleanText(value, 20);
  if (!clean) return { valid: true, value: null };
  if (!isCalendarDate(clean)) return { valid: false, value: null };
  return { valid: true, value: clean };
}

function parseOptionalDeadline(
  value: unknown,
): { valid: true; value: Date | null } | { valid: false; value: null } {
  const clean = cleanText(value, 80);
  if (!clean) return { valid: true, value: null };

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    if (!isCalendarDate(clean)) return { valid: false, value: null };
    return { valid: true, value: new Date(`${clean}T23:59:59.999Z`) };
  }

  const deadline = new Date(clean);
  return Number.isNaN(deadline.getTime())
    ? { valid: false, value: null }
    : { valid: true, value: deadline };
}

function parseOptionalNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): { valid: true; value: number | null } | { valid: false; value: null } {
  if (value === "" || value === null || value === undefined) {
    return { valid: true, value: null };
  }
  if (typeof value !== "number" && typeof value !== "string") {
    return { valid: false, value: null };
  }
  if (typeof value === "string" && !value.trim()) {
    return { valid: true, value: null };
  }

  const number = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    return { valid: false, value: null };
  }
  return { valid: true, value: number };
}

function parseOptionalInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): { valid: true; value: number | null } | { valid: false; value: null } {
  const parsed = parseOptionalNumber(value, minimum, maximum);
  if (!parsed.valid || (parsed.value !== null && !Number.isInteger(parsed.value))) {
    return { valid: false, value: null };
  }
  return parsed;
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown, minimumLength = 1): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= minimumLength
  );
}

function hasTextItems(value: unknown): value is string[] {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function parseTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function notFoundResponse() {
  return NextResponse.json({ error: "Job not found." }, { status: 404 });
}

function unavailableResponse() {
  return NextResponse.json(
    { error: "The protected hiring service is temporarily unavailable.", available: false },
    { status: 503 },
  );
}
