import { NextResponse } from "next/server";
import { getTurnstileConfiguration } from "../../../lib/turnstileServer";

export async function GET() {
  const configuration = getTurnstileConfiguration();

  return NextResponse.json(configuration, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
