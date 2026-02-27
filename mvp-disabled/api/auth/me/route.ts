import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
        role: session.role
      }
    },
    { status: 200 }
  );
}
