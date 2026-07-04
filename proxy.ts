import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0]?.toLowerCase();

  if (hostname === "bluedeck.app") {
    const url = request.nextUrl.clone();
    url.protocol = "https";
    url.hostname = "www.bluedeck.app";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
