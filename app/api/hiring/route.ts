import { NextResponse } from "next/server";
import {
  hasPlatformRole,
  requireRequestUser,
  RequestAuthError,
} from "../../lib/server/auth";
import { getSupabaseAdmin } from "../../lib/server/supabaseAdmin";

type Row = Record<string, unknown>;
const EMPLOYER_REVIEW_ROLES = ["admin", "moderator"] as const;

export async function GET(request: Request) {
  try {
    const { user } = await requireRequestUser(request);
    const admin = getSupabaseAdmin();
    const canReviewEmployers = hasPlatformRole(
      user,
      EMPLOYER_REVIEW_ROLES,
    );

    const employerResult = await admin
      .from("employer_profiles")
      .select(
        "id,display_name,company_name,employer_type,country_code,description,verification_status,verified_at,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (isSchemaUnavailable(employerResult.error)) {
      return NextResponse.json({
        available: false,
        employer: null,
        yachts: [],
        jobs: [],
        can_review_employers: canReviewEmployers,
      });
    }

    if (employerResult.error) {
      return NextResponse.json(
        { available: true, error: "Hiring workspace could not be loaded." },
        { status: 500 },
      );
    }

    const yachtsResult = await admin
      .from("yachts")
      .select("id,name,model,flag")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (yachtsResult.error) {
      return NextResponse.json(
        { available: true, error: "Your connected yachts could not be loaded." },
        { status: 500 },
      );
    }

    const employer = employerResult.data as Row | null;
    let jobs: Row[] = [];

    if (employer?.id) {
      const jobsResult = await admin
        .from("job_posts")
        .select(
          "id,slug,title,position,department,employment_type,yacht_id,location,country_code,yacht_name,yacht_type,yacht_length_metres,yacht_program,rotation,start_date,end_date,summary,description,responsibilities,requirements,benefits,certifications,visas,languages,minimum_experience_years,application_instructions,salary_currency,salary_minimum,salary_maximum,salary_period,salary_visible,openings_count,status,application_deadline,published_at,expires_at,created_at,updated_at",
        )
        .eq("employer_id", String(employer.id))
        .order("created_at", { ascending: false });

      if (jobsResult.error && !isSchemaUnavailable(jobsResult.error)) {
        return NextResponse.json(
          { available: true, error: "Your job posts could not be loaded." },
          { status: 500 },
        );
      }

      jobs = ((jobsResult.data || []) as Row[]).map((job) => ({
        ...job,
        application_count: 0,
      }));

      if (jobs.length) {
        const applicationResult = await admin
          .from("job_applications")
          .select("job_id")
          .in(
            "job_id",
            jobs.map((job) => String(job.id)),
          );

        if (!applicationResult.error) {
          const counts = new Map<string, number>();
          for (const application of (applicationResult.data || []) as Array<{ job_id: string }>) {
            counts.set(application.job_id, (counts.get(application.job_id) || 0) + 1);
          }
          jobs = jobs.map((job) => ({
            ...job,
            application_count: counts.get(String(job.id)) || 0,
          }));
        }
      }
    }

    return NextResponse.json({
      available: true,
      employer,
      yachts: yachtsResult.data || [],
      jobs,
      can_review_employers: canReviewEmployers,
    });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Hiring workspace could not be loaded." },
      { status: 500 },
    );
  }
}

function isSchemaUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return (
    ["42P01", "PGRST204", "PGRST205"].includes(value.code || "") ||
    /schema cache|does not exist|could not find the table/i.test(value.message || "")
  );
}
