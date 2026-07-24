import { NextResponse } from "next/server";

// Account creation is handled exclusively by /api/auth/signup. This legacy
// endpoint must never accept credentials, privileged roles, or use admin auth.
export async function POST() {
  return NextResponse.json(
    { error: "Not found." },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
