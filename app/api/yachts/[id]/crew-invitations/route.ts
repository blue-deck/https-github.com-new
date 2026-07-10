import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveYachtMembership } from "../../../../lib/yachtMemberships";
import {
  canInviteCrew,
  getDefaultPositionForAccountType,
  getDepartmentByPosition,
  getPosition,
} from "../../../../lib/yachtOperations";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type InvitationRequest = {
  crewId?: string;
  email?: string;
  position?: string;
};

export async function POST(
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

  let body: InvitationRequest;
  try {
    body = (await request.json()) as InvitationRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid invitation request." }, { status: 400 });
  }

  const crewId = (body.crewId || "").trim().toUpperCase();
  const email = normalizeEmail(body.email);
  const targetPosition = (body.position || "").trim();
  const positionDefinition = getPosition(targetPosition);

  if (!crewId && !email) {
    return NextResponse.json({ ok: false, error: "Crew ID or email is required." }, { status: 400 });
  }

  if (!positionDefinition) {
    return NextResponse.json({ ok: false, error: "Select a valid yacht position." }, { status: 400 });
  }

  if (email && !isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid crew email address." }, { status: 400 });
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

  const [{ data: yacht }, { data: baseProfile }, { data: actorProfile }] = await Promise.all([
    serviceClient.from("yachts").select("id,owner_id").eq("id", yachtId).maybeSingle(),
    serviceClient.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    serviceClient
      .from("crew_profiles")
      .select("id, current_position, email")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!yacht) {
    return NextResponse.json({ ok: false, error: "Yacht not found." }, { status: 404 });
  }

  const actorMembership = actorProfile?.id
    ? await serviceClient
        .from("yacht_crew_memberships")
        .select("position, department, status")
        .eq("yacht_id", yachtId)
        .eq("crew_profile_id", actorProfile.id)
        .maybeSingle()
    : { data: null, error: null };

  if (actorMembership.error) {
    return NextResponse.json({ ok: false, error: actorMembership.error.message }, { status: 500 });
  }

  const isYachtOwner = yacht.owner_id === user.id;
  const accountRole = isYachtOwner
    ? "owner"
    : normalizeRole(baseProfile?.role) || normalizeRole(user.user_metadata?.role);
  const elevatedRole = ["captain", "owner", "management"].includes(accountRole);
  const defaultPosition = getDefaultPositionForAccountType(accountRole);
  const actorPosition = elevatedRole
    ? defaultPosition
    : actorMembership.data?.position || actorProfile?.current_position || defaultPosition;
  const actorDepartment = actorMembership.data?.department || getDepartmentByPosition(actorPosition);

  const canInvite =
    isYachtOwner ||
    canInviteCrew(
      actorPosition,
      actorDepartment,
      positionDefinition.title,
      positionDefinition.department,
      accountRole,
    );

  if (!canInvite) {
    return NextResponse.json(
      { ok: false, error: "Your account is not authorised to invite this position to this yacht." },
      { status: 403 },
    );
  }

  let targetProfile: Record<string, any> | null = null;

  if (crewId) {
    const { data, error } = await serviceClient
      .from("crew_profiles")
      .select("id, email, public_crew_id, current_position")
      .eq("public_crew_id", crewId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ ok: false, error: "No BlueDeck crew profile matches that Crew ID." }, { status: 404 });
    }

    targetProfile = data;
  } else if (email) {
    const { data, error } = await serviceClient
      .from("crew_profiles")
      .select("id, email, public_crew_id, current_position")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    targetProfile = data;
  }

  if (!targetProfile && email) {
    const profilePayload = {
      email,
      full_name: email.split("@")[0],
      current_position: positionDefinition.title,
      public_crew_id: crypto.randomUUID().slice(0, 8).toUpperCase(),
    };
    const profileResponse = await insertCrewProfile(serviceClient, profilePayload);

    if (profileResponse.error || !profileResponse.data?.id) {
      return NextResponse.json(
        { ok: false, error: profileResponse.error?.message || "Crew profile could not be created." },
        { status: 500 },
      );
    }

    targetProfile = profileResponse.data;
  }

  if (!targetProfile?.id) {
    return NextResponse.json({ ok: false, error: "Crew profile could not be resolved." }, { status: 500 });
  }

  const { data: existingInvitation, error: existingInvitationError } = await serviceClient
    .from("crew_invitations")
    .select("id")
    .eq("yacht_id", yachtId)
    .eq("crew_profile_id", targetProfile.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInvitationError) {
    return NextResponse.json({ ok: false, error: existingInvitationError.message }, { status: 500 });
  }

  if (existingInvitation?.id) {
    return NextResponse.json(
      { ok: false, error: "A pending invitation already exists for this crew member." },
      { status: 409 },
    );
  }

  const invitationToken = crypto.randomUUID();
  const inviteLink = new URL(`/invitations/${invitationToken}`, request.nextUrl.origin).toString();
  const invitePayload = {
    yacht_id: yachtId,
    crew_profile_id: targetProfile.id,
    invited_email: email || targetProfile.email || null,
    public_crew_id: targetProfile.public_crew_id || null,
    position: positionDefinition.title,
    department: positionDefinition.department,
    status: "pending",
    token: invitationToken,
    invite_link: inviteLink,
  };
  const invitationResponse = await insertCrewInvitation(serviceClient, invitePayload);

  if (invitationResponse.error) {
    return NextResponse.json({ ok: false, error: invitationResponse.error.message }, { status: 500 });
  }

  const membershipResponse = await saveYachtMembership(serviceClient, {
    yacht_id: yachtId,
    crew_profile_id: targetProfile.id,
    invited_email: email || targetProfile.email || null,
    position: positionDefinition.title,
    department: positionDefinition.department,
    status: "invited",
  });

  if (membershipResponse.error) {
    return NextResponse.json({ ok: false, error: membershipResponse.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    invitation: {
      crew_profile_id: targetProfile.id,
      position: positionDefinition.title,
      department: positionDefinition.department,
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSchemaCacheError(error: any) {
  const message = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return error?.code === "PGRST204" || message.includes("schema cache") || message.includes("column");
}

async function insertCrewProfile(supabase: any, payload: Record<string, any>) {
  const variants = [payload, omitKeys(payload, ["public_crew_id"])];
  let lastResponse: any = null;

  for (const variant of variants) {
    const response = await supabase.from("crew_profiles").insert(variant).select().single();

    if (!response.error) return response;
    lastResponse = response;

    if (!isSchemaCacheError(response.error)) return response;
  }

  return lastResponse;
}

async function insertCrewInvitation(supabase: any, payload: Record<string, any>) {
  const variants = [
    payload,
    omitKeys(payload, ["invite_link"]),
    omitKeys(payload, ["public_crew_id"]),
    omitKeys(payload, ["invite_link", "public_crew_id"]),
  ];
  let lastResponse: any = null;

  for (const variant of variants) {
    const response = await supabase.from("crew_invitations").insert(variant).select().single();

    if (!response.error) return response;
    lastResponse = response;

    if (!isSchemaCacheError(response.error)) return response;
  }

  return lastResponse;
}

function omitKeys<T extends Record<string, unknown>>(value: T, keys: string[]) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}
