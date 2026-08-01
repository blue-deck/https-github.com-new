import { NextResponse } from "next/server";

export const privateNextResponse = {
  json(body: unknown, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
    headers.set("Vary", mergeVary(headers.get("Vary"), "Authorization"));
    headers.set("X-Content-Type-Options", "nosniff");
    return NextResponse.json(body, { ...init, headers });
  },
};

function mergeVary(current: string | null, value: string) {
  const entries = new Set(
    (current || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  entries.add(value);
  return Array.from(entries).join(", ");
}
