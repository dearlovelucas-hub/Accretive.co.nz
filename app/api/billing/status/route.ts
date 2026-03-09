import { NextResponse } from "next/server.js";
import { requireOrgMembership } from "@/lib/server/authorization";
import { getEntitlement } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const entitlement = await getEntitlement(auth.value.userId);
  return NextResponse.json(
    {
      active: entitlement.active,
      plan: entitlement.plan,
      expiresAt: entitlement.expiresAt
    },
    { status: 200 }
  );
}
