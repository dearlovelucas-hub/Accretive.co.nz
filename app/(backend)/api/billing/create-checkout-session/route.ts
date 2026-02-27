import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";
import { setSubscriptionForUser } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan ?? "pro";

  const autoActivate = (process.env.BILLING_STUB_AUTO_ACTIVATE ?? "true") === "true";

  // Stripe integration stub: keep secrets server-side only and return a redirect URL.
  if (!process.env.STRIPE_SECRET_KEY && autoActivate) {
    await setSubscriptionForUser(session.userId, {
      plan,
      status: "active",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    return NextResponse.json(
      {
        checkoutUrl: "/dashboard/drafting?upgraded=1",
        mode: "stub"
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      checkoutUrl: "/pricing?checkout=pending",
      mode: "provider_stub",
      message: "Connect Stripe checkout session creation here."
    },
    { status: 200 }
  );
}
