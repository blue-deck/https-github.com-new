import { NextResponse } from "next/server";
import {
  hasPlatformRole,
  requireRequestUser,
  RequestAuthError,
} from "../../../../../lib/server/auth";
import { getSupabaseAdmin } from "../../../../../lib/server/supabaseAdmin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type Row = Record<string, unknown>;
const EMPLOYER_REVIEW_ROLES = ["admin", "moderator"] as const;

export async function GET(request: Request, context: RouteContext) {
  try {
    const { user } = await requireRequestUser(request);
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid job identifier." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const canReviewEmployers = hasPlatformRole(user, EMPLOYER_REVIEW_ROLES);
    const jobResult = await admin
      .from("job_posts")
      .select(
        "id,title,position,department,status,yacht_id,yacht_name,employer_id,created_at,published_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (isSchemaUnavailable(jobResult.error)) {
      return NextResponse.json(
        { available: false, job: null, applications: [] },
        { status: 503 },
      );
    }
    if (jobResult.error || !jobResult.data) {
      return NextResponse.json({ error: "Job post not found." }, { status: 404 });
    }

    let employerQuery = admin
      .from("employer_profiles")
      .select("id,user_id,display_name,company_name,verification_status")
      .eq("id", jobResult.data.employer_id);
    if (!canReviewEmployers) {
      employerQuery = employerQuery.eq("user_id", user.id);
    }
    const employerResult = await employerQuery.maybeSingle();

    if (employerResult.error || !employerResult.data) {
      return NextResponse.json(
        { error: "You do not have access to this hiring pipeline." },
        { status: 403 },
      );
    }
    if (
      !canReviewEmployers &&
      employerResult.data.verification_status !== "verified"
    ) {
      return NextResponse.json(
        {
          error: "Employer verification is required to access candidate applications.",
          verification_required: true,
        },
        { status: 403 },
      );
    }

    const applicationsResult = await admin
      .from("job_applications")
      .select(
        "id,job_id,crew_profile_id,applicant_user_id,status,cover_note,answers,profile_snapshot,submitted_at,viewed_at,shortlisted_at,interview_at,offered_at,hired_at,rejected_at,withdrawn_at,created_at,updated_at",
      )
      .eq("job_id", id)
      .order("submitted_at", { ascending: false });

    if (applicationsResult.error) {
      return NextResponse.json(
        { error: "Applications could not be loaded." },
        { status: 500 },
      );
    }

    const applications = (applicationsResult.data || []) as Row[];
    const crewProfileIds = [
      ...new Set(
        applications
          .map((application) => String(application.crew_profile_id || ""))
          .filter(Boolean),
      ),
    ];
    const profileMap = new Map<string, Row>();

    if (crewProfileIds.length) {
      const profilesResult = await admin
        .from("crew_profiles")
        .select(
          "id,public_crew_id,full_name,email,phone,current_position,profile_photo_url,location,nationality,seeking_positions,skills,languages",
        )
        .in("id", crewProfileIds);

      if (!profilesResult.error) {
        for (const profile of (profilesResult.data || []) as Row[]) {
          profileMap.set(String(profile.id), profile);
        }
      }
    }

    return NextResponse.json({
      available: true,
      job: jobResult.data,
      employer: {
        id: employerResult.data.id,
        display_name: employerResult.data.display_name,
        company_name: employerResult.data.company_name,
      },
      applications: applications.map((application) => ({
        ...application,
        candidate: sanitizeCandidate(
          profileMap.get(String(application.crew_profile_id)),
          application.profile_snapshot,
        ),
      })),
    });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Applications could not be loaded." },
      { status: 500 },
    );
  }
}

function sanitizeCandidate(profile?: Row, snapshot?: unknown) {
  const saved =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? (snapshot as Row)
      : {};
  return {
    id: profile?.id || saved.id || null,
    public_crew_id:
      profile?.public_crew_id ||
      saved.public_crew_id ||
      saved.publicCrewId ||
      null,
    full_name:
      profile?.full_name ||
      saved.full_name ||
      saved.fullName ||
      "BlueDeck candidate",
    email: profile?.email || saved.email || null,
    phone: profile?.phone || saved.phone || null,
    current_position:
      profile?.current_position ||
      saved.current_position ||
      saved.currentPosition ||
      null,
    profile_photo_url:
      profile?.profile_photo_url ||
      saved.profile_photo_url ||
      saved.profilePhotoUrl ||
      null,
    location: profile?.location || saved.location || null,
    nationality: profile?.nationality || saved.nationality || null,
    seeking_positions:
      profile?.seeking_positions ||
      saved.seeking_positions ||
      saved.seekingPositions ||
      [],
    skills: profile?.skills || saved.skills || [],
    languages: profile?.languages || saved.languages || [],
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSchemaUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return (
    ["42P01", "PGRST204", "PGRST205"].includes(value.code || "") ||
    /schema cache|does not exist|could not find the table/i.test(value.message || "")
  );
}
