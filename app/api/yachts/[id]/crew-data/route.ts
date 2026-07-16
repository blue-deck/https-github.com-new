import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";
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

  const normalizedUserEmail = normalizeEmail(user.email);
  const isYachtOwner = yacht.owner_id === user.id;
  const operatorMembership = (crewResponse.data || []).find((member: any) => {
    return (
      member.crew_profiles?.user_id === user.id ||
      normalizeEmail(member.crew_profiles?.email) === normalizedUserEmail ||
      normalizeEmail(member.invited_email) === normalizedUserEmail
    );
  });
  const isYachtMember = Boolean(operatorMembership);

  if (!isYachtOwner && !isYachtMember) {
    return NextResponse.json({ ok: false, error: "You do not have access to this yacht." }, { status: 403 });
  }

  const { data: baseProfile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const accountRole = isYachtOwner
    ? "owner"
    : normalizeRole(baseProfile?.role) || normalizeRole(user.user_metadata?.role);
  const elevatedRole = ["captain", "owner", "management"].includes(accountRole);
  const roleDefaultPosition = getDefaultPositionForAccountType(accountRole);
  const operatorPosition = elevatedRole
    ? roleDefaultPosition
    : operatorMembership?.position ||
      operatorMembership?.crew_profiles?.current_position ||
      roleDefaultPosition ||
      "";
  const operatorDepartment = operatorMembership?.department || getDepartmentByPosition(operatorPosition);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const retentionCutoff = sixMonthsAgo.toISOString();
  let purgedChecklists = 0;

  const { data: staleChecklists } = await serviceClient
    .from("yacht_checklists")
    .select("id")
    .eq("yacht_id", yachtId)
    .lt("created_at", retentionCutoff);

  if (staleChecklists?.length) {
    const staleIds = staleChecklists.map((item: { id: string }) => item.id);
    await serviceClient.from("yacht_checklist_items").delete().in("checklist_id", staleIds);
    const purgeResponse = await serviceClient.from("yacht_checklists").delete().in("id", staleIds);
    if (!purgeResponse.error) purgedChecklists = staleIds.length;
  }

  const { data: checklists, error: checklistError } = await serviceClient
    .from("yacht_checklists")
    .select(`
      *,
      yacht_checklist_items (*)
    `)
    .eq("yacht_id", yachtId)
    .order("created_at", { ascending: false });

  if (checklistError) {
    return NextResponse.json({ ok: false, error: checklistError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    crew: crewResponse.data || [],
    checklists: checklists || [],
    operator: {
      position: operatorPosition,
      department: operatorDepartment,
      role: accountRole,
      is_yacht_owner: isYachtOwner,
    },
    checklist_retention: {
      months: 6,
      cutoff: retentionCutoff,
      purged: purgedChecklists,
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

  const [{ data: yacht }, { data: baseProfile }, { data: actorProfile }, targetMembershipResponse] = await Promise.all([
    serviceClient.from("yachts").select("id,owner_id").eq("id", yachtId).maybeSingle(),
    serviceClient.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    serviceClient
      .from("crew_profiles")
      .select("id,current_position")
      .eq("user_id", user.id)
      .maybeSingle(),
    serviceClient
      .from("yacht_crew_memberships")
      .select("id,crew_profile_id,position,department")
      .eq("id", membershipId)
      .eq("yacht_id", yachtId)
      .maybeSingle(),
  ]);

  if (!yacht) {
    return NextResponse.json({ ok: false, error: "Yacht not found." }, { status: 404 });
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

  let resolvedActorProfile = actorProfile;
  if (!resolvedActorProfile?.id && user.email) {
    const emailProfileResponse = await serviceClient
      .from("crew_profiles")
      .select("id,current_position")
      .ilike("email", normalizeEmail(user.email))
      .maybeSingle();

    if (emailProfileResponse.error) {
      return NextResponse.json({ ok: false, error: emailProfileResponse.error.message }, { status: 500 });
    }

    resolvedActorProfile = emailProfileResponse.data;
  }

  const isYachtOwner = yacht.owner_id === user.id;
  const accountRole = isYachtOwner
    ? "owner"
    : normalizeRole(baseProfile?.role) || normalizeRole(user.user_metadata?.role);
  let actorMembershipResponse = resolvedActorProfile?.id
    ? await serviceClient
        .from("yacht_crew_memberships")
        .select("position,department,status")
        .eq("yacht_id", yachtId)
        .eq("crew_profile_id", resolvedActorProfile.id)
        .maybeSingle()
    : { data: null, error: null };

  if (!actorMembershipResponse.data && user.email) {
    actorMembershipResponse = await serviceClient
      .from("yacht_crew_memberships")
      .select("position,department,status")
      .eq("yacht_id", yachtId)
      .ilike("invited_email", normalizeEmail(user.email))
      .maybeSingle();
  }

  if (actorMembershipResponse.error) {
    return NextResponse.json({ ok: false, error: actorMembershipResponse.error.message }, { status: 500 });
  }

  const actorMembership = actorMembershipResponse.data;
  const actorPosition =
    actorMembership?.position ||
    resolvedActorProfile?.current_position ||
    getDefaultPositionForAccountType(accountRole);
  const actorDepartment = actorMembership?.department || getDepartmentByPosition(actorPosition);
  const canManageCrew =
    isYachtOwner ||
    (actorMembership?.status === "active" && isCaptainLevel(actorPosition, accountRole));

  if (!canManageCrew) {
    return NextResponse.json(
      { ok: false, error: "Only the yacht owner, captain or management can edit crew details." },
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
    if (!targetMembership.crew_profile_id) {
      return NextResponse.json(
        { ok: false, error: "This invitation does not have a crew profile to rename yet." },
        { status: 409 },
      );
    }

    const profileUpdate = await serviceClient
      .from("crew_profiles")
      .update({ full_name: fullName })
      .eq("id", targetMembership.crew_profile_id);

    if (profileUpdate.error) {
      return NextResponse.json({ ok: false, error: profileUpdate.error.message }, { status: 500 });
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

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function normalizeRole(value?: unknown) {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["crew", "captain", "owner", "management"].includes(role) ? role : "";
}

function isSchemaCacheError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  return error.code === "PGRST204" || /schema cache|column/i.test(error.message || "");
}
