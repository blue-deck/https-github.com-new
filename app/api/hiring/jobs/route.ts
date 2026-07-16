import { NextResponse } from "next/server";
import { getPosition } from "../../../lib/yachtOperations";
import { requireRequestUser, RequestAuthError } from "../../../lib/server/auth";
import { getSupabaseAdmin } from "../../../lib/server/supabaseAdmin";

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
const salaryPeriods = new Set(["hour", "day", "week", "month", "year", "contract"]);

type JobBody = Record<string, unknown> & {
  intent?: unknown;
};

export async function POST(request: Request) {
  try {
    const { user } = await requireRequestUser(request);
    const body = (await request.json()) as JobBody;
    const admin = getSupabaseAdmin();

    const employerResult = await admin
      .from("employer_profiles")
      .select("id,display_name,company_name,verification_status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (isSchemaUnavailable(employerResult.error)) {
      return NextResponse.json(
        { error: "The protected hiring database is not ready yet.", available: false },
        { status: 503 },
      );
    }
    if (employerResult.error || !employerResult.data) {
      return NextResponse.json(
        { error: "Create your employer profile before posting a role." },
        { status: 403 },
      );
    }

    const title = cleanText(body.title, 160);
    const requestedPosition = cleanText(body.position, 100);
    const position = getPosition(requestedPosition);
    const employmentType = cleanText(body.employment_type, 30).toLowerCase();
    const yachtType = cleanText(body.yacht_type, 40).toLowerCase();
    const location = cleanText(body.location, 160);
    const intent = cleanText(body.intent, 20).toLowerCase() === "publish" ? "publish" : "draft";
    const yachtId = cleanUuid(body.yacht_id);

    if (title.length < 3) {
      return NextResponse.json({ error: "Job title must contain at least 3 characters." }, { status: 400 });
    }
    if (!position) {
      return NextResponse.json({ error: "Select a valid yacht position." }, { status: 400 });
    }
    if (!employmentTypes.has(employmentType)) {
      return NextResponse.json({ error: "Select a valid employment type." }, { status: 400 });
    }
    if (!yachtTypes.has(yachtType)) {
      return NextResponse.json({ error: "Select a valid yacht type." }, { status: 400 });
    }
    if (location.length < 2) {
      return NextResponse.json({ error: "Enter the job location or cruising area." }, { status: 400 });
    }

    let yacht:
      | { id: string; name: string | null; model: string | null; flag: string | null }
      | null = null;
    if (yachtId) {
      const yachtResult = await admin
        .from("yachts")
        .select("id,name,model,flag")
        .eq("id", yachtId)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (yachtResult.error || !yachtResult.data) {
        return NextResponse.json(
          { error: "Select a yacht owned by this BlueDeck account." },
          { status: 403 },
        );
      }
      yacht = yachtResult.data;
    }

    if (intent === "publish") {
      if (employerResult.data.verification_status !== "verified") {
        return NextResponse.json(
          { error: "Employer verification is required before publishing." },
          { status: 403 },
        );
      }
      if (!yacht) {
        return NextResponse.json(
          { error: "Connect an owned yacht before publishing this role." },
          { status: 403 },
        );
      }
    }

    const salaryMinimum = optionalNumber(body.salary_minimum, 0, 100_000_000);
    const salaryMaximum = optionalNumber(body.salary_maximum, 0, 100_000_000);
    const salaryCurrency = cleanText(body.salary_currency, 3).toUpperCase();
    const salaryPeriod = cleanText(body.salary_period, 20).toLowerCase();
    if (salaryMinimum !== null && salaryMaximum !== null && salaryMaximum < salaryMinimum) {
      return NextResponse.json(
        { error: "Maximum salary cannot be lower than minimum salary." },
        { status: 400 },
      );
    }
    if (
      (salaryMinimum !== null || salaryMaximum !== null) &&
      (!/^[A-Z]{3}$/.test(salaryCurrency) || !salaryPeriods.has(salaryPeriod))
    ) {
      return NextResponse.json(
        { error: "Salary currency and period are required when a salary is entered." },
        { status: 400 },
      );
    }
    const salaryVisible =
      Boolean(body.salary_visible) && (salaryMinimum !== null || salaryMaximum !== null);

    const now = new Date();
    const startDate = cleanDate(body.start_date);
    const endDate = cleanDate(body.end_date);
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json(
        { error: "End date cannot be earlier than the start date." },
        { status: 400 },
      );
    }
    const applicationDeadline = cleanTimestamp(body.application_deadline);
    if (
      applicationDeadline &&
      new Date(applicationDeadline).getTime() <= now.getTime()
    ) {
      return NextResponse.json(
        { error: "Application deadline must be in the future." },
        { status: 400 },
      );
    }
    const publishedAt = intent === "publish" ? now.toISOString() : null;
    const defaultExpiry = new Date(now);
    defaultExpiry.setDate(defaultExpiry.getDate() + 60);
    const employerName =
      employerResult.data.company_name || employerResult.data.display_name || "BlueDeck employer";
    const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
    const summary = cleanMultiline(body.summary, 600);
    const description = cleanMultiline(body.description, 12_000);
    const responsibilities = cleanStringArray(body.responsibilities, 30, 300);
    const requirements = cleanStringArray(body.requirements, 30, 300);

    if (!summary || !description) {
      return NextResponse.json(
        { error: "A role summary and full description are required." },
        { status: 400 },
      );
    }
    if (
      intent === "publish" &&
      (summary.length < 20 ||
        description.length < 60 ||
        !responsibilities.length ||
        !requirements.length)
    ) {
      return NextResponse.json(
        {
          error:
            "Published roles require a complete summary, description, responsibility and requirement.",
        },
        { status: 400 },
      );
    }

    const payload = {
      slug,
      title,
      position: position.title,
      department: position.department,
      employment_type: employmentType,
      employer_id: employerResult.data.id,
      yacht_id: yacht?.id || null,
      location,
      country_code: cleanCountryCode(body.country_code),
      yacht_name: yacht?.name || cleanText(body.yacht_name, 160) || null,
      yacht_type: yachtType,
      yacht_length_metres: optionalNumber(body.yacht_length_metres, 1, 300),
      yacht_program: nullableEnum(body.yacht_program, [
        "private",
        "charter",
        "private_charter",
        "new_build",
        "refit",
        "delivery",
        "yard_period",
        "race_regatta",
        "other",
      ]),
      rotation: cleanText(body.rotation, 120) || null,
      start_date: startDate,
      end_date: endDate,
      summary,
      description,
      responsibilities,
      requirements,
      benefits: cleanStringArray(body.benefits, 30, 300),
      certifications: cleanStringArray(body.certifications, 30, 120),
      visas: cleanStringArray(body.visas, 20, 80),
      languages: cleanStringArray(body.languages, 20, 80),
      minimum_experience_years: optionalNumber(body.minimum_experience_years, 0, 80) || 0,
      application_instructions: cleanMultiline(body.application_instructions, 3000),
      salary_currency: salaryVisible ? salaryCurrency : null,
      salary_minimum: salaryVisible ? salaryMinimum : null,
      salary_maximum: salaryVisible ? salaryMaximum : null,
      salary_period: salaryVisible ? salaryPeriod : null,
      salary_visible: salaryVisible,
      featured: false,
      openings_count: optionalInteger(body.openings_count, 1, 100) || 1,
      status: intent === "publish" ? "published" : "draft",
      application_deadline: applicationDeadline,
      published_at: publishedAt,
      expires_at: intent === "publish" ? cleanTimestamp(body.expires_at) || defaultExpiry.toISOString() : null,
      created_by: user.id,
    };

    const result = await admin
      .from("job_posts")
      .insert(payload)
      .select(
        "id,slug,title,position,department,employment_type,yacht_id,location,country_code,yacht_name,yacht_type,yacht_length_metres,yacht_program,rotation,start_date,end_date,summary,description,responsibilities,requirements,benefits,certifications,visas,languages,minimum_experience_years,application_instructions,salary_currency,salary_minimum,salary_maximum,salary_period,salary_visible,openings_count,status,application_deadline,published_at,expires_at,created_at,updated_at",
      )
      .single();

    if (result.error) {
      console.error("BlueDeck job post insert failed.", {
        code: result.error.code,
        message: result.error.message,
        employer: employerResult.data.id,
        actor: user.id,
        intent,
        employerName,
      });
      return NextResponse.json({ error: "The job post could not be saved." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, job: result.data });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid job post request." }, { status: 400 });
    }
    return NextResponse.json({ error: "The job post could not be saved." }, { status: 500 });
  }
}

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximumLength)
    : "";
}

function cleanMultiline(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, maximumLength)
    : "";
}

function cleanStringArray(value: unknown, maximumItems: number, maximumLength: number) {
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

function cleanUuid(value: unknown) {
  const clean = cleanText(value, 36);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)
    ? clean
    : "";
}

function cleanCountryCode(value: unknown) {
  const code = cleanText(value, 2).toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function cleanDate(value: unknown) {
  const clean = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
}

function cleanTimestamp(value: unknown) {
  const clean = cleanText(value, 80);
  if (!clean) return null;
  const date = new Date(clean);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function optionalNumber(value: unknown, minimum: number, maximum: number) {
  if (value === "" || value === null || value === undefined) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function optionalInteger(value: unknown, minimum: number, maximum: number) {
  const number = optionalNumber(value, minimum, maximum);
  return number === null ? null : Math.round(number);
}

function nullableEnum(value: unknown, allowed: string[]) {
  const clean = cleanText(value, 60).toLowerCase();
  return allowed.includes(clean) ? clean : null;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "yacht-role";
}

function isSchemaUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return (
    ["42P01", "PGRST204", "PGRST205"].includes(value.code || "") ||
    /schema cache|does not exist|could not find the table/i.test(value.message || "")
  );
}
