import { NextResponse } from "next/server";
import { getAuthCookieName } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set({
    name: getAuthCookieName(),
    value: "",
    maxAge: 0,
    path: "/"
  });

  return response;
}
