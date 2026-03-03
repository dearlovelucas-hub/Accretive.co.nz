import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";
import { getEntitlement } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entitlement = await getEntitlement(session.userId);
  return NextResponse.json(
    {
      active: entitlement.active,
      plan: entitlement.plan,
      expiresAt: entitlement.expiresAt
    },
    { status: 200 }
  );
}
