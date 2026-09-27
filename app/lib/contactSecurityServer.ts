import "server-only";

import { BLUEDECK_SITE_URL } from "./site";
import { isTurnstileConfigured } from "./turnstileServer";

export async function verifyContactCaptcha(
  token: unknown,
  clientIp?: string,
): Promise<"verified" | "rejected" | "unavailable"> {
  if (typeof token !== "string" || !/^[\x21-\x7e]{1,2048}$/.test(token)) {
    return "rejected";
  }
  if (!isTurnstileConfigured()) return "unavailable";
  const secret = (
    process.env.TURNSTILE_SECRET_KEY ||
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
    ""
  ).trim();

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (clientIp) body.set("remoteip", clientIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return "unavailable";
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return "unavailable";
    }
    const verification = result as Record<string, unknown>;
    return verification.success === true &&
      verification.action === "contact" &&
      verification.hostname === new URL(BLUEDECK_SITE_URL).hostname
      ? "verified"
      : "rejected";
  } catch {
    return "unavailable";
  }
}
