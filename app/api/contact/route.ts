import { createClient } from "@supabase/supabase-js";
import { validateContactForm } from "../../contact/contactForm";
import { verifyContactCaptcha } from "../../lib/contactSecurityServer";
import { privateNextResponse as NextResponse } from "../../lib/privateApiResponse";
import { readLimitedJsonObjectDetailed } from "../../lib/requestBodyServer";
import { isTrustedSameOriginMutation } from "../../lib/requestOriginServer";
import { consumeRequestRateLimit } from "../../lib/requestRateLimitServer";
import { resolveSupabaseUrl } from "../../lib/supabaseConfig";
import { getClientIp, isTurnstileConfigured } from "../../lib/turnstileServer";

export const runtime = "nodejs";
export const maxDuration = 25;

const maximumRequestBytes = 16 * 1024;
const minuteMs = 60 * 1000;
const allowedFields = new Set([
  "name",
  "email",
  "topic",
  "message",
  "language",
  "captchaToken",
]);

export async function POST(request: Request) {
  if (!isTrustedSameOriginMutation(request)) {
    return contactError("invalid_request", 403);
  }

  const clientIp = getClientIp(request);
  const ipLimit = consumeRequestRateLimit(
    `contact:ip:${clientIp || "unknown"}`,
    5,
    15 * minuteMs,
  );
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfterSeconds);

  const parsed = await readLimitedJsonObjectDetailed(request, maximumRequestBytes);
  if (!parsed.ok) {
    return contactError(
      "invalid_request",
      parsed.error === "too-large" ? 413 : parsed.error === "content-type" ? 415 : 400,
    );
  }
  if (Object.keys(parsed.value).some((field) => !allowedFields.has(field))) {
    return contactError("invalid_request", 400);
  }
  const validated = validateContactForm(parsed.value);
  if (!validated.ok) return contactError("invalid_request", 400);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey || !isTurnstileConfigured()) {
    return contactError("service_unavailable", 503);
  }

  const captcha = await verifyContactCaptcha(parsed.value.captchaToken, clientIp);
  if (captcha !== "verified") {
    return contactError(
      captcha === "unavailable" ? "service_unavailable" : "captcha_failed",
      captcha === "unavailable" ? 503 : 400,
    );
  }

  try {
    const serviceClient = createClient(
      resolveSupabaseUrl(supabaseUrl),
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
    const value = validated.value;
    // The service-only RPC applies durable sender/global limits in the same
    // transaction as the insert. Never persist IPs or CAPTCHA tokens.
    // Tokens are single use; do not retry validation or the write on failure.
    const result = await serviceClient
      .rpc("submit_contact_message", {
        p_name: value.name,
        p_email: value.email,
        p_topic: value.topic,
        p_message: value.message,
        p_language: value.language,
      })
      .retry(false)
      .abortSignal(AbortSignal.timeout(8_000));
    if (result.error) {
      if (result.error.code === "P0001") {
        if (result.error.message === "contact_email_rate_limit") {
          return rateLimited(3600);
        }
        if (result.error.message === "contact_global_rate_limit") {
          return rateLimited(86400);
        }
      }
      return contactError("service_unavailable", 503);
    }
    if (
      typeof result.data !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.data)
    ) {
      return contactError("service_unavailable", 503);
    }
    return NextResponse.json({ ok: true });
  } catch {
    // Never expose or log provider errors containing private message data.
    return contactError("service_unavailable", 503);
  }
}

function contactError(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status });
}

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, code: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
