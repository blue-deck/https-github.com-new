import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  isFreshRecoveryTimestamp,
  passwordRecoveryCapabilityDigest,
  passwordRecoverySessionCookie,
  passwordRecoveryStartCookie,
  passwordRecoveryStateMaxAge,
  sealPasswordRecoveryPayload,
} from "../../../../lib/passwordRecoveryStateServer";
import { consumeRequestRateLimit } from "../../../../lib/requestRateLimitServer";
import { absoluteSiteUrl } from "../../../../lib/site";
import { resolveSupabaseUrl } from "../../../../lib/supabaseConfig";
import { getClientIp } from "../../../../lib/turnstileServer";

export async function GET(request: NextRequest) {
  const response = cleanResetRedirect();
  clearRecoveryCookies(response);
  const ipLimit = consumeRequestRateLimit(
    `password-recovery-start:ip:${getClientIp(request) || "unknown"}`,
    30,
    10 * 60 * 1_000,
  );
  if (!ipLimit.allowed) return response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const states = request.nextUrl.searchParams.getAll("state");
  const tokenHashes = request.nextUrl.searchParams.getAll("token_hash");
  const types = request.nextUrl.searchParams.getAll("type");
  const state = states.length === 1 ? states[0] : "";
  const tokenHash = tokenHashes.length === 1 ? tokenHashes[0] : "";
  const type = types.length === 1 ? types[0] : "";

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    type !== "recovery" ||
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    !/^[a-f0-9]{64}$/i.test(tokenHash)
  ) {
    return response;
  }

  const adminSupabase = createClient(
    resolveSupabaseUrl(supabaseUrl),
    serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const stateDigest = passwordRecoveryCapabilityDigest(state);
  const activation = await adminSupabase.rpc(
    "bluedeck_activate_password_recovery_transaction",
    { p_state_digest: stateDigest },
  );
  const { data: pending, error } = await adminSupabase.rpc(
    "bluedeck_password_recovery_state_is_pending",
    { p_state_digest: stateDigest },
  );
  if ((activation.error && error) || pending !== true) return response;

  const issuedAt = Math.floor(Date.now() / 1_000);
  if (!isFreshRecoveryTimestamp(issuedAt, passwordRecoveryStateMaxAge)) {
    return response;
  }
  const sealed = sealPasswordRecoveryPayload({ state, tokenHash, issuedAt });
  if (!sealed) return response;

  response.cookies.set(passwordRecoveryStartCookie, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/recovery/confirm",
    maxAge: 10 * 60,
  });
  return response;
}

function clearRecoveryCookies(response: NextResponse) {
  response.cookies.set(passwordRecoveryStartCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/recovery/confirm",
    maxAge: 0,
  });
  response.cookies.set(passwordRecoverySessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/reset-password",
    maxAge: 0,
  });
}

function cleanResetRedirect() {
  return NextResponse.redirect(absoluteSiteUrl("/reset-password"), {
    status: 303,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
