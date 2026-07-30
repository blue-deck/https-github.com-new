import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isActiveDirectoryCrew } from "../../../../lib/findCrewData";
import { saveYachtMembership } from "../../../../lib/yachtMemberships";
import { getPosition } from "../../../../lib/yachtOperations";
import { absoluteSiteUrl } from "../../../../lib/site";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const maximumRequestBytes = 8_192;
const maximumCrewIdLength = 64;
const maximumEmailLength = 254;
const maximumPositionLength = 80;

type InvitationRequest = {
  crewId: string;
  email: string;
  position: string;
};

type CrewProfileRow = {
  id: string;
  email: string;
  publicCrewId: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return await createCrewInvitation(request, context);
  } catch (error) {
    logCrewInvitationError("unhandled_invitation_error", error);
    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }
}

async function createCrewInvitation(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const yachtId = cleanText((await context.params).id).toLowerCase();
  if (!isUuid(yachtId)) {
    return invitationResponse(
      { ok: false, error: "Yacht not found." },
      404,
    );
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    logCrewInvitationError("configuration_missing");
    return invitationResponse(
      { ok: false, error: "Crew invitation service is unavailable." },
      503,
    );
  }

  const token = bearerToken(request);
  if (!token) {
    return invitationResponse(
      { ok: false, error: "Login session is required." },
      401,
    );
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
    return invitationResponse(
      { ok: false, error: "Login session is invalid." },
      401,
    );
  }

  const invitationRequest = await readInvitationRequest(request);
  if (!invitationRequest.ok) {
    return invitationResponse(
      { ok: false, error: invitationRequest.error },
      400,
    );
  }

  const { crewId, email, position: targetPosition } = invitationRequest.data;
  const positionDefinition = getPosition(targetPosition);
  if (!positionDefinition) {
    return invitationResponse(
      { ok: false, error: "Select a valid yacht position." },
      400,
    );
  }

  const yachtResponse = await serviceClient
    .from("yachts")
    .select("id,owner_id")
    .eq("id", yachtId)
    .maybeSingle();

  if (yachtResponse.error) {
    logCrewInvitationError("yacht_lookup_failed", yachtResponse.error, {
      actorUserId: user.id,
      yachtId,
    });
    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }

  if (!yachtResponse.data) {
    return invitationResponse(
      { ok: false, error: "Yacht not found." },
      404,
    );
  }

  const yacht = yachtFromRow(yachtResponse.data);
  if (!yacht) {
    logCrewInvitationError("invalid_yacht_record", undefined, {
      actorUserId: user.id,
      yachtId,
    });
    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }

  // Legacy membership rows were historically client-writable, so they cannot
  // be trusted as management authority. Only the registered yacht owner may
  // create invitations until an explicit owner-approved delegation model is
  // introduced.
  if (yacht.ownerId !== user.id) {
    return invitationResponse(
      {
        ok: false,
        error:
          "Your account is not authorised to invite this position to this yacht.",
      },
      403,
    );
  }

  const employerAccessResponse = await serviceClient
    .from("employer_access")
    .select("status,can_post_jobs")
    .eq("user_id", user.id)
    .eq("yacht_id", yachtId)
    .maybeSingle();

  if (employerAccessResponse.error) {
    logCrewInvitationError(
      "verified_hiring_access_lookup_failed",
      employerAccessResponse.error,
      { actorUserId: user.id, yachtId },
    );
    return invitationResponse(
      { ok: false, error: "Hiring access could not be verified." },
      500,
    );
  }

  if (
    employerAccessResponse.data?.status !== "verified" ||
    employerAccessResponse.data.can_post_jobs !== true
  ) {
    return invitationResponse(
      {
        ok: false,
        error:
          "Verified BlueDeck hiring access is required before inviting crew.",
      },
      403,
    );
  }

  let targetProfile: CrewProfileRow | null = null;

  if (crewId) {
    if (!(await isActiveDirectoryCrew(crewId))) {
      return invitationResponse(
        {
          ok: false,
          error: "No active BlueDeck crew profile matches that Crew ID.",
        },
        404,
      );
    }

    const { data, error } = await serviceClient
      .from("crew_profiles")
      .select("id,email,public_crew_id,current_position")
      .eq("status", "active")
      .eq("public_crew_id", crewId)
      .limit(2);

    if (error) {
      logCrewInvitationError("crew_id_profile_lookup_failed", error, {
        actorUserId: user.id,
        yachtId,
      });
      return invitationResponse(
        { ok: false, error: "Crew invitation could not be created." },
        500,
      );
    }

    if (!data || data.length !== 1) {
      return invitationResponse(
        {
          ok: false,
          error: "No BlueDeck crew profile matches that Crew ID.",
        },
        404,
      );
    }

    targetProfile = crewProfileFromRow(data[0]);
    if (!targetProfile) {
      logCrewInvitationError("invalid_target_profile_record", undefined, {
        actorUserId: user.id,
        yachtId,
      });
      return invitationResponse(
        { ok: false, error: "Crew invitation could not be created." },
        500,
      );
    }

    if (
      email &&
      targetProfile.email &&
      normalizeEmail(targetProfile.email) !== email
    ) {
      return invitationResponse(
        {
          ok: false,
          error: "The Crew ID and email do not match the same crew profile.",
        },
        400,
      );
    }
  } else if (email) {
    const { data, error } = await serviceClient
      .from("crew_profiles")
      .select("id,email,public_crew_id,current_position")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      logCrewInvitationError("email_profile_lookup_failed", error, {
        actorUserId: user.id,
        yachtId,
      });
      return invitationResponse(
        { ok: false, error: "Crew invitation could not be created." },
        500,
      );
    }

    if (data) {
      targetProfile = crewProfileFromRow(data);
      if (!targetProfile) {
        logCrewInvitationError("invalid_target_profile_record", undefined, {
          actorUserId: user.id,
          yachtId,
        });
        return invitationResponse(
          { ok: false, error: "Crew invitation could not be created." },
          500,
        );
      }
    }
  }

  if (!targetProfile && email) {
    const profilePayload = {
      email,
      full_name: email.split("@")[0],
      current_position: positionDefinition.title,
      public_crew_id: crypto.randomUUID().slice(0, 8).toUpperCase(),
    };
    const profileResponse = await insertCrewProfile(serviceClient, profilePayload);

    if (profileResponse.error) {
      logCrewInvitationError(
        "target_profile_create_failed",
        profileResponse.error,
        { actorUserId: user.id, yachtId },
      );
      return invitationResponse(
        { ok: false, error: "Crew profile could not be created." },
        500,
      );
    }

    targetProfile = crewProfileFromRow(profileResponse.data);
  }

  if (!targetProfile) {
    logCrewInvitationError("target_profile_resolution_failed", undefined, {
      actorUserId: user.id,
      yachtId,
    });
    return invitationResponse(
      { ok: false, error: "Crew profile could not be resolved." },
      500,
    );
  }

  const { data: existingInvitation, error: existingInvitationError } = await serviceClient
    .from("crew_invitations")
    .select("id")
    .eq("yacht_id", yachtId)
    .eq("crew_profile_id", targetProfile.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existingInvitationError) {
    logCrewInvitationError(
      "pending_invitation_lookup_failed",
      existingInvitationError,
      { actorUserId: user.id, yachtId },
    );
    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }

  if (idFromRow(existingInvitation)) {
    return invitationResponse(
      { ok: false, error: "A pending invitation already exists for this crew member." },
      409,
    );
  }

  const existingMembershipResponse = await serviceClient
    .from("yacht_crew_memberships")
    .select("id,status")
    .eq("yacht_id", yachtId)
    .eq("crew_profile_id", targetProfile.id)
    .maybeSingle();

  if (existingMembershipResponse.error) {
    logCrewInvitationError(
      "target_membership_lookup_failed",
      existingMembershipResponse.error,
      { actorUserId: user.id, yachtId },
    );
    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }

  if (
    isRecord(existingMembershipResponse.data) &&
    cleanText(existingMembershipResponse.data.status).toLowerCase() === "active"
  ) {
    return invitationResponse(
      { ok: false, error: "This crew member is already active on this yacht." },
      409,
    );
  }

  const invitationToken = crypto.randomUUID();
  const inviteLink = absoluteSiteUrl(`/invitations/${invitationToken}`);
  // A Crew ID never grants permission to reveal or persist the profile's
  // private email. Store an address only when the employer explicitly supplied
  // it as part of this request.
  const invitedEmail = email || null;
  const expiresAt = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1_000,
  ).toISOString();
  const invitePayload = {
    yacht_id: yachtId,
    crew_profile_id: targetProfile.id,
    invited_by: user.id,
    invited_email: invitedEmail,
    public_crew_id: targetProfile.publicCrewId || null,
    position: positionDefinition.title,
    department: positionDefinition.department,
    status: "pending",
    token: invitationToken,
    invite_link: inviteLink,
    expires_at: expiresAt,
  };
  const invitationInsertResponse = await insertCrewInvitation(
    serviceClient,
    invitePayload,
  );

  if (invitationInsertResponse.error) {
    logCrewInvitationError(
      "invitation_create_failed",
      invitationInsertResponse.error,
      { actorUserId: user.id, yachtId },
    );
    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }

  const invitationId = idFromRow(invitationInsertResponse.data);
  if (!invitationId) {
    logCrewInvitationError("invalid_created_invitation_record", undefined, {
      actorUserId: user.id,
      yachtId,
    });
    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }

  const membershipResponse = await saveYachtMembership(serviceClient, {
    yacht_id: yachtId,
    crew_profile_id: targetProfile.id,
    invited_email: invitedEmail,
    position: positionDefinition.title,
    department: positionDefinition.department,
    status: "invited",
  });

  if (membershipResponse.error) {
    logCrewInvitationError(
      "invited_membership_save_failed",
      membershipResponse.error,
      { actorUserId: user.id, yachtId, invitationId },
    );

    const cleanupResponse = await serviceClient
      .from("crew_invitations")
      .delete()
      .eq("id", invitationId)
      .eq("status", "pending");
    if (cleanupResponse.error) {
      logCrewInvitationError(
        "failed_invitation_cleanup_failed",
        cleanupResponse.error,
        { actorUserId: user.id, yachtId, invitationId },
      );
    }

    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }

  return invitationResponse({
    ok: true,
    invitation: {
      crew_profile_id: targetProfile.id,
      position: positionDefinition.title,
      department: positionDefinition.department,
      expires_at: expiresAt,
    },
  });
}

async function readInvitationRequest(
  request: NextRequest,
): Promise<
  | { ok: true; data: InvitationRequest }
  | { ok: false; error: string }
> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    return { ok: false, error: "Invalid invitation request." };
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, error: "Invalid invitation request." };
  }

  if (
    rawBody.length > maximumRequestBytes ||
    new TextEncoder().encode(rawBody).byteLength > maximumRequestBytes
  ) {
    return { ok: false, error: "Invalid invitation request." };
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: "Invalid invitation request." };
  }

  if (!isRecord(body)) {
    return { ok: false, error: "Invalid invitation request." };
  }

  const crewIdInput = optionalBoundedText(
    body.crewId,
    maximumCrewIdLength,
  );
  const emailInput = optionalBoundedText(body.email, maximumEmailLength);
  const positionInput = optionalBoundedText(
    body.position,
    maximumPositionLength,
  );

  if (!crewIdInput.ok || !emailInput.ok || !positionInput.ok) {
    return { ok: false, error: "Invalid invitation request." };
  }

  const crewId = crewIdInput.value.toUpperCase();
  const email = normalizeEmail(emailInput.value);
  const position = positionInput.value;

  if (!crewId && !email) {
    return { ok: false, error: "Crew ID or email is required." };
  }

  if (crewId && !/^[A-Z0-9_-]+$/.test(crewId)) {
    return { ok: false, error: "Enter a valid Crew ID." };
  }

  if (email && !isValidEmail(email)) {
    return { ok: false, error: "Enter a valid crew email address." };
  }

  return {
    ok: true,
    data: {
      crewId,
      email,
      position,
    },
  };
}

function yachtFromRow(value: unknown) {
  if (!isRecord(value)) return null;
  const id = cleanText(value.id).toLowerCase();
  const ownerId = cleanText(value.owner_id).toLowerCase();
  if (!isUuid(id) || (ownerId && !isUuid(ownerId))) return null;
  return { id, ownerId };
}

function crewProfileFromRow(value: unknown): CrewProfileRow | null {
  if (!isRecord(value)) return null;
  const id = cleanText(value.id).toLowerCase();
  if (!isUuid(id)) return null;

  const storedEmail = normalizeEmail(value.email);
  return {
    id,
    email: isValidEmail(storedEmail) ? storedEmail : "",
    publicCrewId: cleanText(value.public_crew_id).toUpperCase(),
  };
}

function idFromRow(value: unknown) {
  if (!isRecord(value)) return "";
  const id = cleanText(value.id).toLowerCase();
  return isUuid(id) ? id : "";
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = /^Bearer[ \t]+([^\s,]+)[ \t]*$/i.exec(authorization);
  const token = match?.[1] || "";
  return token.length <= maximumRequestBytes ? token : "";
}

function optionalBoundedText(value: unknown, maximumLength: number) {
  if (value === undefined || value === null) {
    return { ok: true as const, value: "" };
  }
  if (typeof value !== "string") return { ok: false as const };

  const text = value.trim();
  if (text.length > maximumLength) return { ok: false as const };
  return { ok: true as const, value: text };
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function isValidEmail(value: string) {
  return (
    value.length <= maximumEmailLength &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSchemaCacheError(error: unknown) {
  if (!isRecord(error)) return false;
  const message =
    `${cleanText(error.message)} ${cleanText(error.details)}`.toLowerCase();
  return (
    cleanText(error.code) === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

async function insertCrewProfile(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const variants = [payload, omitKeys(payload, ["public_crew_id"])];
  let lastResponse: {
    data: unknown;
    error: unknown;
  } = { data: null, error: new Error("Crew profile insert failed.") };

  for (const variant of variants) {
    const response = await supabase.from("crew_profiles").insert(variant).select().single();

    if (!response.error) return response;
    lastResponse = response;

    if (!isSchemaCacheError(response.error)) return response;
  }

  return lastResponse;
}

async function insertCrewInvitation(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const variants = [
    payload,
    omitKeys(payload, ["invite_link"]),
    omitKeys(payload, ["public_crew_id"]),
    omitKeys(payload, ["invite_link", "public_crew_id"]),
  ];
  let lastResponse: {
    data: unknown;
    error: unknown;
  } = { data: null, error: new Error("Crew invitation insert failed.") };

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

function invitationResponse(
  payload: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(payload, { status });
}

function logCrewInvitationError(
  event: string,
  error?: unknown,
  context: Record<string, unknown> = {},
) {
  const errorRecord = isRecord(error) ? error : {};
  console.error("[crew-invitation-create]", {
    event,
    ...context,
    code: cleanText(errorRecord.code) || undefined,
    message:
      cleanText(errorRecord.message) ||
      (error instanceof Error ? error.message : undefined),
  });
}
