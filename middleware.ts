import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DISABLED_PREFIXES = [
  "/dashboard",
  "/login",
  "/api/draft-jobs",
  "/api/documents",
  "/api/matters",
  "/api/templates",
  "/api/jobs"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (DISABLED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/:path*"]
};
