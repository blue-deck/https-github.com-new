import type { JwtPayload } from "@supabase/supabase-js";

type SignupProofFlow = "implicit_or_token_hash" | "pkce";

const activeSessionMethods = new Set([
  "password",
  "totp",
  "mfa/phone",
  "mfa/webauthn",
  "token_refresh",
]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function activeBearerClaimsAreValid(
  claims: unknown,
  userId: string,
): claims is JwtPayload {
  if (!isRecord(claims)) return false;

  return (
    claims.sub === userId &&
    isCanonicalUuid(claims.session_id) &&
    hasValidActiveSessionAmr(claims.amr)
  );
}

/**
 * BlueDeck currently offers password login. A refresh or MFA claim may
 * supplement that password proof, but email-verification and recovery proofs
 * must never become ordinary application sessions.
 */
export function hasValidActiveSessionAmr(value: unknown) {
  const methods = readAmrMethods(value);
  return Boolean(
    methods &&
      methods.includes("password") &&
      methods.every((method) => activeSessionMethods.has(method)),
  );
}

/**
 * Supabase Auth emits `otp` for implicit and token-hash email verification,
 * while PKCE preserves the type-specific `email/signup` authentication
 * method. The already-verified branch selects which provenance is valid.
 */
export function hasValidSignupProofAmr(
  value: unknown,
  flow: SignupProofFlow,
) {
  const methods = readAmrMethods(value);
  if (!methods) return false;

  const allowed =
    flow === "pkce"
      ? new Set(["email/signup"])
      : new Set(["otp", "email/signup"]);
  return (
    methods.some((method) => allowed.has(method)) &&
    methods.every((method) => allowed.has(method))
  );
}

/**
 * Returns the newest proof timestamp for a recovery transaction. Supabase's
 * implicit/token-hash verification uses `otp`; PKCE uses `recovery`. The
 * caller must additionally bind this proof to BlueDeck's single-use recovery
 * capability before it can be used.
 */
export function recoveryProofAuthenticatedAt(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null;

  let authenticatedAt = -1;
  for (const entry of value) {
    if (!isRecord(entry)) return null;

    const method = normalizedMethod(entry.method);
    const timestamp = entry.timestamp;
    if (
      !method ||
      !["otp", "recovery", "token_refresh"].includes(method) ||
      typeof timestamp !== "number" ||
      !Number.isSafeInteger(timestamp) ||
      timestamp < 0
    ) {
      return null;
    }

    if (method === "otp" || method === "recovery") {
      authenticatedAt = Math.max(authenticatedAt, timestamp);
    }
  }

  return authenticatedAt >= 0 ? authenticatedAt : null;
}

function readAmrMethods(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null;

  const methods: string[] = [];
  for (const entry of value) {
    const method = normalizedMethod(
      typeof entry === "string"
        ? entry
        : isRecord(entry)
          ? entry.method
          : null,
    );
    if (!method) return null;
    methods.push(method);
  }
  return methods;
}

function normalizedMethod(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
