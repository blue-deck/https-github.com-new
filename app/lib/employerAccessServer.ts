import "server-only";

import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  employerAccessNoteLimit,
  isEmployerAccessStatus,
  isEmployerRole,
  isPlatformAdmin,
  type EmployerAccessEntry,
} from "./employerAccess";
import { resolveSupabaseUrl } from "./supabaseConfig";

export const employerAccessSelect =
  "id,user_id,yacht_id,requested_role,status,can_post_jobs,request_note,review_note,reviewed_by,requested_at,reviewed_at,created_at,updated_at";
export const employerAccessWithYachtSelect =
  `${employerAccessSelect},yacht:yachts(name,model)`;

export type EmployerAccessDatabaseRow = {
  id: string;
  user_id: string;
  yacht_id: string;
  requested_role: string;
  status: string;
  can_post_jobs: boolean;
  request_note: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  requested_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  yacht?: unknown;
};

type EmployerClients = {
  user: User;
  serviceClient: SupabaseClient;
};

type AdminEmployerClients = EmployerClients & {
  adminUser: User;
};

type ClientFailure = {
  error: string;
  status: number;
};

export async function authenticatedEmployerClients(
  request: NextRequest,
): Promise<EmployerClients | ClientFailure> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    logEmployerAccessError("configuration_missing");
    return {
      error: "Employer access is temporarily unavailable.",
      status: 503,
    };
  }

  const token = bearerToken(request);
  if (!token) {
    return { error: "Login session is required.", status: 401 };
  }

  const resolvedUrl = resolveSupabaseUrl(supabaseUrl);
  const authClient = createClient(resolvedUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(resolvedUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const {
      data: { user },
      error,
    } = await authClient.auth.getUser(token);

    if (error || !user) {
      return { error: "Login session is invalid.", status: 401 };
    }

    return { user, serviceClient };
  } catch (error) {
    logEmployerAccessError("authentication_failed", error);
    return {
      error: "Login session could not be verified.",
      status: 503,
    };
  }
}

export async function adminEmployerClients(
  request: NextRequest,
): Promise<AdminEmployerClients | ClientFailure> {
  const clients = await authenticatedEmployerClients(request);
  if ("error" in clients) return clients;

  try {
    const freshAdminResponse =
      await clients.serviceClient.auth.admin.getUserById(clients.user.id);
    const adminUser = freshAdminResponse.data.user;

    if (freshAdminResponse.error) {
      logEmployerAccessError(
        "administrator_lookup_failed",
        freshAdminResponse.error,
        { actorUserId: clients.user.id },
      );
      return {
        error: "Platform administrator access could not be verified.",
        status: 503,
      };
    }

    if (
      !adminUser ||
      !isPlatformAdmin(adminUser.app_metadata as Record<string, unknown>)
    ) {
      return {
        error: "Platform administrator access is required.",
        status: 403,
      };
    }

    return { ...clients, adminUser };
  } catch (error) {
    logEmployerAccessError("administrator_verification_failed", error, {
      actorUserId: clients.user.id,
    });
    return {
      error: "Platform administrator access could not be verified.",
      status: 503,
    };
  }
}

export function employerAccessEntryFromRow(
  value: unknown,
  yachtFallback?: { name?: string | null; model?: string | null },
): EmployerAccessEntry | null {
  if (!isRecord(value)) return null;

  const requestId = cleanText(value.id);
  const yachtId = cleanText(value.yacht_id);
  const role = value.requested_role;
  const status = value.status;
  const requestedAt = timestamp(value.requested_at);
  const updatedAt = timestamp(value.updated_at);

  if (
    !isUuid(requestId) ||
    !isUuid(yachtId) ||
    !isEmployerRole(role) ||
    !isEmployerAccessStatus(status) ||
    typeof value.can_post_jobs !== "boolean" ||
    value.can_post_jobs !== (status === "verified") ||
    !requestedAt ||
    !updatedAt
  ) {
    return null;
  }

  const joinedYacht = joinedYachtFrom(value.yacht);

  return {
    requestId,
    yachtId,
    yachtName:
      cleanText(joinedYacht?.name) ||
      cleanText(yachtFallback?.name) ||
      "BlueDeck yacht",
    yachtModel:
      cleanText(joinedYacht?.model) || cleanText(yachtFallback?.model),
    role,
    status,
    applicantNote: cleanText(value.request_note).slice(
      0,
      employerAccessNoteLimit,
    ),
    requestedAt,
    updatedAt,
    reviewedAt: timestamp(value.reviewed_at),
    reviewedBy: isUuid(cleanText(value.reviewed_by))
      ? cleanText(value.reviewed_by)
      : "",
    reviewNote: cleanText(value.review_note).slice(
      0,
      employerAccessNoteLimit,
    ),
  };
}

export function cleanEmployerAccessNote(value: unknown) {
  if (value === undefined || value === null) {
    return { ok: true as const, value: "" };
  }

  if (typeof value !== "string") {
    return { ok: false as const };
  }

  const note = value.trim();
  if (note.length > employerAccessNoteLimit) {
    return { ok: false as const };
  }

  return { ok: true as const, value: note };
}

export function logEmployerAccessError(
  event: string,
  error?: unknown,
  context: Record<string, string | number | boolean | null | undefined> = {},
) {
  console.error("[employer-access]", {
    event,
    ...context,
    error: safeError(error),
  });
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length > 8192) return "";

  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] || "";
}

function timestamp(value: unknown) {
  const candidate = cleanText(value);
  if (!candidate || Number.isNaN(Date.parse(candidate))) return "";
  return candidate;
}

function joinedYachtFrom(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isRecord(candidate) ? candidate : null;
}

function safeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (!isRecord(error)) return { message: String(error) };

  return {
    code: cleanText(error.code) || undefined,
    message: cleanText(error.message) || "Unknown server error",
  };
}
