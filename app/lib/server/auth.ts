import "server-only";

import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";

export class RequestAuthError extends Error {
  readonly status: 401 | 403;

  constructor(message = "Authentication required.", status: 401 | 403 = 401) {
    super(message);
    this.name = "RequestAuthError";
    this.status = status;
  }
}

export type AuthenticatedRequest = {
  accessToken: string;
  user: User;
};

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim() || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

export async function authenticateRequest(
  request: Request,
): Promise<AuthenticatedRequest | null> {
  const accessToken = getBearerToken(request);
  if (!accessToken) return null;

  const {
    data: { user },
    error,
  } = await getSupabaseAdmin().auth.getUser(accessToken);

  if (error || !user) return null;

  return { accessToken, user };
}

export async function requireRequestUser(
  request: Request,
): Promise<AuthenticatedRequest> {
  const authenticated = await authenticateRequest(request);

  if (!authenticated) {
    throw new RequestAuthError("Login session is missing or invalid.");
  }

  return authenticated;
}

export function hasPlatformRole(
  user: User,
  allowedRoles: readonly string[],
): boolean {
  const role =
    typeof user.app_metadata?.platform_role === "string"
      ? user.app_metadata.platform_role.trim().toLowerCase()
      : "";
  const normalizedAllowedRoles = new Set(
    allowedRoles.map((item) => item.trim().toLowerCase()),
  );

  return normalizedAllowedRoles.has(role);
}

export function requirePlatformRole(
  user: User,
  allowedRoles: readonly string[],
): void {
  if (!hasPlatformRole(user, allowedRoles)) {
    throw new RequestAuthError("This account is not authorised for this action.", 403);
  }
}
