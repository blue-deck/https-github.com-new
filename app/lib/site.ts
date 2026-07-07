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
  const params = new URLSearchParams({ next });
  return absoluteSiteUrl(`/auth/confirm?${params.toString()}`);
}
