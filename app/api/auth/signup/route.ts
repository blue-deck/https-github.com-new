import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authConfirmUrl, safeInternalPath } from "../../../lib/site";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import { isMarketplaceAccountRole } from "../../../lib/marketplaceCapabilities";
import { getDefaultPositionForAccountType, yachtPositionTitles } from "../../../lib/yachtOperations";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import { readLimitedJsonObject } from "../../../lib/requestBodyServer";
import { isTrustedSameOriginMutation } from "../../../lib/requestOriginServer";
import {
  currentLegalAcceptance,
  isCurrentLegalAcceptance,
} from "../../../lib/legalPolicies";
import {
  getClientIp,
  isTurnstileConfigured,
} from "../../../lib/turnstileServer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const minuteMs = 60 * 1_000;
const maximumSignupRequestBytes = 16 * 1024;
const minimumPublicSignupDurationMs = 1_200;

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) {
    return signupError("invalid_request", 403);
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return signupError("service_unavailable", 503);
  }

  const turnstileConfigured = isTurnstileConfigured();
  const trustedClientIp = getClientIp(request);
  const clientIp = trustedClientIp || "unknown";
  const ipLimit = consumeRequestRateLimit(
    "signup:" +
      (turnstileConfigured ? "verified" : "fallback") +
      ":ip:" +
      clientIp,
    turnstileConfigured ? 6 : 5,
    (turnstileConfigured ? 10 : 30) * minuteMs,
  );
  if (!ipLimit.allowed) return signupRateLimitResponse(ipLimit.retryAfterSeconds);

  const rawBody = await readLimitedJsonObject(
    request,
    maximumSignupRequestBytes,
  );
  if (!rawBody) {
    return signupError("invalid_request", 400);
  }
  if (!hasOnlySignupRequestKeys(rawBody)) {
    return signupError("invalid_request", 400);
  }
  const body = rawBody as SignupRequestBody;

  const email = requestText(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = requestText(body.fullName);
  const role = isMarketplaceAccountRole(body.role) ? body.role : "";
  const requestedPosition = requestText(body.position) || getDefaultPositionForAccountType(role);
  const position = yachtPositionTitles.includes(requestedPosition) ? requestedPosition : "";
  const nextPath = safeInternalPath(requestText(body.next));
  const captchaToken = requestText(body.captchaToken);
  const website = requestText(body.website);
  const legalAcceptance = body.legalAcceptance;

  if (website) {
    return genericSignupResponse();
  }

  if (
    !email ||
    !password ||
    !fullName ||
    !role ||
    !position ||
    !isCurrentLegalAcceptance(legalAcceptance)
  ) {
    return signupError(
      !isCurrentLegalAcceptance(legalAcceptance)
        ? "legal_acceptance_required"
        : "invalid_request",
      400,
    );
  }

  if (fullName.length > 120 || email.length > 320) {
    return signupError("invalid_request", 400);
  }

  if (!isValidEmail(email)) {
    return signupError("invalid_email", 400);
  }

  if (!hasSignupPasswordRequirements(password)) {
    return signupError("weak_password", 400);
  }

  const emailLimit = consumeRequestRateLimit(
    "signup:" +
      (turnstileConfigured ? "verified" : "fallback") +
      ":email:" +
      email,
    turnstileConfigured ? 4 : 3,
    (turnstileConfigured ? 30 : 60) * minuteMs,
  );
  if (!emailLimit.allowed) return signupRateLimitResponse(emailLimit.retryAfterSeconds);

  if (!turnstileConfigured && process.env.NODE_ENV === "production") {
    return signupError("service_unavailable", 503);
  }
  if (turnstileConfigured && !captchaToken) {
    return signupError("captcha_required", 400);
  }
  const resolvedSupabaseUrl = resolveSupabaseUrl(supabaseUrl);

  const supabase = createClient(resolvedSupabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const authRequestStartedAt = Date.now();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authConfirmUrl(nextPath),
      captchaToken,
      data: {
        full_name: fullName,
        role,
        position,
        bluedeck_legal_acceptance: currentLegalAcceptance(),
      },
    },
  });

  if (error) {
    console.error("BlueDeck account signup failed", {
      code: error.code || "signup_failed",
      status: error.status,
    });
    if (isDuplicateSignupError(error.code)) {
      await waitForMinimumSignupDuration(authRequestStartedAt);
      return genericSignupResponse();
    }
    const code = publicSignupErrorCode(error.code);
    return signupError(
      code,
      code === "rate_limited" ? 429 : 400,
    );
  }

  const isNewAccount = Boolean(
    data.user?.id &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length > 0,
  );
  let provisioningFailed = false;
  if (isNewAccount && data.user?.id) {
    const adminSupabase = createClient(resolvedSupabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: provisioned, error: provisioningError } =
      await adminSupabase.rpc("bluedeck_provision_signup_account", {
        p_user_id: data.user.id,
        p_email: email,
        p_full_name: fullName,
        p_account_role: role,
        p_position: position,
      });

    if (provisioningError || provisioned !== true) {
      provisioningFailed = true;
      console.error("BlueDeck atomic signup provisioning failed", {
        userId: data.user.id,
        code: provisioningError?.code || "signup_not_provisioned",
      });

      const { error: quarantineError } = await adminSupabase.rpc(
        "bluedeck_fail_signup_provisioning",
        {
          p_user_id: data.user.id,
          p_failure_code: "trusted_promotion_failed",
        },
      );
      if (quarantineError) {
        console.error("BlueDeck failed signup quarantine failed", {
          userId: data.user.id,
          code: quarantineError.code || "signup_quarantine_failed",
        });
      }

      const { error: cleanupError } =
        await adminSupabase.auth.admin.deleteUser(data.user.id, false);
      if (cleanupError) {
        console.error("BlueDeck failed signup cleanup failed", {
          userId: data.user.id,
          code: cleanupError.code || "signup_cleanup_failed",
        });
      }
    }
  }

  await waitForMinimumSignupDuration(authRequestStartedAt);
  if (provisioningFailed) {
    return signupError("service_unavailable", 503);
  }
  return genericSignupResponse();
}

type SignupRequestBody = {
  email?: string;
  password?: string;
  fullName?: string;
  role?: string;
  position?: string;
  next?: string;
  captchaToken?: string;
  website?: string;
  legalAcceptance?: unknown;
};

function hasOnlySignupRequestKeys(value: Record<string, unknown>) {
  const allowed = new Set([
    "email",
    "password",
    "fullName",
    "role",
    "position",
    "next",
    "captchaToken",
    "website",
    "legalAcceptance",
  ]);
  return Object.keys(value).every((key) => allowed.has(key));
}

function requestText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function signupRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Account could not be created.", code: "rate_limited" },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

function signupError(code: string, status: number) {
  return NextResponse.json(
    { error: "Account could not be created.", code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function publicSignupErrorCode(code: string | undefined) {
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return "rate_limited";
  }
  if (code === "weak_password" || code === "captcha_failed") return code;
  return "signup_failed";
}

function isDuplicateSignupError(code: string | undefined) {
  return code === "user_already_exists" || code === "email_exists";
}

function genericSignupResponse() {
  return NextResponse.json(
    {
      userId: null,
      emailConfirmed: false,
      needsEmailConfirmation: true,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function waitForMinimumSignupDuration(startedAt: number) {
  const remaining = minimumPublicSignupDurationMs - (Date.now() - startedAt);
  if (remaining <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, remaining));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasSignupPasswordRequirements(value: string) {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}
