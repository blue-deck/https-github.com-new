import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";
import { getDefaultPositionForAccountType, getDepartmentByPosition } from "../../../../lib/yachtOperations";

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
        current_position,
        phone,
        nationality,
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
