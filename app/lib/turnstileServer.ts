import "server-only";

import { isIP } from "node:net";

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

export function getClientIp(request: Request) {
  // Vercel overwrites these forwarding headers at its trusted edge. Only use
  // them when the runtime itself confirms that requests are running there.
  if (process.env.VERCEL === "1") {
    const vercelForwardedFor = validIp(
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim(),
    );
    if (vercelForwardedFor) return vercelForwardedFor;

    const forwardedFor = validIp(
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    );
    if (forwardedFor) return forwardedFor;
    return undefined;
  }

  // BlueDeck explicitly enables this only in the Sites/Cloudflare runtime.
  // A header name alone is never enough to establish a trusted proxy.
  if (process.env.BLUDECK_TRUSTED_PROXY === "cloudflare") {
    return validIp(request.headers.get("cf-connecting-ip")?.trim());
  }

  // In an unknown production environment, caller-controlled forwarding
  // headers are not trusted.
  if (process.env.NODE_ENV === "production") return undefined;

  const forwardedFor = validIp(
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  );
  return forwardedFor || validIp(request.headers.get("x-real-ip")?.trim());
}

function validIp(value?: string) {
  return value && value.length <= 64 && isIP(value) ? value : undefined;
}

function turnstileSecretKey() {
  const value = (
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
    ""
  ).trim();
  return isPlausibleTurnstileCredential(value) ? value : "";
}

function turnstileSiteKey() {
  const value = (
    process.env.TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    ""
  ).trim();
  return isPlausibleTurnstileCredential(value) ? value : "";
}

function isPlausibleTurnstileCredential(value: string) {
  return (
    value.length >= 20 &&
    value.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(value) &&
    !/^(placeholder|changeme|turnstile|example)/i.test(value)
  );
}
