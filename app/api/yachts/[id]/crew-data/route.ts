import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";
import {
  canInviteCrew,
  getDepartmentByPosition,
  getPosition,
  isCaptainLevel,
} from "../../../../lib/yachtOperations";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: yachtId } = await context.params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ ok: false, error: "Login session is required." }, { status: 401 });
  }

  const authClient = createClient(resolveSupabaseUrl(supabaseUrl), supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(resolveSupabaseUrl(supabaseUrl), supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Login session is invalid." }, { status: 401 });
  }

  const { data: yacht } = await serviceClient
    .from("yachts")
    .select("id,owner_id")
    .eq("id", yachtId)
    .maybeSingle();

  if (!yacht) {
    return NextResponse.json({ ok: false, error: "Yacht not found." }, { status: 404 });
  }

  let crewResponse = await serviceClient
    .from("yacht_crew_memberships")
    .select(`
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
        stcw_expiry,
        medical_expiry
      )
    `)
    .eq("yacht_id", yachtId)
    .order("created_at", { ascending: false });

  if (isSchemaCacheError(crewResponse.error)) {
    crewResponse = await serviceClient
      .from("yacht_crew_memberships")
      .select(`
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
      `)
      .eq("yacht_id", yachtId)
      .order("created_at", { ascending: false });
  }

  if (crewResponse.error) {
    return NextResponse.json({ ok: false, error: crewResponse.error.message }, { status: 500 });
  }

  const isYachtOwner = yacht.owner_id === user.id;
  const crewMemberships = crewResponse.data || [];
  const operatorMembership = crewMemberships.find((member: any) =>
    isMembershipLinkedToUser(member, user.id),
  );
  const isYachtMember =
    Boolean(operatorMembership) &&
    String(operatorMembership?.status || "").trim().toLowerCase() === "active";

  if (!isYachtOwner && !isYachtMember) {
    return NextResponse.json({ ok: false, error: "You do not have access to this yacht." }, { status: 403 });
  }

  const accountRole = isYachtOwner ? "owner" : "crew";
  const operatorPosition = isYachtOwner ? "Owner" : operatorMembership?.position || "";
  const operatorDepartment = operatorMembership?.department || getDepartmentByPosition(operatorPosition);
  const canManageCrew =
    isYachtOwner || (isYachtMember && isCaptainLevel(operatorPosition, "crew"));
  const operatorCrewProfile = getJoinedCrewProfile(operatorMembership);
  const operatorCrewProfileId =
    operatorMembership?.crew_profile_id || operatorCrewProfile?.id || "";

  let checklistQuery = serviceClient
    .from("yacht_checklists")
    .select(`
      *,
      yacht_checklist_items (*)
    `)
    .eq("yacht_id", yachtId);

  if (!canManageCrew) {
    if (!operatorCrewProfileId) {
      return NextResponse.json(
        { ok: false, error: "Your active crew profile could not be resolved." },
        { status: 403 },
      );
    }
    checklistQuery = checklistQuery.eq("assigned_to", operatorCrewProfileId);
  }

  const { data: checklists, error: checklistError } = await checklistQuery.order(
    "created_at",
    { ascending: false },
  );

  if (checklistError) {
    return NextResponse.json({ ok: false, error: checklistError.message }, { status: 500 });
  }

  const visibleCrew = crewMemberships.map((member: any) =>
    toVisibleCrewMember(member, {
      canManageCrew,
      userId: user.id,
    }),
  );

  return NextResponse.json({
    ok: true,
    crew: visibleCrew,
    checklists: checklists || [],
    operator: {
      position: operatorPosition,
      department: operatorDepartment,
      role: accountRole,
      is_yacht_owner: isYachtOwner,
    },
    checklist_retention: {
      months: 6,
      purged: 0,
    },
  });
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
  const { id: yachtId } = await context.params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ ok: false, error: "Login session is required." }, { status: 401 });
  }

  let body: CrewUpdateRequest;
  try {
    body = (await request.json()) as CrewUpdateRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid crew update request." }, { status: 400 });
  }

  const membershipId = (body.membershipId || "").trim();
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : undefined;
  const requestedPosition = typeof body.position === "string" ? body.position.trim() : undefined;
  const positionDefinition = requestedPosition ? getPosition(requestedPosition) : null;

  if (!membershipId) {
    return NextResponse.json({ ok: false, error: "Crew membership is required." }, { status: 400 });
  }

  if (fullName !== undefined && (fullName.length < 2 || fullName.length > 120)) {
    return NextResponse.json(
      { ok: false, error: "Name and surname must be between 2 and 120 characters." },
      { status: 400 },
    );
  }

  if (requestedPosition !== undefined && !positionDefinition) {
    return NextResponse.json({ ok: false, error: "Select a valid yacht position." }, { status: 400 });
  }

  if (fullName === undefined && requestedPosition === undefined) {
    return NextResponse.json({ ok: false, error: "No crew changes were provided." }, { status: 400 });
  }

  const authClient = createClient(resolveSupabaseUrl(supabaseUrl), supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(resolveSupabaseUrl(supabaseUrl), supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Login session is invalid." }, { status: 401 });
  }

  const [{ data: yacht }, actorProfileResponse, targetMembershipResponse] =
    await Promise.all([
      serviceClient.from("yachts").select("id,owner_id").eq("id", yachtId).maybeSingle(),
      serviceClient
        .from("crew_profiles")
        .select("id,user_id,current_position,email")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
      serviceClient
        .from("yacht_crew_memberships")
        .select("id,crew_profile_id,position,department")
        .eq("id", membershipId)
        .eq("yacht_id", yachtId)
        .limit(1)
        .maybeSingle(),
    ]);

  if (!yacht) {
    return NextResponse.json({ ok: false, error: "Yacht not found." }, { status: 404 });
  }

  if (actorProfileResponse.error) {
    return NextResponse.json(
      { ok: false, error: actorProfileResponse.error.message },
      { status: 500 },
    );
  }

  if (targetMembershipResponse.error) {
    return NextResponse.json(
      { ok: false, error: targetMembershipResponse.error.message },
      { status: 500 },
    );
  }

  if (!targetMembershipResponse.data) {
    return NextResponse.json({ ok: false, error: "Crew member not found on this yacht." }, { status: 404 });
  }

  const resolvedActorProfile = actorProfileResponse.data;

  const isYachtOwner = yacht.owner_id === user.id;
  const accountRole = isYachtOwner ? "owner" : "crew";
  const actorMembershipResponse = resolvedActorProfile?.id
    ? await serviceClient
        .from("yacht_crew_memberships")
        .select("position,department,status,crew_profile_id")
        .eq("yacht_id", yachtId)
        .eq("crew_profile_id", resolvedActorProfile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };

  if (actorMembershipResponse.error) {
    return NextResponse.json({ ok: false, error: actorMembershipResponse.error.message }, { status: 500 });
  }

  const actorMembership = actorMembershipResponse.data;
  const actorPosition = isYachtOwner ? "Owner" : actorMembership?.position || "";
  const actorDepartment = actorMembership?.department || getDepartmentByPosition(actorPosition);
  const canManageCrew =
    isYachtOwner ||
    (String(actorMembership?.status || "").trim().toLowerCase() === "active" &&
      isCaptainLevel(actorPosition, "crew"));

  if (!canManageCrew) {
    return NextResponse.json(
      { ok: false, error: "Only the yacht owner, captain or management can edit crew details." },
      { status: 403 },
    );
  }

  const targetMembership = targetMembershipResponse.data;
  const protectedPosition = (value?: string | null) =>
    ["owner", "yacht manager"].includes((value || "").trim().toLowerCase());
  if (
    !isYachtOwner &&
    (
      protectedPosition(targetMembership.position) ||
      protectedPosition(positionDefinition?.title)
    )
  ) {
    return NextResponse.json(
      { ok: false, error: "Only the yacht owner can edit or assign this position." },
      { status: 403 },
    );
  }

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
    if (!targetMembership.crew_profile_id) {
      return NextResponse.json(
        { ok: false, error: "This invitation does not have a crew profile to rename yet." },
        { status: 409 },
      );
    }

    const targetProfileResult = await serviceClient
      .from("crew_profiles")
      .select("id,user_id")
      .eq("id", targetMembership.crew_profile_id)
      .maybeSingle();
    if (targetProfileResult.error) {
      return NextResponse.json(
        { ok: false, error: targetProfileResult.error.message },
        { status: 500 },
      );
    }
    if (!targetProfileResult.data) {
      return NextResponse.json(
        { ok: false, error: "This crew profile could not be resolved." },
        { status: 404 },
      );
    }
    if (targetProfileResult.data.user_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Claimed crew identities can only be edited by their profile owner.",
        },
        { status: 403 },
      );
    }

    const profileUpdate = await serviceClient
      .from("crew_profiles")
      .update({ full_name: fullName })
      .eq("id", targetMembership.crew_profile_id)
      .is("user_id", null)
      .select("id")
      .maybeSingle();

    if (profileUpdate.error || !profileUpdate.data) {
      return NextResponse.json(
        {
          ok: false,
          error:
            profileUpdate.error?.message ||
            "This crew identity changed before the update could be completed.",
        },
        { status: profileUpdate.error ? 500 : 409 },
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
      return NextResponse.json({ ok: false, error: membershipUpdate.error.message }, { status: 500 });
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

function toVisibleCrewMember(
  member: any,
  context: {
    canManageCrew: boolean;
    userId: string;
  },
) {
  const profile = getJoinedCrewProfile(member);
  const isSelf = isMembershipLinkedToUser(member, context.userId);
  const canSeePrivateFields = context.canManageCrew || isSelf;

  return {
    id: member?.id,
    yacht_id: member?.yacht_id,
    crew_profile_id: member?.crew_profile_id,
    position: member?.position,
    department: member?.department,
    status: member?.status,
    created_at: member?.created_at,
    invited_email: canSeePrivateFields ? member?.invited_email || null : null,
    crew_profiles: profile
      ? {
          id: profile.id,
          user_id: isSelf ? profile.user_id || null : null,
          full_name: profile.full_name || null,
          public_crew_id: profile.public_crew_id || null,
          current_position: profile.current_position || null,
          email: canSeePrivateFields ? profile.email || null : null,
          phone: canSeePrivateFields ? profile.phone || null : null,
          nationality: canSeePrivateFields ? profile.nationality || null : null,
          date_of_birth: canSeePrivateFields ? profile.date_of_birth || null : null,
          passport_number: canSeePrivateFields ? profile.passport_number || null : null,
          passport_expiry: canSeePrivateFields ? profile.passport_expiry || null : null,
          stcw_expiry: canSeePrivateFields ? profile.stcw_expiry || null : null,
          medical_expiry: canSeePrivateFields ? profile.medical_expiry || null : null,
        }
      : null,
  };
}

function getJoinedCrewProfile(member: any) {
  const profile = member?.crew_profiles;
  if (Array.isArray(profile)) return profile[0] || null;
  return profile || null;
}

function isMembershipLinkedToUser(member: any, userId: string) {
  const profile = getJoinedCrewProfile(member);
  return Boolean(userId && profile?.user_id === userId);
}

function isSchemaCacheError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST204" || /schema cache|column/i.test(error.message || "");
}
