import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { absoluteSiteUrl } from "../../../lib/site";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import { readLimitedJsonObject } from "../../../lib/requestBodyServer";
import { isTrustedSameOriginMutation } from "../../../lib/requestOriginServer";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import { createPasswordRecoveryState } from "../../../lib/passwordRecoveryStateServer";
import {
  getClientIp,
  isTurnstileConfigured,
} from "../../../lib/turnstileServer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const minuteMs = 60 * 1_000;
const maximumForgotPasswordRequestBytes = 8 * 1024;

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return forgotPasswordError("invalid_request", 403);
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return forgotPasswordError("service_unavailable", 503);
  }

  const turnstileConfigured = isTurnstileConfigured();
  const trustedClientIp = getClientIp(request);
  const clientIp = trustedClientIp || "unknown";
  const rateLimitMode = turnstileConfigured ? "verified" : "fallback";
  const ipLimit = consumeRequestRateLimit(
    "forgot-password:" + rateLimitMode + ":ip:" + clientIp,
    turnstileConfigured ? 8 : 4,
    (turnstileConfigured ? 10 : 30) * minuteMs,
  );
  if (!ipLimit.allowed) {
    return forgotPasswordRateLimitResponse(ipLimit.retryAfterSeconds);
  }

  const rawBody = await readLimitedJsonObject(
    request,
    maximumForgotPasswordRequestBytes,
  );
  if (!rawBody) {
    return forgotPasswordError("invalid_request", 400);
  }
  if (!hasOnlyForgotPasswordRequestKeys(rawBody)) {
    return forgotPasswordError("invalid_request", 400);
  }
  const body = rawBody as ForgotPasswordRequestBody;

  const email = requestText(body.email).toLowerCase();
  const captchaToken = requestText(body.captchaToken);
  const website = requestText(body.website);

  if (website) {
    return NextResponse.json({ ok: true });
  }

  if (!isValidEmail(email)) {
    return forgotPasswordError("invalid_email", 400);
  }

  const emailLimit = consumeRequestRateLimit(
    "forgot-password:" + rateLimitMode + ":email:" + email,
    turnstileConfigured ? 5 : 3,
    (turnstileConfigured ? 30 : 60) * minuteMs,
  );
  if (!emailLimit.allowed) {
    return forgotPasswordRateLimitResponse(emailLimit.retryAfterSeconds);
  }

  if (!turnstileConfigured && process.env.NODE_ENV === "production") {
    return forgotPasswordError("service_unavailable", 503);
  }
  if (turnstileConfigured && !captchaToken) {
    return forgotPasswordError("captcha_required", 400);
  }
  const resolvedSupabaseUrl = resolveSupabaseUrl(supabaseUrl);
  const supabase = createClient(resolvedSupabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const recovery = createPasswordRecoveryState(email);
  if (!recovery) {
    return forgotPasswordError("service_unavailable", 503);
  }

  const adminSupabase = createClient(
    resolvedSupabaseUrl,
    supabaseServiceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: issued, error: issueError } = await adminSupabase.rpc(
    "bluedeck_issue_password_recovery_transaction",
    {
      p_state_digest: recovery.stateDigest,
      p_email_digest: recovery.emailDigest,
      p_expires_at: recovery.expiresAt,
    },
  );
  if (issueError || issued !== true) {
    console.error("BlueDeck password recovery transaction issue failed", {
      code: issueError?.code || "transaction_not_issued",
    });
    return forgotPasswordError("service_unavailable", 503);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteSiteUrl(
      `/reset-password?state=${encodeURIComponent(recovery.state)}`,
    ),
    captchaToken,
  });

  if (error) {
    console.error("BlueDeck password reset request failed", error.message);
    // A 4xx response definitively rejects the request. Network and 5xx
    // responses are ambiguous: the provider may already have sent the email,
    // so keep the issuing transaction for link-possession activation.
    if (
      typeof error.status === "number" &&
      error.status >= 400 &&
      error.status < 500
    ) {
      await adminSupabase.rpc("bluedeck_cancel_password_recovery_transaction", {
        p_state_digest: recovery.stateDigest,
        p_email_digest: recovery.emailDigest,
      });
    }
    if (error.code === "captcha_failed") {
      return forgotPasswordError("captcha_failed", 400);
    }
    if (typeof error.status === "number" && error.status >= 500) {
      return forgotPasswordError("service_unavailable", 503);
    }
    return NextResponse.json({ ok: true });
  }

  let activation = await adminSupabase.rpc(
    "bluedeck_activate_password_recovery_transaction",
    {
      p_state_digest: recovery.stateDigest,
      p_email_digest: recovery.emailDigest,
    },
  );
  let activationSucceeded = !activation.error && activation.data === true;
  if (!activationSucceeded) {
    // The RPC is idempotent, so one retry safely covers an ambiguous network
    // outcome without ever invalidating the previously working email link.
    activation = await adminSupabase.rpc(
      "bluedeck_activate_password_recovery_transaction",
      {
        p_state_digest: recovery.stateDigest,
        p_email_digest: recovery.emailDigest,
      },
    );
    activationSucceeded = !activation.error && activation.data === true;
  }
  if (!activationSucceeded) {
    const { data: pending, error: pendingError } = await adminSupabase.rpc(
      "bluedeck_password_recovery_state_is_pending",
      { p_state_digest: recovery.stateDigest },
    );
    if (!pendingError && pending === true) {
      activationSucceeded = true;
    }
  }
  if (!activationSucceeded) {
    console.error("BlueDeck password recovery activation failed", {
      code: activation.error?.code || "transaction_not_activated",
    });
    // Do not invalidate a possibly delivered email after an ambiguous database
    // response. The callback can idempotently activate this exact state.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

type ForgotPasswordRequestBody = {
  email?: string;
  captchaToken?: string;
  website?: string;
};

function hasOnlyForgotPasswordRequestKeys(value: Record<string, unknown>) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === 3 &&
    keys[0] === "captchaToken" &&
    keys[1] === "email" &&
    keys[2] === "website"
  );
}

function requestText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function forgotPasswordRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Password reset could not be requested.", code: "rate_limited" },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

function forgotPasswordError(code: string, status: number) {
  return NextResponse.json(
    { error: "Password reset could not be requested.", code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
