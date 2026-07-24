import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RouteContext = {
  params: Promise<{ token: string }>;
};

type InvitationRow = {
  id: string;
  yachtId: string;
  crewProfileId: string;
  publicCrewId: string;
  invitedEmail: string;
  position: string;
  department: string;
  status: string;
  expiresAt: string;
  revokedAt: string;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const token = cleanInvitationToken((await context.params).token);
  if (!token) {
    return invitationResponse(
      { ok: false, error: "Invitation not found." },
      404,
    );
  }

  const serviceClient = createServiceClient();
  if (!serviceClient) {
    return invitationResponse(
      { ok: false, error: "Invitation service is unavailable." },
      503,
    );
  }

  const { data, error } = await serviceClient
    .from("crew_invitations")
    .select(
      "id,yacht_id,crew_profile_id,public_crew_id,invited_email,position,department,status,expires_at,revoked_at",
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    logInvitationError("invitation_lookup_failed", error);
    return invitationResponse(
      { ok: false, error: "Invitation could not be loaded." },
      500,
    );
  }

  const invitation = normalizeInvitation(data);
  if (!invitation) {
    return invitationResponse(
      { ok: false, error: "Invitation not found." },
      404,
    );
  }

  if (
    invitation.revokedAt ||
    !["pending", "accepted"].includes(invitation.status) ||
    (
      invitation.status === "pending" &&
      invitation.expiresAt &&
      Date.parse(invitation.expiresAt) <= Date.now()
    )
  ) {
    return invitationResponse(
      { ok: false, error: "This invitation is no longer active." },
      410,
    );
  }

  let actionRequired = false;
  if (invitation.status === "accepted") {
    actionRequired = !invitation.crewProfileId;
    if (invitation.crewProfileId) {
      const profileResponse = await serviceClient
        .from("crew_profiles")
        .select("user_id")
        .eq("id", invitation.crewProfileId)
        .maybeSingle();

      if (profileResponse.error) {
        logInvitationError(
          "accepted_invitation_profile_lookup_failed",
          profileResponse.error,
        );
        return invitationResponse(
          { ok: false, error: "Invitation could not be loaded." },
          500,
        );
      }
      actionRequired = !cleanText(profileResponse.data?.user_id);
    }
  }

  return invitationResponse({
    ok: true,
    invitation: {
      position: invitation.position || "Yacht crew",
      department: invitation.department || "Crew",
      recipientLabel:
        invitation.publicCrewId ||
        maskEmail(invitation.invitedEmail) ||
        "Invited crew member",
      status: invitation.status === "accepted" ? "accepted" : "pending",
      actionRequired,
    },
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const token = cleanInvitationToken((await context.params).token);
  if (!token) {
    return invitationResponse(
      { ok: false, error: "Invitation not found." },
      404,
    );
  }

  const clients = createAuthenticatedClients();
  if (!clients) {
    return invitationResponse(
      { ok: false, error: "Invitation service is unavailable." },
      503,
    );
  }

  const bearerToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!bearerToken) {
    return invitationResponse(
      { ok: false, error: "Login session is required." },
      401,
    );
  }

  const {
    data: { user },
    error: userError,
  } = await clients.authClient.auth.getUser(bearerToken);

  if (userError || !user) {
    return invitationResponse(
      { ok: false, error: "Login session is invalid." },
      401,
    );
  }

  const userEmail = normalizeEmail(user.email);
  if (!userEmail || !user.email_confirmed_at) {
    return invitationResponse(
      { ok: false, error: "A verified account email is required." },
      403,
    );
  }

  const { data, error } = await clients.serviceClient.rpc(
    "bluedeck_accept_crew_invitation",
    {
      p_token: token,
      p_user_id: user.id,
      p_full_name:
        cleanText(user.user_metadata?.full_name) ||
        userEmail.split("@")[0] ||
        "BlueDeck crew",
    },
  );

  if (error) {
    logInvitationError("atomic_invitation_acceptance_failed", error, {
      userId: user.id,
    });
    return invitationResponse(
      {
        ok: false,
        error:
          cleanText(error.code) === "40001"
            ? "This invitation changed while it was being accepted."
            : "Invitation could not be accepted.",
      },
      cleanText(error.code) === "40001" ? 409 : 500,
    );
  }

  const result = isRecord(data) ? data : {};
  if (result.ok === true) {
    return invitationResponse({
      ok: true,
      alreadyAccepted: result.already_accepted === true,
    });
  }

  const reason = cleanText(result.reason);
  if (reason === "not_found") {
    return invitationResponse(
      { ok: false, error: "Invitation not found." },
      404,
    );
  }
  if (reason === "forbidden" || reason === "verified_email_required") {
    return invitationResponse(
      {
        ok: false,
        error:
          reason === "verified_email_required"
            ? "A verified account email is required."
            : "This invitation belongs to another account.",
      },
      403,
    );
  }

  if (reason === "expired" || reason === "revoked") {
    return invitationResponse(
      { ok: false, error: "This invitation is no longer active." },
      410,
    );
  }

  if (reason === "issuer_inactive") {
    return invitationResponse(
      {
        ok: false,
        error:
          "The sender's verified hiring access is no longer active. Ask the yacht owner for a new invitation.",
      },
      409,
    );
  }

  return invitationResponse(
    {
      ok: false,
      error:
        reason === "membership_conflict" || reason === "already_claimed"
          ? "This invitation is already connected to another crew record."
          : "This invitation is no longer active.",
    },
    409,
  );
}

function createServiceClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(
    resolveSupabaseUrl(supabaseUrl),
    supabaseServiceRoleKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

function createAuthenticatedClients() {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) return null;
  const resolvedUrl = resolveSupabaseUrl(supabaseUrl);
  return {
    authClient: createClient(resolvedUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    serviceClient: createClient(resolvedUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

function invitationResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  const response = NextResponse.json(body, { status });
  response.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate",
  );
  return response;
}

function normalizeInvitation(value: unknown): InvitationRow | null {
  if (!isRecord(value)) return null;
  const id = cleanText(value.id);
  const yachtId = cleanText(value.yacht_id);
  if (!isUuid(id) || !isUuid(yachtId)) return null;
  return {
    id,
    yachtId,
    crewProfileId: cleanText(value.crew_profile_id),
    publicCrewId: cleanText(value.public_crew_id),
    invitedEmail: cleanText(value.invited_email),
    position: cleanText(value.position),
    department: cleanText(value.department),
    status: cleanText(value.status),
    expiresAt: cleanText(value.expires_at),
    revokedAt: cleanText(value.revoked_at),
  };
}

function cleanInvitationToken(value: unknown) {
  const token = cleanText(value);
  return isUuid(token) ? token.toLowerCase() : "";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function maskEmail(value: unknown) {
  const email = normalizeEmail(value);
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator === email.length - 1) return "";
  return `${email[0]}***${email.slice(separator)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function logInvitationError(
  event: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const errorRecord = isRecord(error) ? error : {};
  console.error("[crew-invitation]", {
    event,
    ...context,
    code: cleanText(errorRecord.code) || undefined,
    message:
      cleanText(errorRecord.message) ||
      (error instanceof Error ? error.message : "Unknown error"),
  });
}
