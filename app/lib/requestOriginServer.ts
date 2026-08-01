import "server-only";

import { BLUEDECK_SITE_URL } from "./site";

const trustedSiteOrigin = new URL(BLUEDECK_SITE_URL).origin;

export function isTrustedSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin")?.trim() || "";
  if (!origin || origin !== trustedSiteOrigin) return false;

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  return !fetchSite || fetchSite === "same-origin";
}
