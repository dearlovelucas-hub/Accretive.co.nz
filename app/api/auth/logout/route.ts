import { NextResponse } from "next/server.js";
import { getAuthCookieName, shouldUseSecureCookies } from "@/lib/server/auth";
import { requireCsrfProtection } from "@/lib/server/authorization";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const csrf = requireCsrfProtection(request);
  if (!csrf.ok) {
    return csrf.response;
  }

  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set({
    name: getAuthCookieName(),
    value: "",
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: shouldUseSecureCookies(request),
    sameSite: "lax"
  });

  return response;
}
