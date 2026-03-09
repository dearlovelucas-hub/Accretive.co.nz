import { NextResponse } from "next/server.js";
import { requireOrgMembership, requireSession } from "@/lib/server/authorization";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = requireSession(request);
  if (!session.ok) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const membership = await requireOrgMembership(request);
  if (!membership.ok) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: membership.value.userId,
        username: membership.value.session.username,
        displayName: membership.value.session.displayName,
        role: membership.value.role
      }
    },
    { status: 200 }
  );
}
