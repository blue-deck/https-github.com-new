import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveBaseProfileById } from "../../../lib/baseProfiles";
import { saveCrewProfileByUserId } from "../../../lib/crewProfiles";
import { authConfirmUrl, safeInternalPath } from "../../../lib/site";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import {
  canUseCrewWorkspace,
  isMarketplaceAccountRole,
} from "../../../lib/marketplaceCapabilities";
import { ensureMarketplaceEntitlement } from "../../../lib/marketplaceEntitlementsServer";
import { getDefaultPositionForAccountType, yachtPositionTitles } from "../../../lib/yachtOperations";
import { consumeRequestRateLimit } from "../../../lib/requestRateLimitServer";
import {
  getClientIp,
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "../../../lib/turnstileServer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const minuteMs = 60 * 1_000;

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return signupError("service_unavailable", 503);
  }

  let body: SignupRequestBody;

  try {
    body = (await request.json()) as SignupRequestBody;
  } catch {
    return signupError("invalid_request", 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const fullName = body.fullName?.trim() || "";
  const role = isMarketplaceAccountRole(body.role) ? body.role : "";
  const requestedPosition = body.position?.trim() || getDefaultPositionForAccountType(role);
  const position = yachtPositionTitles.includes(requestedPosition) ? requestedPosition : "";
  const nextPath = safeInternalPath(body.next);
  const captchaToken = body.captchaToken?.trim() || "";
  const website = body.website?.trim() || "";

  if (website) {
    return NextResponse.json({
      userId: null,
      emailConfirmed: false,
      needsEmailConfirmation: true,
    });
  }

  if (!email || !password || !fullName || !role || !position) {
    return signupError("invalid_request", 400);
  }

  if (!isValidEmail(email)) {
    return signupError("invalid_email", 400);
  }

  if (!hasSignupPasswordRequirements(password)) {
    return signupError("weak_password", 400);
  }

  const turnstileConfigured = isTurnstileConfigured();
  const clientIp = getClientIp(request) || "unknown";
  const ipLimit = consumeRequestRateLimit(
    "signup:" +
      (turnstileConfigured ? "verified" : "fallback") +
      ":ip:" +
      clientIp,
    turnstileConfigured ? 6 : 5,
    (turnstileConfigured ? 10 : 30) * minuteMs,
  );
  if (!ipLimit.allowed) return signupRateLimitResponse(ipLimit.retryAfterSeconds);

  const emailLimit = consumeRequestRateLimit(
    "signup:" +
      (turnstileConfigured ? "verified" : "fallback") +
      ":email:" +
      email,
    turnstileConfigured ? 4 : 3,
    (turnstileConfigured ? 30 : 60) * minuteMs,
  );
  if (!emailLimit.allowed) return signupRateLimitResponse(emailLimit.retryAfterSeconds);

  if (turnstileConfigured) {
    if (!captchaToken) {
      return signupError("captcha_required", 400);
    }

    const captchaVerified = await verifyTurnstileToken(
      captchaToken,
      clientIp === "unknown" ? undefined : clientIp,
      "signup",
    );
    if (!captchaVerified) {
      return signupError("captcha_failed", 400);
    }
  }

  const resolvedSupabaseUrl = resolveSupabaseUrl(supabaseUrl);

  const supabase = createClient(resolvedSupabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authConfirmUrl(nextPath),
      data: {
        full_name: fullName,
        role,
        position,
      },
    },
  });

  if (error) {
    const code = publicSignupErrorCode(error.code);
    console.error("BlueDeck account signup failed", {
      code,
      status: error.status,
    });
    return signupError(
      code,
      code === "rate_limited" ? 429 : 400,
    );
  }

  if (data.user?.id) {
    const adminSupabase = createClient(resolvedSupabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    try {
      const trustedMetadataResult =
        await adminSupabase.auth.admin.updateUserById(data.user.id, {
          app_metadata: {
            ...(data.user.app_metadata || {}),
            role,
            position,
            bluedeck_account_role: role,
            bluedeck_signup_position: position,
          },
        });

      if (trustedMetadataResult.error) {
        console.error("BlueDeck trusted account metadata sync failed after signup", {
          userId: data.user.id,
          message: trustedMetadataResult.error.message,
        });
      }

      const profileResults = await Promise.all([
        saveBaseProfileById(adminSupabase, {
          id: data.user.id,
          email,
          full_name: fullName,
          role,
        }),
        saveCrewProfileByUserId(
          adminSupabase,
          data.user.id,
          {
            email,
            full_name: fullName,
            current_position: position,
            current_positions: [position],
            public_crew_id: canUseCrewWorkspace(role)
              ? data.user.id.slice(0, 8).toUpperCase()
              : null,
          }
        ),
      ]);

      const failedProfileWrites = profileResults
        .map((result) => result.error?.message)
        .filter(Boolean);

      if (failedProfileWrites.length > 0) {
        console.error("BlueDeck profile sync returned errors after signup", failedProfileWrites);
      }

      const entitlementResult = await ensureMarketplaceEntitlement(
        adminSupabase,
        data.user.id,
        role,
        "self_service",
      );
      if (!entitlementResult.ok) {
        console.error("BlueDeck marketplace entitlement sync failed after signup", {
          schemaUnavailable: entitlementResult.schemaUnavailable,
          message:
            entitlementResult.error instanceof Error
              ? entitlementResult.error.message
              : "Marketplace entitlement sync failed",
        });
      }
    } catch (profileError) {
      console.error("BlueDeck profile sync failed after signup", profileError);
    }
  }

  return NextResponse.json({
    userId: data.user?.id || null,
    emailConfirmed: Boolean(data.user?.email_confirmed_at),
    needsEmailConfirmation: !data.session,
  });
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
};

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
  if (code === "user_already_exists" || code === "email_exists") {
    return "email_in_use";
  }
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  ) {
    return "rate_limited";
  }
  if (code === "weak_password") return "weak_password";
  return "signup_failed";
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
