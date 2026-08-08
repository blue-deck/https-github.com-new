import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateActiveBearer } from "../../../../lib/activeBearerServer";
import { privateNextResponse as NextResponse } from "../../../../lib/privateApiResponse";
import { signChecklistTaskPhotoUrls } from "../../../../lib/privateStorageUrls";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";
import { readLimitedJsonObjectDetailed } from "../../../../lib/requestBodyServer";
import {
  canInviteCrew,
  getDefaultPositionForAccountType,
  getDepartmentByPosition,
  getPosition,
  isCaptainLevel,
} from "../../../../lib/yachtOperations";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const maximumCrewUpdateRequestBytes = 8 * 1024;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const yachtId = (await context.params).id.trim().toLowerCase();
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!isUuid(yachtId)) {
    return NextResponse.json(
      { ok: false, error: "Yacht not found." },
      { status: 404 },
    );
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 500 },
    );
  }

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Login session is required." },
      { status: 401 },
    );
  }

  const authClient = createClient(
    resolveSupabaseUrl(supabaseUrl),
    supabaseAnonKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const serviceClient = createClient(
    resolveSupabaseUrl(supabaseUrl),
    supabaseServiceRoleKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const authenticated = await authenticateActiveBearer({
    token,
    authClient,
    serviceClient,
  });
  if (!authenticated.ok) {
    return NextResponse.json(
      { ok: false, error: authenticated.error },
      { status: authenticated.status },
    );
  }
  const user = authenticated.user;

  const { data: yacht, error: yachtError } = await serviceClient
    .from("yachts")
    .select("id,owner_id,name,model,flag")
    .eq("id", yachtId)
    .maybeSingle();

  if (yachtError) {
    logCrewDataError("yacht_lookup_failed", yachtError, {
      yachtId,
      actorUserId: user.id,
    });
    return NextResponse.json(
      { ok: false, error: "Yacht access could not be verified." },
      { status: 500 },
    );
  }
  if (!yacht) {
    return NextResponse.json(
      { ok: false, error: "Yacht not found." },
      { status: 404 },
    );
  }

  // Historical membership rows were client-writable and are not a trustworthy
  // source of management authority. Keep roster PII owner-only until explicit,
  // owner-approved manager grants are introduced.
  if (yacht.owner_id !== user.id) {
    return NextResponse.json(
      {
        ok: false,
        error: "Only the registered yacht owner can manage this crew roster.",
      },
      { status: 403 },
    );
  }

  let crewResponse = await serviceClient
    .from("yacht_crew_memberships")
    .select(
      `
      *,
      crew_profiles (
        id,
        user_id,
        email,
        full_name,
        public_crew_id,
        current_position,
        phone,
        nationality,
        date_of_birth,
        passport_number,
        passport_expiry,
        visa_country,
        visa_expiry,
        seaman_book_expiry,
        stcw_expiry,
        medical_expiry
      )
    `,
    )
    .eq("yacht_id", yachtId)
    .order("created_at", { ascending: false });

  if (isSchemaCacheError(crewResponse.error)) {
    crewResponse = await serviceClient
      .from("yacht_crew_memberships")
      .select(
        `
        *,
        crew_profiles (
          id,
          user_id,
          email,
          full_name,
          public_crew_id,
          current_position,
          phone,
          nationality
        )
      `,
      )
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });
  }

  if (crewResponse.error) {
    logCrewDataError("crew_roster_load_failed", crewResponse.error, {
      yachtId,
      actorUserId: user.id,
    });
    return NextResponse.json(
      { ok: false, error: "The crew roster could not be loaded." },
      { status: 500 },
    );
  }

  const isYachtOwner = yacht.owner_id === user.id;
  const operatorMembership = (crewResponse.data || []).find((member: any) => {
    return member.crew_profiles?.user_id === user.id;
  });
  const isYachtMember = Boolean(operatorMembership);

  if (!isYachtOwner && !isYachtMember) {
    return NextResponse.json(
      { ok: false, error: "You do not have access to this yacht." },
      { status: 403 },
    );
  }

  const { data: baseProfile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const accountRole = isYachtOwner
    ? "owner"
    : normalizeRole(baseProfile?.role) ||
      normalizeRole(user.user_metadata?.role);
  const elevatedRole = ["captain", "owner", "management"].includes(accountRole);
  const roleDefaultPosition = getDefaultPositionForAccountType(accountRole);
  const operatorPosition = elevatedRole
    ? roleDefaultPosition
    : operatorMembership?.position ||
      operatorMembership?.crew_profiles?.current_position ||
      roleDefaultPosition ||
      "";
  const operatorDepartment =
    operatorMembership?.department || getDepartmentByPosition(operatorPosition);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6);
  const retentionCutoff = sixMonthsAgo.toISOString();

  const [checklistResponse, excludedChecklistResponse] = await Promise.all([
    serviceClient
      .from("yacht_checklists")
      .select(
        `
        *,
        yacht_checklist_items (*)
      `,
      )
      .eq("yacht_id", yachtId)
      .or(
        `status.neq.completed,status.is.null,completed_at.is.null,completed_at.gte.${retentionCutoff}`,
      )
      .order("created_at", { ascending: false }),
    serviceClient
      .from("yacht_checklists")
      .select("id", { count: "exact", head: true })
      .eq("yacht_id", yachtId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .lt("completed_at", retentionCutoff),
  ]);
  const { data: checklists, error: checklistError } = checklistResponse;

  if (checklistError || excludedChecklistResponse.error) {
    logCrewDataError(
      "checklist_load_failed",
      checklistError || excludedChecklistResponse.error,
      {
        yachtId,
        actorUserId: user.id,
      },
    );
    return NextResponse.json(
      { ok: false, error: "Yacht checklists could not be loaded." },
      { status: 500 },
    );
  }

  const retainedChecklists = (checklists || []).filter((checklist: any) => {
    if (
      String(checklist.status || "")
        .trim()
        .toLowerCase() !== "completed"
    ) {
      return true;
    }
    if (!checklist.completed_at) return true;
    const completedAt = Date.parse(checklist.completed_at);
    return (
      Number.isFinite(completedAt) && completedAt >= sixMonthsAgo.getTime()
    );
  });
  const signedChecklists = await signChecklistTaskPhotoUrls(
    serviceClient,
    retainedChecklists,
    resolveSupabaseUrl(supabaseUrl),
  );

  const safeCrew = (crewResponse.data || []).map((membership: any) => {
    if (
      String(membership.status || "")
        .trim()
        .toLowerCase() === "active"
    ) {
      return membership;
    }

    return {
      ...membership,
      crew_profiles: null,
    };
  });

  return NextResponse.json(
    {
      ok: true,
      yacht: {
        id: yacht.id,
        name: yacht.name || "Yacht",
        model: yacht.model || "",
        flag: yacht.flag || "",
      },
      crew: safeCrew,
      checklists: signedChecklists,
      operator: {
        position: operatorPosition,
        department: operatorDepartment,
        role: accountRole,
        is_yacht_owner: isYachtOwner,
      },
      checklist_retention: {
        months: 6,
        cutoff: retentionCutoff,
        purged: excludedChecklistResponse.count || 0,
      },
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

type CrewUpdateRequest = {
  membershipId?: string;
  fullName?: string;
  position?: string;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const yachtId = (await context.params).id.trim().toLowerCase();
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!isUuid(yachtId)) {
    return NextResponse.json(
      { ok: false, error: "Yacht not found." },
      { status: 404 },
    );
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 500 },
    );
  }

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Login session is required." },
      { status: 401 },
    );
  }

  const authClient = createClient(
    resolveSupabaseUrl(supabaseUrl),
    supabaseAnonKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const serviceClient = createClient(
    resolveSupabaseUrl(supabaseUrl),
    supabaseServiceRoleKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const authenticated = await authenticateActiveBearer({
    token,
    authClient,
    serviceClient,
  });
  if (!authenticated.ok) {
    return NextResponse.json(
      { ok: false, error: authenticated.error },
      { status: authenticated.status },
    );
  }
  const user = authenticated.user;

  const parsedBody = await readLimitedJsonObjectDetailed(
    request,
    maximumCrewUpdateRequestBytes,
  );
  if (!parsedBody.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsedBody.error === "content-type"
            ? "The request must use JSON."
            : parsedBody.error === "too-large"
              ? "The crew update request is too large."
              : "Invalid crew update request.",
      },
      {
        status:
          parsedBody.error === "content-type"
            ? 415
            : parsedBody.error === "too-large"
              ? 413
              : 400,
      },
    );
  }
  const body: CrewUpdateRequest = parsedBody.value;

  const membershipId = (body.membershipId || "").trim();
  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : undefined;
  const requestedPosition =
    typeof body.position === "string" ? body.position.trim() : undefined;
  const positionDefinition = requestedPosition
    ? getPosition(requestedPosition)
    : null;

  if (!membershipId) {
    return NextResponse.json(
      { ok: false, error: "Crew membership is required." },
      { status: 400 },
    );
  }

  if (
    fullName !== undefined &&
    (fullName.length < 2 || fullName.length > 120)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Name and surname must be between 2 and 120 characters.",
      },
      { status: 400 },
    );
  }

  if (requestedPosition !== undefined && !positionDefinition) {
    return NextResponse.json(
      { ok: false, error: "Select a valid yacht position." },
      { status: 400 },
    );
  }

  if (fullName === undefined && requestedPosition === undefined) {
    return NextResponse.json(
      { ok: false, error: "No crew changes were provided." },
      { status: 400 },
    );
  }

  const [
    yachtResponse,
    baseProfileResponse,
    actorProfileResponse,
    targetMembershipResponse,
  ] = await Promise.all([
    serviceClient
      .from("yachts")
      .select("id,owner_id")
      .eq("id", yachtId)
      .maybeSingle(),
    serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
    serviceClient
      .from("crew_profiles")
      .select("id,current_position")
      .eq("user_id", user.id)
      .maybeSingle(),
    serviceClient
      .from("yacht_crew_memberships")
      .select("id,crew_profile_id,position,department,status")
      .eq("id", membershipId)
      .eq("yacht_id", yachtId)
      .maybeSingle(),
  ]);

  if (
    yachtResponse.error ||
    baseProfileResponse.error ||
    actorProfileResponse.error ||
    targetMembershipResponse.error
  ) {
    logCrewDataError(
      "crew_update_authority_lookup_failed",
      yachtResponse.error ||
        baseProfileResponse.error ||
        actorProfileResponse.error ||
        targetMembershipResponse.error,
      { yachtId, actorUserId: user.id },
    );
    return NextResponse.json(
      { ok: false, error: "Crew update access could not be verified." },
      { status: 500 },
    );
  }

  const yacht = yachtResponse.data;
  const baseProfile = baseProfileResponse.data;
  const actorProfile = actorProfileResponse.data;

  if (!yacht) {
    return NextResponse.json(
      { ok: false, error: "Yacht not found." },
      { status: 404 },
    );
  }

  if (yacht.owner_id !== user.id) {
    return NextResponse.json(
      {
        ok: false,
        error: "Only the registered yacht owner can edit this crew roster.",
      },
      { status: 403 },
    );
  }

  if (!targetMembershipResponse.data) {
    return NextResponse.json(
      { ok: false, error: "Crew member not found on this yacht." },
      { status: 404 },
    );
  }

  const resolvedActorProfile = actorProfile;

  const isYachtOwner = yacht.owner_id === user.id;
  const accountRole = isYachtOwner
    ? "owner"
    : normalizeRole(baseProfile?.role) ||
      normalizeRole(user.user_metadata?.role);
  const actorMembershipResponse = resolvedActorProfile?.id
    ? await serviceClient
        .from("yacht_crew_memberships")
        .select("position,department,status")
        .eq("yacht_id", yachtId)
        .eq("crew_profile_id", resolvedActorProfile.id)
        .maybeSingle()
    : { data: null, error: null };

  if (actorMembershipResponse.error) {
    logCrewDataError(
      "actor_membership_lookup_failed",
      actorMembershipResponse.error,
      {
        yachtId,
        actorUserId: user.id,
      },
    );
    return NextResponse.json(
      { ok: false, error: "Crew update access could not be verified." },
      { status: 500 },
    );
  }

  const actorMembership = actorMembershipResponse.data;
  const actorPosition =
    actorMembership?.position ||
    resolvedActorProfile?.current_position ||
    getDefaultPositionForAccountType(accountRole);
  const actorDepartment =
    actorMembership?.department || getDepartmentByPosition(actorPosition);
  const canManageCrew =
    isYachtOwner ||
    (actorMembership?.status === "active" &&
      isCaptainLevel(actorPosition, accountRole));

  if (!canManageCrew) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Only the yacht owner, captain or management can edit crew details.",
      },
      { status: 403 },
    );
  }

  const targetMembership = targetMembershipResponse.data;
  const canManageCurrentPosition =
    isYachtOwner ||
    canInviteCrew(
      actorPosition,
      actorDepartment,
      targetMembership.position,
      targetMembership.department,
      accountRole,
    );
  const canAssignRequestedPosition =
    !positionDefinition ||
    isYachtOwner ||
    canInviteCrew(
      actorPosition,
      actorDepartment,
      positionDefinition.title,
      positionDefinition.department,
      accountRole,
    );

  if (!canManageCurrentPosition || !canAssignRequestedPosition) {
    return NextResponse.json(
      { ok: false, error: "You cannot edit or assign this yacht position." },
      { status: 403 },
    );
  }

  if (fullName !== undefined) {
    if (
      String(targetMembership.status || "")
        .trim()
        .toLowerCase() !== "active"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A crew member must accept the invitation before their roster name can be edited.",
        },
        { status: 409 },
      );
    }

    if (!targetMembership.crew_profile_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "This invitation does not have a crew profile to rename yet.",
        },
        { status: 409 },
      );
    }

    const { data: targetProfile, error: targetProfileError } =
      await serviceClient
        .from("crew_profiles")
        .select("id,user_id")
        .eq("id", targetMembership.crew_profile_id)
        .maybeSingle();

    if (targetProfileError) {
      return NextResponse.json(
        { ok: false, error: "Crew profile ownership could not be verified." },
        { status: 500 },
      );
    }

    if (!targetProfile || targetProfile.user_id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Linked crew members control their own profile name. Update only the yacht position here.",
        },
        { status: 403 },
      );
    }

    const profileUpdate = await serviceClient
      .from("crew_profiles")
      .update({ full_name: fullName })
      .eq("id", targetMembership.crew_profile_id);

    if (profileUpdate.error) {
      logCrewDataError("crew_name_update_failed", profileUpdate.error, {
        yachtId,
        actorUserId: user.id,
      });
      return NextResponse.json(
        { ok: false, error: "The crew name could not be saved." },
        { status: 500 },
      );
    }
  }

  if (positionDefinition) {
    const membershipUpdate = await serviceClient
      .from("yacht_crew_memberships")
      .update({
        position: positionDefinition.title,
        department: positionDefinition.department,
      })
      .eq("id", membershipId)
      .eq("yacht_id", yachtId);

    if (membershipUpdate.error) {
      logCrewDataError("crew_position_update_failed", membershipUpdate.error, {
        yachtId,
        actorUserId: user.id,
      });
      return NextResponse.json(
        { ok: false, error: "The yacht position could not be saved." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    crew: {
      membership_id: membershipId,
      full_name: fullName,
      position: positionDefinition?.title,
      department: positionDefinition?.department,
    },
  });
}

function logCrewDataError(
  event: string,
  error: unknown,
  context: { yachtId: string; actorUserId: string },
) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  console.error("[yacht-crew-data]", {
    event,
    ...context,
    code: code || undefined,
  });
}

function normalizeRole(value?: unknown) {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["crew", "captain", "owner", "management"].includes(role) ? role : "";
}

function isSchemaCacheError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return (
    error.code === "PGRST204" ||
    /schema cache|column/i.test(error.message || "")
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
