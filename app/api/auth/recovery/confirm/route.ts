import { createClient } from "@supabase/supabase-js";
import {
  NextRequest,
  type NextResponse as NextServerResponse,
} from "next/server";
import { readVerifiedRecoveryClaims } from "../../../../lib/passwordRecoveryAuthServer";
import {
  createPasswordRecoveryTicket,
  isFreshRecoveryTimestamp,
  openPasswordRecoveryPayload,
  passwordRecoveryCapabilityDigest,
  passwordRecoveryEmailDigest,
  passwordRecoverySessionCookie,
  passwordRecoverySessionMaxAge,
  passwordRecoverySealedTokenMaxLength,
  passwordRecoveryStartCookie,
  passwordRecoveryStateMaxAge,
  sealPasswordRecoveryPayload,
  type PasswordRecoveryStartPayload,
} from "../../../../lib/passwordRecoveryStateServer";
import { privateNextResponse as NextResponse } from "../../../../lib/privateApiResponse";
import { readLimitedJsonObjectDetailed } from "../../../../lib/requestBodyServer";
import { consumeRequestRateLimit } from "../../../../lib/requestRateLimitServer";
import { isTrustedSameOriginMutation } from "../../../../lib/requestOriginServer";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";
import { getClientIp } from "../../../../lib/turnstileServer";

const maximumRecoveryConfirmationBytes = 12 * 1024;

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return recoveryResponse(false, 403);
  }

  const response = recoveryResponse(false, 403);
  clearStartCookie(response);

  const ipLimit = consumeRequestRateLimit(
    `password-recovery-confirm:ip:${getClientIp(request) || "unknown"}`,
    20,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return recoveryResponse(false, 503);
  }

  const proof = await recoveryProof(request);
  if (!proof) return response;

  const resolvedUrl = resolveSupabaseUrl(supabaseUrl);
  const adminSupabase = createClient(resolvedUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const recoveryClient = createClient(resolvedUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  let accessToken = proof.accessToken;
  let verifiedUserId = "";
  if (proof.tokenHash) {
    const { data, error: verificationError } =
      await recoveryClient.auth.verifyOtp({
        token_hash: proof.tokenHash,
        type: "recovery",
      });
    accessToken = data.session?.access_token || "";
    verifiedUserId = data.user?.id || "";
    if (verificationError || !accessToken || !verifiedUserId) return response;
  }

  const { data: claimData, error: claimsError } =
    await recoveryClient.auth.getClaims(accessToken);
  const claims = readVerifiedRecoveryClaims(claimData?.claims, supabaseUrl);
  if (
    claimsError ||
    !claims ||
    (verifiedUserId && claims.userId !== verifiedUserId)
  ) {
    await adminSupabase.auth.admin.signOut(accessToken, "local");
    return response;
  }

  const emailDigest = passwordRecoveryEmailDigest(claims.email);
  const recoveryTicket = createPasswordRecoveryTicket(
    proof.state,
    claims.userId,
    claims.sessionId,
  );
  if (!emailDigest || !recoveryTicket) {
    await adminSupabase.auth.admin.signOut(accessToken, "local");
    return recoveryResponse(false, 503);
  }
  const { ticket, ticketDigest } = recoveryTicket;

  let activation = await adminSupabase.rpc(
    "bluedeck_activate_password_recovery_transaction",
    {
      p_state_digest: passwordRecoveryCapabilityDigest(proof.state),
      p_email_digest: emailDigest,
    },
  );
  if (activation.error) {
    activation = await adminSupabase.rpc(
      "bluedeck_activate_password_recovery_transaction",
      {
        p_state_digest: passwordRecoveryCapabilityDigest(proof.state),
        p_email_digest: emailDigest,
      },
    );
  }

  let alreadyBound = false;
  if (activation.error || activation.data !== true) {
    let boundStatus = await adminSupabase.rpc(
      "bluedeck_password_recovery_ticket_is_bound",
      {
        p_ticket_digest: ticketDigest,
        p_user_id: claims.userId,
        p_session_id: claims.sessionId,
      },
    );
    if (boundStatus.error) {
      boundStatus = await adminSupabase.rpc(
        "bluedeck_password_recovery_ticket_is_bound",
        {
          p_ticket_digest: ticketDigest,
          p_user_id: claims.userId,
          p_session_id: claims.sessionId,
        },
      );
    }
    alreadyBound = !boundStatus.error && boundStatus.data === true;
    if (!alreadyBound) {
      if (activation.error || boundStatus.error) {
        return recoveryResponse(false, 503);
      }
      await adminSupabase.auth.admin.signOut(accessToken, "local");
      return response;
    }
  }

  const issuedAt = Math.floor(Date.now() / 1_000);
  if (!alreadyBound) {
    const sealedRecoveryToken = sealPasswordRecoveryPayload({
      accessToken,
      userId: claims.userId,
      sessionId: claims.sessionId,
      recoveryAuthenticatedAt: claims.recoveryAuthenticatedAt,
      issuedAt,
    });
    if (
      sealedRecoveryToken.length < 100 ||
      sealedRecoveryToken.length > passwordRecoverySealedTokenMaxLength
    ) {
      await adminSupabase.auth.admin.signOut(accessToken, "local");
      return recoveryResponse(false, 503);
    }
    const { data: bound, error: bindError } = await adminSupabase.rpc(
      "bluedeck_bind_password_recovery_transaction",
      {
        p_state_digest: passwordRecoveryCapabilityDigest(proof.state),
        p_email_digest: emailDigest,
        p_user_id: claims.userId,
        p_session_id: claims.sessionId,
        p_recovery_authenticated_at: new Date(
          claims.recoveryAuthenticatedAt * 1_000,
        ).toISOString(),
        p_ticket_digest: ticketDigest,
        p_recovery_token_ciphertext: sealedRecoveryToken,
      },
    );
    let bindSucceeded = !bindError && bound === true;

    // If the RPC committed but its response was lost, the same opaque ticket
    // proves the transaction is already bound and every concurrent retry
    // converges on that same deterministic capability.
    let statusError = bindError;
    if (!bindSucceeded) {
      let status = await adminSupabase.rpc(
        "bluedeck_password_recovery_ticket_is_bound",
        {
          p_ticket_digest: ticketDigest,
          p_user_id: claims.userId,
          p_session_id: claims.sessionId,
        },
      );
      if (status.error) {
        status = await adminSupabase.rpc(
          "bluedeck_password_recovery_ticket_is_bound",
          {
            p_ticket_digest: ticketDigest,
            p_user_id: claims.userId,
            p_session_id: claims.sessionId,
          },
        );
      }
      bindSucceeded = !status.error && status.data === true;
      statusError = status.error || bindError;
    }
    if (!bindSucceeded) {
      if (statusError) return recoveryResponse(false, 503);
      await adminSupabase.auth.admin.signOut(accessToken, "local");
      return response;
    }
  }

  const sealedSession = sealPasswordRecoveryPayload({
    ticket,
    userId: claims.userId,
    sessionId: claims.sessionId,
    recoveryAuthenticatedAt: claims.recoveryAuthenticatedAt,
    issuedAt,
  });
  if (!sealedSession || sealedSession.length > 3_500) {
    await adminSupabase.auth.admin.signOut(accessToken, "local");
    return recoveryResponse(false, 503);
  }

  const success = recoveryResponse(true, 200);
  clearStartCookie(success);
  success.cookies.set(passwordRecoverySessionCookie, sealedSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/reset-password",
    maxAge: passwordRecoverySessionMaxAge,
  });
  return success;
}

function isValidStartPayload(
  value: PasswordRecoveryStartPayload | null,
): value is PasswordRecoveryStartPayload {
  return Boolean(
    value &&
    /^[A-Za-z0-9_-]{43}$/.test(value.state) &&
    /^[a-f0-9]{64}$/i.test(value.tokenHash) &&
    isFreshRecoveryTimestamp(value.issuedAt, passwordRecoveryStateMaxAge),
  );
}

type RecoveryProof = {
  state: string;
  tokenHash: string;
  accessToken: string;
};

async function recoveryProof(request: NextRequest): Promise<RecoveryProof | null> {
  const mediaType = (request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (mediaType === "application/json") {
    const parsed = await readLimitedJsonObjectDetailed(
      request,
      maximumRecoveryConfirmationBytes,
    );
    if (!parsed.ok || !hasOnlyRecoveryProofKeys(parsed.value)) return null;

    const state = requestText(parsed.value.state);
    const type = requestText(parsed.value.type);
    const tokenHash = requestText(parsed.value.tokenHash);
    const accessToken = requestText(parsed.value.accessToken);
    const hasOneProof = Boolean(tokenHash) !== Boolean(accessToken);
    if (
      type !== "recovery" ||
      !/^[A-Za-z0-9_-]{43}$/.test(state) ||
      !hasOneProof ||
      (tokenHash && !/^[a-f0-9]{64}$/i.test(tokenHash)) ||
      (accessToken && (accessToken.length < 100 || accessToken.length > 8_192))
    ) {
      return null;
    }

    return { state, tokenHash, accessToken };
  }

  // Backward compatibility for recovery links issued before the default
  // hosted Supabase template fallback was introduced.
  const sealedStart =
    request.cookies.get(passwordRecoveryStartCookie)?.value || "";
  const start =
    openPasswordRecoveryPayload<PasswordRecoveryStartPayload>(sealedStart);
  return isValidStartPayload(start)
    ? { state: start.state, tokenHash: start.tokenHash, accessToken: "" }
    : null;
}

function hasOnlyRecoveryProofKeys(value: Record<string, unknown>) {
  const keys = Object.keys(value).sort();
  const tokenHashKeys = ["state", "tokenHash", "type"];
  const accessTokenKeys = ["accessToken", "state", "type"];
  return (
    keys.length === 3 &&
    (keys.every((key, index) => key === tokenHashKeys[index]) ||
      keys.every((key, index) => key === accessTokenKeys[index]))
  );
}

function requestText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clearStartCookie(response: NextServerResponse) {
  response.cookies.set(passwordRecoveryStartCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/recovery/confirm",
    maxAge: 0,
  });
}

function recoveryResponse(ok: boolean, status: number) {
  return NextResponse.json(
    ok
      ? { ok: true }
      : { ok: false, error: "Password recovery could not be verified." },
    { status },
  );
}
