import { NextRequest, NextResponse } from "next/server";
import { listDiscoverableCrewPage } from "../../lib/findCrewData";
import { consumeRequestRateLimit } from "../../lib/requestRateLimitServer";
import { getClientIp } from "../../lib/turnstileServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (
    Array.from(request.nextUrl.searchParams.keys()).some(
      (key) => key !== "cursor",
    ) ||
    request.nextUrl.searchParams.getAll("cursor").length > 1
  ) {
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

  const cursor = request.nextUrl.searchParams.get("cursor") || "";
  try {
    const page = await listDiscoverableCrewPage(cursor);
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
