import type { NextRequest } from "next/server";
import { readLimitedJsonObjectDetailed } from "../../../lib/requestBodyServer";
import { isTrustedSameOriginMutation } from "../../../lib/requestOriginServer";
import { resolveSupabaseUrl } from "../../../lib/supabaseConfig";
import { revokeSupabaseSessionWithRefresh } from "../../../lib/supabaseSessionRevocation";

const maximumLogoutRequestBytes = 64 * 1_024;
const upstreamStepDeadlineMs = 4_000;
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "X-Content-Type-Options": "nosniff",
};

export async function POST(request: NextRequest) {
  if (!isTrustedSameOriginMutation(request)) return logoutResponse(403);

  const parsed = await readLimitedJsonObjectDetailed(
    request,
    maximumLogoutRequestBytes,
  );
  if (
    !parsed.ok ||
    !hasOnlyKeys(parsed.value, ["accessToken", "refreshToken"])
  ) {
    return logoutResponse(400);
  }

  const accessToken = plausibleAccessToken(parsed.value.accessToken);
  const refreshToken = plausibleRefreshToken(parsed.value.refreshToken);
  if (!accessToken && !refreshToken) return logoutResponse(400);

  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if (!configuredUrl || !anonKey) return logoutResponse(503);

  const supabaseUrl = resolveSupabaseUrl(configuredUrl);
  await revokeSupabaseSessionWithRefresh({
    accessToken,
    anonKey,
    refreshToken,
    stepDeadlineMs: upstreamStepDeadlineMs,
    supabaseUrl,
  });

  // Do not expose whether either credential was valid.
  return logoutResponse(204);
}

function plausibleAccessToken(value: unknown) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 32_768 &&
    value.split(".").length === 3
    ? value
    : "";
}

function plausibleRefreshToken(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 32_768
    ? value
    : "";
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]) {
  const allowed = new Set(allowedKeys);
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function logoutResponse(status: number) {
  return new Response(null, { status, headers: privateHeaders });
}
