import { NextRequest, NextResponse } from "next/server";
import { listDiscoverableCrewPage } from "../../lib/findCrewData";
import {
  crewSearchParamKeys,
  parseCrewSearchFilters,
} from "../../lib/crewSearch";
import { consumeRequestRateLimit } from "../../lib/requestRateLimitServer";
import { getClientIp } from "../../lib/turnstileServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  if (!isValidCrewSearchRequest(searchParams)) {
    return directoryResponse(
      { ok: false, error: "Invalid crew directory request." },
      400,
    );
  }

  const clientIp = getClientIp(request) || "unknown";
  const rateLimit = consumeRequestRateLimit(
    `find-crew-page:${clientIp}`,
    120,
    10 * 60 * 1_000,
  );
  if (!rateLimit.allowed) {
    return directoryResponse(
      { ok: false, error: "Too many directory requests." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  const cursor = searchParams.get("cursor") || "";
  const filters = parseCrewSearchFilters(searchParams);
  try {
    const page = await listDiscoverableCrewPage(cursor, filters);
    return directoryResponse({ ok: true, ...page });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "find_crew_cursor_invalid") {
      return directoryResponse(
        { ok: false, error: "Invalid crew directory cursor." },
        400,
      );
    }
    console.error("Find Crew page request failed", {
      code: code.startsWith("find_crew_") ? code : "find_crew_unknown",
    });
    return directoryResponse(
      { ok: false, error: "Crew profiles could not be loaded." },
      503,
    );
  }
}

function isValidCrewSearchRequest(searchParams: URLSearchParams) {
  const keys = Array.from(new Set(searchParams.keys()));
  if (
    keys.some(
      (key) =>
        !crewSearchParamKeys.has(key) ||
        searchParams.getAll(key).length !== 1,
    ) ||
    Array.from(searchParams.values()).some((value) => value.length > 256)
  ) {
    return false;
  }

  for (const key of ["experienceMin"]) {
    const value = searchParams.get(key);
    if (
      value !== null &&
      (!/^\d+(?:\.\d)?$/.test(value) || Number(value) > 60)
    ) {
      return false;
    }
  }
  const memberSince = searchParams.get("memberSince");
  if (memberSince !== null && !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(memberSince)) {
    return false;
  }
  for (const key of ["premium", "photo", "gallery"]) {
    const value = searchParams.get(key);
    if (value !== null && value !== "1") return false;
  }
  const maritalStatus = searchParams.get("maritalStatus");
  if (
    maritalStatus !== null &&
    maritalStatus !== "Single" &&
    maritalStatus !== "Married"
  ) {
    return false;
  }
  const cursor = searchParams.get("cursor");
  return cursor === null ||
    /^v2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{1,256}\.[A-Za-z0-9_-]{22}$/.test(
      cursor,
    );
}

function directoryResponse(
  body: object,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  return NextResponse.json(body, { status, headers });
}
