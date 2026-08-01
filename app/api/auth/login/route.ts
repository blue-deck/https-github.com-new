import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { privateNextResponse as NextResponse } from "../../../lib/privateApiResponse";
import { readLimitedJsonObjectDetailed } from "../../../lib/requestBodyServer";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import { isTrustedSameOriginMutation } from "../../../lib/requestOriginServer";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import {
  getClientIp,
  isTurnstileConfigured,
} from "../../../lib/turnstileServer";

const maximumLoginRequestBytes = 8 * 1024;
const minuteMs = 60 * 1_000;

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return loginError("invalid_request", 403);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if (!supabaseUrl || !anonKey) return loginError("service_unavailable", 503);

  const trustedClientIp = getClientIp(request);
  const clientIp = trustedClientIp || "unknown";
  const ipLimit = consumeRequestRateLimit(
    `login:ip:${clientIp}`,
    12,
    10 * minuteMs,
  );
  if (!ipLimit.allowed) return loginRateLimit(ipLimit.retryAfterSeconds);

  const parsed = await readLimitedJsonObjectDetailed(
    request,
    maximumLoginRequestBytes,
  );
  if (!parsed.ok || !hasOnlyKeys(parsed.value, ["email", "password", "captchaToken"])) {
    return loginError("invalid_request", 400);
  }

  const email = requestText(parsed.value.email).toLowerCase();
  const password =
    typeof parsed.value.password === "string" ? parsed.value.password : "";
  const captchaToken = requestText(parsed.value.captchaToken);
  if (
    !isValidEmail(email) ||
    email.length > 320 ||
    password.length < 1 ||
    password.length > 1_024
  ) {
    return loginError("invalid_credentials", 400);
  }

  const accountLimit = consumeRequestRateLimit(
    `login:email:${email}`,
    8,
    30 * minuteMs,
  );
  if (!accountLimit.allowed) return loginRateLimit(accountLimit.retryAfterSeconds);

  const turnstileConfigured = isTurnstileConfigured();
  if (!turnstileConfigured && process.env.NODE_ENV === "production") {
    return loginError("service_unavailable", 503);
  }
  if (turnstileConfigured && !captchaToken) {
    return loginError("captcha_required", 400);
  }
  const supabase = createClient(resolveSupabaseUrl(supabaseUrl), anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  if (error) {
    const code = publicLoginErrorCode(error.code);
    return loginError(code, code === "rate_limited" ? 429 : 400);
  }
  if (!data.session?.access_token || !data.session.refresh_token) {
    return loginError("service_unavailable", 503);
  }

  return NextResponse.json({
    ok: true,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
}

function publicLoginErrorCode(code?: string) {
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  ) {
    return "rate_limited";
  }
  if (
    code === "email_not_confirmed" ||
    code === "weak_password" ||
    code === "captcha_failed"
  ) {
    return code;
  }
  return "invalid_credentials";
}

function loginRateLimit(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: "Login failed.", code: "rate_limited" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

function loginError(code: string, status: number) {
  return NextResponse.json(
    { ok: false, error: "Login failed.", code },
    { status },
  );
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]) {
  const allowed = new Set(allowedKeys);
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function requestText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
