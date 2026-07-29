import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { absoluteSiteUrl } from "../../../lib/site";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import {
  getClientIp,
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "../../../lib/turnstileServer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const minuteMs = 60 * 1_000;

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return forgotPasswordError("service_unavailable", 503);
  }

  let body: ForgotPasswordRequestBody;

  try {
    body = (await request.json()) as ForgotPasswordRequestBody;
  } catch {
    return forgotPasswordError("invalid_request", 400);
  }

  const email = body.email?.trim().toLowerCase() || "";
  const captchaToken = body.captchaToken?.trim() || "";
  const website = body.website?.trim() || "";

  if (website) {
    return NextResponse.json({ ok: true });
  }

  if (!isValidEmail(email)) {
    return forgotPasswordError("invalid_email", 400);
  }

  const turnstileConfigured = isTurnstileConfigured();
  const clientIp = getClientIp(request) || "unknown";
  const rateLimitMode = turnstileConfigured ? "verified" : "fallback";
  const ipLimit = consumeRequestRateLimit(
    "forgot-password:" + rateLimitMode + ":ip:" + clientIp,
    turnstileConfigured ? 8 : 4,
    (turnstileConfigured ? 10 : 30) * minuteMs,
  );
  if (!ipLimit.allowed) {
    return forgotPasswordRateLimitResponse(ipLimit.retryAfterSeconds);
  }

  const emailLimit = consumeRequestRateLimit(
    "forgot-password:" + rateLimitMode + ":email:" + email,
    turnstileConfigured ? 5 : 3,
    (turnstileConfigured ? 30 : 60) * minuteMs,
  );
  if (!emailLimit.allowed) {
    return forgotPasswordRateLimitResponse(emailLimit.retryAfterSeconds);
  }

  if (turnstileConfigured) {
    if (!captchaToken) {
      return forgotPasswordError("captcha_required", 400);
    }

    const captchaVerified = await verifyTurnstileToken(
      captchaToken,
      clientIp === "unknown" ? undefined : clientIp,
      "forgot_password",
    );

    if (!captchaVerified) {
      return forgotPasswordError("captcha_failed", 400);
    }
  }

  const supabase = createClient(resolveSupabaseUrl(supabaseUrl), supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteSiteUrl("/reset-password"),
  });

  if (error) {
    console.error("BlueDeck password reset request failed", error.message);
    return forgotPasswordError("send_failed", 502);
  }

  return NextResponse.json({ ok: true });
}

type ForgotPasswordRequestBody = {
  email?: string;
  captchaToken?: string;
  website?: string;
};

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
