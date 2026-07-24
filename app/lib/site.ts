const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export const BLUEDECK_SITE_URL =
  configuredSiteUrl === "https://bluedeck.app" || configuredSiteUrl === "http://bluedeck.app"
    ? "https://www.bluedeck.app"
    : configuredSiteUrl || "https://www.bluedeck.app";

export function absoluteSiteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BLUEDECK_SITE_URL}${normalizedPath}`;
}

export function authConfirmUrl(next = "/dashboard") {
  const params = new URLSearchParams({ next: safeInternalPath(next) });
  return absoluteSiteUrl(`/auth/confirm?${params.toString()}`);
}

export function safeInternalPath(
  value?: string | null,
  fallback = "/dashboard",
) {
  if (
    !value ||
    value.length > 2_048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /%(?:0a|0d|2f|5c)/i.test(value) ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const siteOrigin = new URL(BLUEDECK_SITE_URL).origin;
    const destination = new URL(value, siteOrigin);
    if (destination.origin !== siteOrigin) return fallback;
    const normalized = `${destination.pathname}${destination.search}${destination.hash}`;
    if (
      !normalized.startsWith("/") ||
      normalized.startsWith("//") ||
      normalized.includes("\\")
    ) {
      return fallback;
    }
    return normalized;
  } catch {
    return fallback;
  }
}
