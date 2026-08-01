import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { privateNextResponse as NextResponse } from "../../../lib/privateApiResponse";
import { readLimitedJsonObjectDetailed } from "../../../lib/requestBodyServer";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import { isTrustedSameOriginMutation } from "../../../lib/requestOriginServer";
import { authConfirmUrl, safeInternalPath } from "../../../lib/site";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import {
  getClientIp,
  isTurnstileConfigured,
} from "../../../lib/turnstileServer";

const maximumResendRequestBytes = 8 * 1024;
const minuteMs = 60 * 1_000;

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return resendError("invalid_request", 403);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if (!supabaseUrl || !anonKey) return resendError("service_unavailable", 503);

  const trustedClientIp = getClientIp(request);
  const clientIp = trustedClientIp || "unknown";
  const ipLimit = consumeRequestRateLimit(
    `resend-confirmation:ip:${clientIp}`,
    6,
    30 * minuteMs,
  );
  if (!ipLimit.allowed) return resendRateLimit(ipLimit.retryAfterSeconds);

  const parsed = await readLimitedJsonObjectDetailed(
    request,
    maximumResendRequestBytes,
  );
  if (
    !parsed.ok ||
    !hasOnlyResendKeys(parsed.value)
  ) {
    return resendError("invalid_request", 400);
  }

  const email = requestText(parsed.value.email).toLowerCase();
  const captchaToken = requestText(parsed.value.captchaToken);
  const nextPath = safeInternalPath(requestText(parsed.value.next));
  if (!isValidEmail(email) || email.length > 320) {
    return resendError("invalid_email", 400);
  }

  const emailLimit = consumeRequestRateLimit(
    `resend-confirmation:email:${email}`,
    3,
    60 * minuteMs,
  );
  if (!emailLimit.allowed) return resendRateLimit(emailLimit.retryAfterSeconds);

  const turnstileConfigured = isTurnstileConfigured();
  if (!turnstileConfigured && process.env.NODE_ENV === "production") {
    return resendError("service_unavailable", 503);
  }
  if (turnstileConfigured && !captchaToken) {
    return resendError("captcha_required", 400);
  }
  const supabase = createClient(resolveSupabaseUrl(supabaseUrl), anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: authConfirmUrl(nextPath),
      captchaToken,
    },
  });
  if (error) {
    if (
      error.code === "over_email_send_rate_limit" ||
      error.code === "over_request_rate_limit"
    ) {
      return resendError("rate_limited", 429);
    }
    if (error.code === "captcha_failed") {
      return resendError("captcha_failed", 400);
    }
    if (typeof error.status === "number" && error.status >= 500) {
      return resendError("service_unavailable", 503);
    }
    // Keep account existence and confirmation state private.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

function hasOnlyResendKeys(value: Record<string, unknown>) {
  const keys = Object.keys(value).sort();
  return (
    keys.length === 3 &&
    keys[0] === "captchaToken" &&
    keys[1] === "email" &&
    keys[2] === "next"
  );
}

function resendRateLimit(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: "Confirmation could not be resent.", code: "rate_limited" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

function resendError(code: string, status: number) {
  return NextResponse.json(
    { ok: false, error: "Confirmation could not be resent.", code },
    { status },
  );
}

function requestText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
