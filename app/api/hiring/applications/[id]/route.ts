import { NextResponse } from "next/server";
import {
  hasPlatformRole,
  requireRequestUser,
  RequestAuthError,
} from "../../../../lib/server/auth";
import { getSupabaseAdmin } from "../../../../lib/server/supabaseAdmin";
import { absoluteSiteUrl } from "../../../../lib/site";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const transitions: Record<string, string[]> = {
  applied: ["viewed", "shortlisted", "rejected"],
  viewed: ["shortlisted", "interview", "rejected"],
  shortlisted: ["interview", "reference_check", "offer", "rejected"],
  interview: ["shortlisted", "reference_check", "offer", "rejected"],
  reference_check: ["interview", "offer", "rejected"],
  offer: ["hired", "rejected"],
};
const EMPLOYER_REVIEW_ROLES = ["admin", "moderator"] as const;

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { user } = await requireRequestUser(request);
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid application identifier." }, { status: 400 });
    }

    const body = (await request.json()) as { status?: unknown };
    const nextStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    const admin = getSupabaseAdmin();
    const canReviewEmployers = hasPlatformRole(user, EMPLOYER_REVIEW_ROLES);

    const applicationResult = await admin
      .from("job_applications")
      .select(
        "id,job_id,crew_profile_id,applicant_user_id,status,profile_snapshot,submitted_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (isSchemaUnavailable(applicationResult.error)) {
      return NextResponse.json(
        { error: "The protected hiring database is not ready yet.", available: false },
        { status: 503 },
      );
    }
    if (applicationResult.error || !applicationResult.data) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const jobResult = await admin
      .from("job_posts")
      .select("id,title,position,department,yacht_id,yacht_name,employer_id,status")
      .eq("id", applicationResult.data.job_id)
      .maybeSingle();
    if (jobResult.error || !jobResult.data) {
      return NextResponse.json({ error: "Connected job post not found." }, { status: 404 });
    }

    let employerQuery = admin
      .from("employer_profiles")
      .select("id,user_id,verification_status")
      .eq("id", jobResult.data.employer_id);
    if (!canReviewEmployers) {
      employerQuery = employerQuery.eq("user_id", user.id);
    }
    const employerResult = await employerQuery.maybeSingle();
    if (employerResult.error || !employerResult.data) {
      return NextResponse.json(
        { error: "You do not have access to this application." },
        { status: 403 },
      );
    }
    if (
      !canReviewEmployers &&
      employerResult.data.verification_status !== "verified"
    ) {
      return NextResponse.json(
        {
          error: "Employer verification is required to process candidate applications.",
          verification_required: true,
        },
        { status: 403 },
      );
    }

    const currentStatus = String(applicationResult.data.status || "");
    if (!transitions[currentStatus]?.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Application cannot move from ${currentStatus} to ${nextStatus || "that status"}.` },
        { status: 409 },
      );
    }

    const updateResult = await admin
      .from("job_applications")
      .update({ status: nextStatus })
      .eq("id", id)
      .eq("status", currentStatus)
      .select(
        "id,job_id,crew_profile_id,status,submitted_at,viewed_at,shortlisted_at,interview_at,offered_at,hired_at,rejected_at,updated_at",
      )
      .maybeSingle();

    if (updateResult.error) {
      return NextResponse.json(
        { error: "Application status could not be updated." },
        { status: 500 },
      );
    }
    if (!updateResult.data) {
      return NextResponse.json(
        { error: "The application status changed before this request could be completed." },
        { status: 409 },
      );
    }

    let onboardInvitation: { created: boolean; yacht_id?: string } = { created: false };
    if (nextStatus === "hired" && jobResult.data.yacht_id) {
      const onboarding = await prepareYachtOnboarding({
        admin,
        userId: employerResult.data.user_id,
        yachtId: jobResult.data.yacht_id,
        application: applicationResult.data,
        job: jobResult.data,
      });

      if (!onboarding.ok) {
        await admin
          .from("job_applications")
          .update({ status: currentStatus, hired_at: null })
          .eq("id", id)
          .eq("status", "hired");
        return NextResponse.json({ error: onboarding.error }, { status: 500 });
      }
      onboardInvitation = { created: onboarding.created, yacht_id: jobResult.data.yacht_id };
      await closeFilledJobIfNeeded(admin, jobResult.data.id);
    }

    return NextResponse.json({
      ok: true,
      application: updateResult.data,
      onboarding: onboardInvitation,
    });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid status request." }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Application status could not be updated." },
      { status: 500 },
    );
  }
}

async function prepareYachtOnboarding({
  admin,
  userId,
  yachtId,
  application,
  job,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  yachtId: string;
  application: {
    crew_profile_id: string;
    applicant_user_id: string;
    profile_snapshot: unknown;
  };
  job: {
    position: string;
    department: string;
    yacht_id: string;
  };
}): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
  const yachtResult = await admin
    .from("yachts")
    .select("id,owner_id")
    .eq("id", yachtId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (yachtResult.error || !yachtResult.data) {
    return { ok: false, error: "The hired role is not connected to a yacht owned by this account." };
  }

  const crewResult = await admin
    .from("crew_profiles")
    .select("id,email,public_crew_id")
    .eq("id", application.crew_profile_id)
    .eq("user_id", application.applicant_user_id)
    .maybeSingle();
  if (crewResult.error || !crewResult.data) {
    return { ok: false, error: "The hired candidate profile could not be resolved." };
  }

  const existingInvite = await admin
    .from("crew_invitations")
    .select("id")
    .eq("yacht_id", yachtId)
    .eq("crew_profile_id", crewResult.data.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingInvite.error) {
    return { ok: false, error: "The yacht invitation could not be checked." };
  }

  let created = false;
  if (!existingInvite.data) {
    const token = crypto.randomUUID();
    const invitationResult = await admin.from("crew_invitations").insert({
      yacht_id: yachtId,
      crew_profile_id: crewResult.data.id,
      public_crew_id: crewResult.data.public_crew_id || null,
      invited_email: crewResult.data.email || null,
      position: job.position,
      department: job.department,
      status: "pending",
      token,
      invite_link: absoluteSiteUrl(`/invitations/${token}`),
    });
    if (invitationResult.error) {
      if (invitationResult.error.code === "23505") {
        created = false;
      } else {
        return { ok: false, error: "The onboarding yacht invitation could not be created." };
      }
    } else {
      created = true;
    }
  }

  const membershipResult = await admin
    .from("yacht_crew_memberships")
    .select("id")
    .eq("yacht_id", yachtId)
    .eq("crew_profile_id", crewResult.data.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipResult.error) {
    return { ok: false, error: "The yacht membership could not be checked." };
  }

  const membershipPayload = {
    yacht_id: yachtId,
    crew_profile_id: crewResult.data.id,
    invited_email: crewResult.data.email || null,
    position: job.position,
    department: job.department,
    status: "invited",
  };
  const membershipWrite = membershipResult.data
    ? await admin
        .from("yacht_crew_memberships")
        .update(membershipPayload)
        .eq("id", membershipResult.data.id)
    : await admin.from("yacht_crew_memberships").insert(membershipPayload);
  if (membershipWrite.error) {
    if (created) {
      await admin
        .from("crew_invitations")
        .delete()
        .eq("yacht_id", yachtId)
        .eq("crew_profile_id", crewResult.data.id)
        .eq("status", "pending");
    }
    return { ok: false, error: "The candidate could not be prepared for yacht onboarding." };
  }

  return { ok: true, created };
}

async function closeFilledJobIfNeeded(
  admin: ReturnType<typeof getSupabaseAdmin>,
  jobId: string,
) {
  const [jobResult, hiredResult] = await Promise.all([
    admin
      .from("job_posts")
      .select("id,status,openings_count")
      .eq("id", jobId)
      .maybeSingle(),
    admin
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId)
      .eq("status", "hired"),
  ]);

  if (
    jobResult.error ||
    hiredResult.error ||
    !jobResult.data ||
    !["published", "paused"].includes(String(jobResult.data.status || ""))
  ) {
    return;
  }

  const openings = Math.max(1, Number(jobResult.data.openings_count) || 1);
  if ((hiredResult.count || 0) < openings) return;

  await admin
    .from("job_posts")
    .update({
      status: "filled",
      closed_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .in("status", ["published", "paused"]);
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
