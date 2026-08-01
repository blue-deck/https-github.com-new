import { NextRequest, NextResponse } from "next/server";
import { loadPublicJobPost } from "../../../lib/jobPostsServer";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  void request;
  const result = await loadPublicJobPost((await context.params).id);
  if (!result.ok) {
    return publicResponse(
      { ok: false, error: result.error },
      result.status,
    );
  }

  return publicResponse({ ok: true, job: result.job });
}

function publicResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
