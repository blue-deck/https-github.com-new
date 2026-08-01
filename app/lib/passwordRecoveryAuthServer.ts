import "server-only";

import { recoveryProofAuthenticatedAt } from "./activeBearerClaims";
import { resolveSupabaseUrl } from "./supabaseConfig";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VerifiedRecoveryClaims = {
  userId: string;
  sessionId: string;
  email: string;
  recoveryAuthenticatedAt: number;
};

export function readVerifiedRecoveryClaims(
  rawClaims: unknown,
  supabaseUrl: string,
): VerifiedRecoveryClaims | null {
  if (!isRecord(rawClaims)) return null;

  const now = Math.floor(Date.now() / 1_000);
  const expectedIssuer = `${resolveSupabaseUrl(supabaseUrl)}/auth/v1`;
  const audience = rawClaims.aud;
  const audienceIsAuthenticated =
    audience === "authenticated" ||
    (Array.isArray(audience) && audience.includes("authenticated"));
  if (
    rawClaims.iss !== expectedIssuer ||
    !audienceIsAuthenticated ||
    rawClaims.role !== "authenticated" ||
    typeof rawClaims.exp !== "number" ||
    !Number.isSafeInteger(rawClaims.exp) ||
    rawClaims.exp <= now ||
    typeof rawClaims.iat !== "number" ||
    !Number.isSafeInteger(rawClaims.iat) ||
    rawClaims.iat > now + 300 ||
    rawClaims.iat > rawClaims.exp ||
    (rawClaims.nbf !== undefined &&
      (typeof rawClaims.nbf !== "number" ||
        !Number.isSafeInteger(rawClaims.nbf) ||
        rawClaims.nbf > now + 300 ||
        rawClaims.nbf > rawClaims.exp)) ||
    typeof rawClaims.sub !== "string" ||
    !uuidPattern.test(rawClaims.sub) ||
    typeof rawClaims.session_id !== "string" ||
    !uuidPattern.test(rawClaims.session_id) ||
    typeof rawClaims.email !== "string" ||
    rawClaims.email.length < 3 ||
    rawClaims.email.length > 254 ||
    !Array.isArray(rawClaims.amr)
  ) {
    return null;
  }

  const recoveryAuthenticatedAt = recoveryProofAuthenticatedAt(rawClaims.amr);
  if (
    recoveryAuthenticatedAt === null ||
    recoveryAuthenticatedAt > now + 300 ||
    now - recoveryAuthenticatedAt > 60 * 60
  ) {
    return null;
  }

  return {
    userId: rawClaims.sub,
    sessionId: rawClaims.session_id,
    email: rawClaims.email.trim().toLowerCase(),
    recoveryAuthenticatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
