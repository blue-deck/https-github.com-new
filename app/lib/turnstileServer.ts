import "server-only";

type TurnstileVerifyResponse = {
  success?: boolean;
  action?: string;
  "error-codes"?: string[];
};

export type TurnstileConfiguration = {
  enabled: boolean;
  siteKey: string;
};

export function getTurnstileConfiguration(): TurnstileConfiguration {
  const siteKey = turnstileSiteKey();
  return {
    enabled: Boolean(siteKey && turnstileSecretKey()),
    siteKey,
  };
}

export function isTurnstileConfigured() {
  return getTurnstileConfiguration().enabled;
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
  expectedAction?: string,
) {
  const secret = turnstileSecretKey();
  if (!secret || !token.trim()) return false;

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token.trim());
  if (remoteIp) formData.append("remoteip", remoteIp);

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!response.ok) return false;

    const result = (await response.json()) as TurnstileVerifyResponse;
    if (!result.success) return false;

    return !expectedAction || result.action === expectedAction;
  } catch {
    return false;
  }
}

export function getClientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || undefined;
}

function turnstileSecretKey() {
  return (
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
    ""
  ).trim();
}

function turnstileSiteKey() {
  return (
    process.env.TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    ""
  ).trim();
}
