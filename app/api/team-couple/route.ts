import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import {
  authenticatedEmployerClients,
  cleanText,
} from "../../lib/employerAccessServer";
import { consumeRequestRateLimit } from "../../lib/requestRateLimitServer";
import { readLimitedJsonObjectDetailed } from "../../lib/requestBodyServer";
import {
  isTeamCoupleRelationshipId,
  isTeamCoupleVersion,
  maximumTeamCoupleCrewIdLength,
  normalizeTeamCoupleCrewId,
  parseTeamCoupleDashboard,
  type TeamCoupleRemoveAction,
} from "../../lib/teamCouple";
import { getClientIp } from "../../lib/turnstileServer";

export const dynamic = "force-dynamic";

const maximumRequestBytes = 8_192;

type TeamCoupleMethod = "get" | "post" | "patch" | "delete";

type TeamCoupleErrorCode =
  | "AUTH_REQUIRED"
  | "ACCESS_REQUIRED"
  | "SERVICE_UNAVAILABLE"
  | "LOAD_FAILED"
  | "INVALID_CREW_ID"
  | "INVALID_REQUEST"
  | "CONTENT_TYPE_REQUIRED"
  | "REQUEST_TOO_LARGE"
  | "INVITE_UNAVAILABLE"
  | "RELATIONSHIP_CONFLICT"
  | "RELATIONSHIP_STALE"
  | "MEMBER_LIMIT"
  | "PENDING_INVITE_LIMIT"
  | "RATE_LIMITED"
  | "MUTATION_FAILED";

const removeActions = new Set<TeamCoupleRemoveAction>([
  "cancel",
  "decline",
  "remove",
]);

const methodLimits: Record<
  TeamCoupleMethod,
  { ip: number; user: number; windowMs: number }
> = {
  get: { ip: 180, user: 120, windowMs: 10 * 60 * 1_000 },
  post: { ip: 60, user: 20, windowMs: 10 * 60 * 1_000 },
  patch: { ip: 90, user: 45, windowMs: 10 * 60 * 1_000 },
  delete: { ip: 90, user: 45, windowMs: 10 * 60 * 1_000 },
};

export async function GET(request: NextRequest) {
  const authorized = await authorizeTeamCoupleRequest(request, "get");
  if (!authorized.ok) return authorized.response;

  const { data, error } = await authorized.serviceClient.rpc(
    "bluedeck_team_couple_dashboard",
    { p_actor_user_id: authorized.userId },
  );

  if (error) {
    logTeamCoupleError("dashboard_load_failed", error, authorized.userId);
    return teamCoupleResponse(
      {
        ok: false,
        code: "LOAD_FAILED",
        error: "Team/Couple details could not be loaded.",
      },
      rpcErrorStatus(error),
    );
  }

  const dashboard = parseTeamCoupleDashboard(data);
  if (!dashboard) {
    logTeamCoupleError(
      "invalid_dashboard_result",
      undefined,
      authorized.userId,
    );
    return teamCoupleResponse(
      {
        ok: false,
        code: "LOAD_FAILED",
        error: "Team/Couple details could not be loaded.",
      },
      500,
    );
  }

  return teamCoupleResponse({ ok: true, dashboard });
}

export async function POST(request: NextRequest) {
  const authorized = await authorizeTeamCoupleRequest(request, "post");
  if (!authorized.ok) return authorized.response;

  const parsed = await readTeamCoupleBody(request);
  if (!parsed.ok) return parsed.response;
  if (
    Object.keys(parsed.body).some((key) => key !== "crewId") ||
    typeof parsed.body.crewId !== "string" ||
    parsed.body.crewId.trim().length > maximumTeamCoupleCrewIdLength
  ) {
    return teamCoupleResponse(
      {
        ok: false,
        code: "INVALID_CREW_ID",
        error: "Enter a valid Crew ID.",
      },
      400,
    );
  }

  const crewId = normalizeTeamCoupleCrewId(parsed.body.crewId);
  if (!crewId) {
    return teamCoupleResponse(
      {
        ok: false,
        code: "INVALID_CREW_ID",
        error: "Enter a valid Crew ID.",
      },
      400,
    );
  }

  const { error } = await authorized.serviceClient.rpc(
    "bluedeck_invite_team_couple",
    {
      p_actor_user_id: authorized.userId,
      p_recipient_public_crew_id: crewId,
    },
  );
  if (error) {
    logTeamCoupleError("invitation_create_failed", error, authorized.userId);
    return mutationErrorResponse(
      error,
      "INVITE_UNAVAILABLE",
      "The Team/Couple invite could not be sent.",
    );
  }

  return teamCoupleResponse({ ok: true }, 201);
}

export async function PATCH(request: NextRequest) {
  const authorized = await authorizeTeamCoupleRequest(request, "patch");
  if (!authorized.ok) return authorized.response;

  const parsed = await readTeamCoupleBody(request);
  if (!parsed.ok) return parsed.response;
  if (
    Object.keys(parsed.body).some(
      (key) =>
        key !== "relationshipId" &&
        key !== "action" &&
        key !== "expectedVersion",
    ) ||
    !isTeamCoupleRelationshipId(parsed.body.relationshipId) ||
    parsed.body.action !== "accept" ||
    !isTeamCoupleVersion(parsed.body.expectedVersion)
  ) {
    return teamCoupleResponse(
      {
        ok: false,
        code: "INVALID_REQUEST",
        error: "The Team/Couple response is invalid.",
      },
      400,
    );
  }

  const { error } = await authorized.serviceClient.rpc(
    "bluedeck_respond_team_couple",
    {
      p_actor_user_id: authorized.userId,
      p_relationship_id: parsed.body.relationshipId.trim().toLowerCase(),
      p_expected_version: parsed.body.expectedVersion,
    },
  );
  if (error) {
    logTeamCoupleError("invitation_response_failed", error, authorized.userId);
    return mutationErrorResponse(
      error,
      "RELATIONSHIP_STALE",
      "The Team/Couple invite could not be updated.",
    );
  }

  return teamCoupleResponse({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const authorized = await authorizeTeamCoupleRequest(request, "delete");
  if (!authorized.ok) return authorized.response;

  const parsed = await readTeamCoupleBody(request);
  if (!parsed.ok) return parsed.response;
  if (
    Object.keys(parsed.body).some(
      (key) =>
        key !== "relationshipId" &&
        key !== "action" &&
        key !== "expectedVersion",
    ) ||
    !isTeamCoupleRelationshipId(parsed.body.relationshipId) ||
    typeof parsed.body.action !== "string" ||
    !removeActions.has(parsed.body.action as TeamCoupleRemoveAction) ||
    !isTeamCoupleVersion(parsed.body.expectedVersion)
  ) {
    return teamCoupleResponse(
      {
        ok: false,
        code: "INVALID_REQUEST",
        error: "The Team/Couple connection is invalid.",
      },
      400,
    );
  }

  const { error } = await authorized.serviceClient.rpc(
    "bluedeck_remove_team_couple",
    {
      p_actor_user_id: authorized.userId,
      p_relationship_id: parsed.body.relationshipId.trim().toLowerCase(),
      p_action: parsed.body.action,
      p_expected_version: parsed.body.expectedVersion,
    },
  );
  if (error) {
    logTeamCoupleError("connection_remove_failed", error, authorized.userId);
    return mutationErrorResponse(
      error,
      "RELATIONSHIP_STALE",
      "The Team/Couple connection could not be removed.",
    );
  }

  return teamCoupleResponse({ ok: true });
}

async function authorizeTeamCoupleRequest(
  request: NextRequest,
  method: TeamCoupleMethod,
): Promise<
  | { ok: true; userId: string; serviceClient: SupabaseClient }
  | { ok: false; response: Response }
> {
  const limits = methodLimits[method];
  const ipLimit = consumeRequestRateLimit(
    `team-couple:${method}:ip:${getClientIp(request) || "unknown"}`,
    limits.ip,
    limits.windowMs,
  );
  if (!ipLimit.allowed) {
    return {
      ok: false,
      response: rateLimitedResponse(ipLimit.retryAfterSeconds),
    };
  }

  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) {
    return {
      ok: false,
      response: teamCoupleResponse(
        {
          ok: false,
          code: authenticationErrorCode(clients.status),
          error: clients.error,
        },
        clients.status,
      ),
    };
  }

  const userLimit = consumeRequestRateLimit(
    `team-couple:${method}:user:${clients.user.id}`,
    limits.user,
    limits.windowMs,
  );
  if (!userLimit.allowed) {
    return {
      ok: false,
      response: rateLimitedResponse(userLimit.retryAfterSeconds),
    };
  }

  return {
    ok: true,
    userId: clients.user.id,
    serviceClient: clients.serviceClient,
  };
}

async function readTeamCoupleBody(request: NextRequest): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  const parsed = await readLimitedJsonObjectDetailed(
    request,
    maximumRequestBytes,
  );
  if (parsed.ok) return { ok: true, body: parsed.value };

  const status =
    parsed.error === "content-type"
      ? 415
      : parsed.error === "too-large"
        ? 413
        : 400;
  const error =
    parsed.error === "content-type"
      ? "The request must use JSON."
      : parsed.error === "too-large"
        ? "The Team/Couple request is too large."
        : "The Team/Couple request is invalid.";
  const code: TeamCoupleErrorCode =
    parsed.error === "content-type"
      ? "CONTENT_TYPE_REQUIRED"
      : parsed.error === "too-large"
        ? "REQUEST_TOO_LARGE"
        : "INVALID_REQUEST";
  return {
    ok: false,
    response: teamCoupleResponse({ ok: false, code, error }, status),
  };
}

function mutationErrorResponse(
  error: unknown,
  fallbackCode: TeamCoupleErrorCode,
  fallback: string,
) {
  const code = errorCode(error);
  const status = rpcErrorStatus(error);
  const detail = errorMessage(error).toLowerCase();
  const publicCode: TeamCoupleErrorCode =
    code === "23505"
      ? "RELATIONSHIP_CONFLICT"
      : code === "54000"
        ? detail.includes("pending")
          ? "PENDING_INVITE_LIMIT"
          : "MEMBER_LIMIT"
        : code === "42501" || code === "40001"
          ? fallbackCode === "INVITE_UNAVAILABLE"
            ? "INVITE_UNAVAILABLE"
            : "RELATIONSHIP_STALE"
          : code === "P0002" || code === "22023"
            ? fallbackCode
            : "MUTATION_FAILED";
  const message =
    code === "23505"
      ? "This crew member already has a Team/Couple connection or invite with you."
      : code === "54000"
        ? detail.includes("pending")
          ? "Too many Team/Couple invitations are pending."
          : "The Team/Couple member limit has been reached."
        : fallback;
  return teamCoupleResponse(
    { ok: false, code: publicCode, error: message },
    status,
  );
}

function rpcErrorStatus(error: unknown) {
  const code = errorCode(error);
  if (code === "42501") return 403;
  if (code === "P0002") return 404;
  if (["23505", "23514", "40001", "54000", "P0001"].includes(code)) {
    return 409;
  }
  if (code === "22023") return 400;
  return 500;
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || Array.isArray(error)) return "";
  return cleanText((error as Record<string, unknown>).code);
}

function errorMessage(error: unknown) {
  if (!error || typeof error !== "object" || Array.isArray(error)) return "";
  return cleanText((error as Record<string, unknown>).message);
}

function authenticationErrorCode(status: number): TeamCoupleErrorCode {
  if (status === 401) return "AUTH_REQUIRED";
  if (status === 403) return "ACCESS_REQUIRED";
  return "SERVICE_UNAVAILABLE";
}

function rateLimitedResponse(retryAfterSeconds: number) {
  return teamCoupleResponse(
    {
      ok: false,
      code: "RATE_LIMITED",
      error: "Too many Team/Couple requests.",
    },
    429,
    { "Retry-After": String(retryAfterSeconds) },
  );
}

function teamCoupleResponse(
  body: object,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", "Authorization");
  return Response.json(body, { status, headers });
}

function logTeamCoupleError(
  event: string,
  error: unknown,
  actorUserId: string,
) {
  const errorRecord =
    error && typeof error === "object" && !Array.isArray(error)
      ? (error as Record<string, unknown>)
      : {};
  console.error("[team-couple]", {
    event,
    actorUserId,
    code: cleanText(errorRecord.code) || undefined,
    message: cleanText(errorRecord.message) || undefined,
  });
}
