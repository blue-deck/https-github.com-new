import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { readVerifiedRecoveryClaims } from "../../../lib/passwordRecoveryAuthServer";
import {
  isFreshRecoveryTimestamp,
  openPasswordRecoveryPayload,
  passwordRecoveryCapabilityDigest,
  passwordRecoverySessionCookie,
  passwordRecoverySessionMaxAge,
  passwordRecoverySealedTokenMaxLength,
  type PasswordRecoverySessionPayload,
  type PasswordRecoveryTokenPayload,
} from "../../../lib/passwordRecoveryStateServer";
import { privateNextResponse as NextResponse } from "../../../lib/privateApiResponse";
import { readLimitedJsonObjectDetailed } from "../../../lib/requestBodyServer";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import { isTrustedSameOriginMutation } from "../../../lib/requestOriginServer";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import { getClientIp } from "../../../lib/turnstileServer";

const maximumResetPasswordRequestBytes = 4 * 1024;

export async function GET(request: NextRequest) {
  const ipLimit = consumeRequestRateLimit(
    `password-recovery-status:ip:${getClientIp(request) || "unknown"}`,
    30,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return resetResponse(false, 429, false);

  const recoveryContext = recoveryRequestContext(request);
  if (!recoveryContext) return resetResponse(false, 403, true);

  const { recovery, adminSupabase } = recoveryContext;
  const { data: isBound, error } = await adminSupabase.rpc(
    "bluedeck_password_recovery_ticket_is_bound",
    {
      p_ticket_digest: passwordRecoveryCapabilityDigest(recovery.ticket),
      p_user_id: recovery.userId,
      p_session_id: recovery.sessionId,
    },
  );
  const ready = isBound === true && !error;
  return resetResponse(ready, ready ? 200 : 403, !ready);
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return resetResponse(false, 403, false);
  }

  const ipLimit = consumeRequestRateLimit(
    `password-recovery-update:ip:${getClientIp(request) || "unknown"}`,
    12,
    30 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return resetResponse(false, 429, true);

  const parsedBody = await readLimitedJsonObjectDetailed(
    request,
    maximumResetPasswordRequestBytes,
  );
  if (
    !parsedBody.ok ||
    Object.keys(parsedBody.value).length !== 1 ||
    typeof parsedBody.value.password !== "string" ||
    !hasPasswordRequirements(parsedBody.value.password)
  ) {
    return resetResponse(false, 400, false);
  }

  const recoveryContext = recoveryRequestContext(request);
  if (!recoveryContext) return resetResponse(false, 403, true);
  const { recovery, adminSupabase, supabaseUrl, anonKey } = recoveryContext;

  const userLimit = consumeRequestRateLimit(
    `password-recovery-update:user:${recovery.userId}`,
    6,
    60 * 60 * 1_000,
  );
  if (!userLimit.allowed) return resetResponse(false, 429, true);

  const processingNonce = randomUUID();
  const { data: claimed, error: claimError } = await adminSupabase.rpc(
    "bluedeck_claim_password_recovery_transaction",
    {
      p_ticket_digest: passwordRecoveryCapabilityDigest(recovery.ticket),
      p_user_id: recovery.userId,
      p_session_id: recovery.sessionId,
      p_processing_nonce: processingNonce,
    },
  );
  if (
    claimError ||
    !isRecord(claimed) ||
    claimed.userId !== recovery.userId ||
    typeof claimed.tokenCiphertext !== "string"
  ) {
    return resetResponse(false, 403, true);
  }

  let outcome: "consumed" | "indeterminate" = "indeterminate";
  let accessToken = "";
  try {
    const tokenPayload = openPasswordRecoveryPayload<PasswordRecoveryTokenPayload>(
      claimed.tokenCiphertext,
      passwordRecoverySealedTokenMaxLength,
    );
    if (!isValidRecoveryToken(tokenPayload, recovery)) {
      throw new Error("Stored recovery token is invalid");
    }
    accessToken = tokenPayload.accessToken;

    const verificationClient = createClient(
      resolveSupabaseUrl(supabaseUrl),
      anonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    const { data: claimData, error: claimsError } =
      await verificationClient.auth.getClaims(accessToken);
    const claims = readVerifiedRecoveryClaims(claimData?.claims, supabaseUrl);
    if (
      claimsError ||
      !claims ||
      claims.userId !== recovery.userId ||
      claims.sessionId !== recovery.sessionId ||
      claims.recoveryAuthenticatedAt !== recovery.recoveryAuthenticatedAt
    ) {
      throw new Error("Recovery token claims changed after binding");
    }

    const { data: updated, error: updateError } =
      await adminSupabase.auth.admin.updateUserById(recovery.userId, {
        password: parsedBody.value.password,
      });
    if (updateError || updated.user?.id !== recovery.userId) {
      throw updateError || new Error("Password update did not return the user");
    }

    outcome = "consumed";
    const { error: signOutError } = await adminSupabase.auth.admin.signOut(
      accessToken,
      "global",
    );
    if (
      signOutError &&
      signOutError.status !== 401 &&
      signOutError.status !== 403
    ) {
      console.error("BlueDeck password recovery session revocation failed", {
        status: signOutError.status,
        code: signOutError.code || "signout_failed",
      });
    }
  } catch (error) {
    console.error("BlueDeck password recovery update failed after claim", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }

  const { data: finished, error: finishError } = await adminSupabase.rpc(
    "bluedeck_finish_password_recovery_transaction",
    { p_processing_nonce: processingNonce, p_outcome: outcome },
  );
  if (finishError || finished !== true) {
    console.error("BlueDeck password recovery finalization failed", {
      outcome,
      code: finishError?.code || "transaction_not_finalized",
    });
  }

  return resetResponse(
    outcome === "consumed",
    outcome === "consumed" ? 200 : 503,
    true,
  );
}

function recoveryRequestContext(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return null;

  const sealedSession =
    request.cookies.get(passwordRecoverySessionCookie)?.value || "";
  const recovery = openPasswordRecoveryPayload<PasswordRecoverySessionPayload>(
    sealedSession,
  );
  if (!isValidRecoverySession(recovery)) return null;

  return {
    recovery,
    supabaseUrl,
    anonKey,
    adminSupabase: createClient(
      resolveSupabaseUrl(supabaseUrl),
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  };
}

function isValidRecoverySession(
  value: PasswordRecoverySessionPayload | null,
): value is PasswordRecoverySessionPayload {
  return Boolean(
    value &&
      /^[A-Za-z0-9_-]{43}$/.test(value.ticket) &&
      /^[0-9a-f-]{36}$/i.test(value.userId) &&
      /^[0-9a-f-]{36}$/i.test(value.sessionId) &&
      Number.isSafeInteger(value.recoveryAuthenticatedAt) &&
      isFreshRecoveryTimestamp(
        value.recoveryAuthenticatedAt,
        passwordRecoverySessionMaxAge + 5 * 60,
      ) &&
      isFreshRecoveryTimestamp(value.issuedAt, passwordRecoverySessionMaxAge),
  );
}

function isValidRecoveryToken(
  value: PasswordRecoveryTokenPayload | null,
  recovery: PasswordRecoverySessionPayload,
): value is PasswordRecoveryTokenPayload {
  return Boolean(
    value &&
      typeof value.accessToken === "string" &&
      value.accessToken.length >= 100 &&
      value.accessToken.length <= 8_192 &&
      value.userId === recovery.userId &&
      value.sessionId === recovery.sessionId &&
      value.recoveryAuthenticatedAt === recovery.recoveryAuthenticatedAt &&
      isFreshRecoveryTimestamp(value.issuedAt, passwordRecoverySessionMaxAge),
  );
}

function hasPasswordRequirements(value: string) {
  return (
    value.length >= 8 &&
    value.length <= 128 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function resetResponse(
  ok: boolean,
  status: number,
  clearSessionCookie: boolean,
) {
  const response = NextResponse.json(
    ok
      ? { ok: true }
      : { ok: false, error: "Password could not be updated." },
    { status },
  );
  if (clearSessionCookie) {
    response.cookies.set(passwordRecoverySessionCookie, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/reset-password",
      maxAge: 0,
    });
  }
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
