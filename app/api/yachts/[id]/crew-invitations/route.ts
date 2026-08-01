import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { consumeRequestRateLimit } from "../../../../lib/requestRateLimitServer";
import { readLimitedJsonObjectDetailed } from "../../../../lib/requestBodyServer";
import { authenticateActiveBearer } from "../../../../lib/activeBearerServer";
import { absoluteSiteUrl } from "../../../../lib/site";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";
import { getPosition } from "../../../../lib/yachtOperations";

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
    return invitationResponse({ ok: false, error: "Yacht not found." }, 404);
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

  const resolvedSupabaseUrl = resolveSupabaseUrl(supabaseUrl);
  const authClient = createClient(resolvedSupabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(
    resolvedSupabaseUrl,
    supabaseServiceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const authenticated = await authenticateActiveBearer({
    token,
    authClient,
    serviceClient,
  });
  if (!authenticated.ok) {
    return invitationResponse(
      { ok: false, error: authenticated.error },
      authenticated.status,
    );
  }
  const user = authenticated.user;

  const rateLimit = consumeRequestRateLimit(
    `crew-invitation:${user.id}`,
    20,
    10 * 60 * 1_000,
  );
  if (!rateLimit.allowed) {
    return invitationResponse(
      { ok: false, error: "Too many invitation requests." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  const invitationRequest = await readInvitationRequest(request);
  if (!invitationRequest.ok) {
    return invitationResponse(
      { ok: false, error: invitationRequest.error },
      invitationRequest.status,
    );
  }

  const positionDefinition = getPosition(invitationRequest.data.position);
  if (!positionDefinition) {
    return invitationResponse(
      { ok: false, error: "Select a valid yacht position." },
      400,
    );
  }

  const invitationToken = crypto.randomUUID();
  const { data, error } = await serviceClient.rpc(
    "bluedeck_issue_crew_invitation",
    {
      p_actor_user_id: user.id,
      p_yacht_id: yachtId,
      p_crew_id: invitationRequest.data.crewId || null,
      p_invited_email: invitationRequest.data.email || null,
      p_position: positionDefinition.title,
      p_department: positionDefinition.department,
      p_token: invitationToken,
      p_invite_link: absoluteSiteUrl(`/invitations/${invitationToken}`),
    },
  );

  if (error) {
    const code = cleanText(error.code);
    logCrewInvitationError("atomic_invitation_create_failed", error, {
      actorUserId: user.id,
      yachtId,
      code,
    });
    if (code === "42501") {
      return invitationResponse(
        {
          ok: false,
          error: "Current verified yacht hiring access is required before inviting crew.",
        },
        403,
      );
    }
    if (code === "P0002") {
      return invitationResponse(
        { ok: false, error: "No active BlueDeck crew profile matches that Crew ID." },
        404,
      );
    }
    if (code === "23505") {
      return invitationResponse(
        {
          ok: false,
          error: "This crew member is already active or has a pending invitation.",
        },
        409,
      );
    }
    if (["22023", "23514", "P0001"].includes(code)) {
      return invitationResponse(
        { ok: false, error: "The crew invitation details are not currently eligible." },
        400,
      );
    }
    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }

  const invitation = parseInvitationResult(data);
  if (!invitation) {
    logCrewInvitationError("invalid_atomic_invitation_result", undefined, {
      actorUserId: user.id,
      yachtId,
    });
    return invitationResponse(
      { ok: false, error: "Crew invitation could not be created." },
      500,
    );
  }

  return invitationResponse({ ok: true, invitation });
}

async function readInvitationRequest(
  request: NextRequest,
): Promise<
  | { ok: true; data: InvitationRequest }
  | { ok: false; error: string; status: number }
> {
  const parsedBody = await readLimitedJsonObjectDetailed(
    request,
    maximumRequestBytes,
  );
  if (!parsedBody.ok) {
    return {
      ok: false,
      error:
        parsedBody.error === "content-type"
          ? "The request must use JSON."
          : parsedBody.error === "too-large"
            ? "The invitation request is too large."
            : "Invalid invitation request.",
      status:
        parsedBody.error === "content-type"
          ? 415
          : parsedBody.error === "too-large"
            ? 413
            : 400,
    };
  }
  const body = parsedBody.value;
  if (
    Object.keys(body).some(
      (key) => !["crewId", "email", "position"].includes(key),
    )
  ) {
    return { ok: false, error: "Invalid invitation request.", status: 400 };
  }

  const crewIdInput = optionalBoundedText(body.crewId, maximumCrewIdLength);
  const emailInput = optionalBoundedText(body.email, maximumEmailLength);
  const positionInput = optionalBoundedText(
    body.position,
    maximumPositionLength,
  );
  if (!crewIdInput.ok || !emailInput.ok || !positionInput.ok) {
    return { ok: false, error: "Invalid invitation request.", status: 400 };
  }

  const crewId = crewIdInput.value.toUpperCase();
  const email = normalizeEmail(emailInput.value);
  const position = positionInput.value;
  if (!crewId && !email) {
    return { ok: false, error: "Crew ID or email is required.", status: 400 };
  }
  if (crewId && !/^[A-Z0-9_-]+$/.test(crewId)) {
    return { ok: false, error: "Enter a valid Crew ID.", status: 400 };
  }
  if (email && !isValidEmail(email)) {
    return { ok: false, error: "Enter a valid crew email address.", status: 400 };
  }
  return { ok: true, data: { crewId, email, position } };
}

function parseInvitationResult(value: unknown) {
  if (!isRecord(value)) return null;
  const id = cleanText(value.id).toLowerCase();
  const crewProfileId = cleanText(value.crew_profile_id).toLowerCase();
  const position = cleanText(value.position);
  const department = cleanText(value.department);
  const expiresAt = cleanText(value.expires_at);
  if (
    !isUuid(id) ||
    !isUuid(crewProfileId) ||
    !position ||
    !department ||
    !Number.isFinite(Date.parse(expiresAt))
  ) {
    return null;
  }
  return {
    id,
    crew_profile_id: crewProfileId,
    position,
    department,
    expires_at: new Date(expiresAt).toISOString(),
  };
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
  return text.length <= maximumLength
    ? { ok: true as const, value: text }
    : { ok: false as const };
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

function invitationResponse(
  payload: Record<string, unknown>,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate",
  );
  headers.set("Vary", "Authorization");
  headers.set("X-Content-Type-Options", "nosniff");
  return NextResponse.json(payload, { status, headers });
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
