import { NextResponse } from "next/server.js";
import { setSubscriptionForUser } from "@/lib/server/subscriptions";
import { validateBillingWebhookAuth } from "@/lib/server/billingWebhookAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = validateBillingWebhookAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const event = (await request.json().catch(() => null)) as
    | { type?: string; data?: { userId?: string; plan?: string; expiresAt?: string } }
    | null;

  if (!event?.type || !event.data?.userId) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "subscription.updated") {
    await setSubscriptionForUser(event.data.userId, {
      plan: event.data.plan ?? "pro",
      status: "active",
      expiresAt: event.data.expiresAt
    });
  }

  if (event.type === "subscription.canceled") {
    await setSubscriptionForUser(event.data.userId, {
      plan: "free",
      status: "inactive"
    });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
