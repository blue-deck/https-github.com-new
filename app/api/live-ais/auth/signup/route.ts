import { NextResponse } from "next/server";

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
