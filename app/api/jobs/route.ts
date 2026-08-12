import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parsePublicJobSearchParams } from "../../lib/publicJobSearch";
import { publicJobSearchTaxonomy } from "../../lib/publicJobSearchConfig";
import { searchPublicJobs } from "../../lib/publicJobSearchServer";
import { consumeRequestRateLimit } from "../../lib/requestRateLimitServer";
import { getClientIp } from "../../lib/turnstileServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = parsePublicJobSearchParams(
    request.nextUrl.searchParams,
    publicJobSearchTaxonomy,
  );
  if (!parsed.ok) {
    return publicResponse({ ok: false, error: parsed.error }, 400);
  }

  const clientIp = getClientIp(request) || "unknown";
  const rateLimit = consumeRequestRateLimit(
    `public-job-search:${clientIp}`,
    120,
    10 * 60 * 1_000,
  );
  if (!rateLimit.allowed) {
    return publicResponse(
      { ok: false, error: "Too many job search requests." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  const result = await searchPublicJobs(parsed.filters, parsed.cursor);
  if (!result.ok) {
    return publicResponse(
      { ok: false, error: result.error },
      result.status,
    );
  }

  return publicResponse({
    ok: true,
    jobs: result.jobs,
    total: result.total,
    limit: result.limit,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  });
}

function publicResponse(
  body: object,
  status = 200,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  return NextResponse.json(body, {
    status,
    headers,
  });
}
