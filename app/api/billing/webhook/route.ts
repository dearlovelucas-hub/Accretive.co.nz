import { NextResponse } from "next/server.js";
import { setSubscriptionForUser } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("x-billing-signature");
  const expected = process.env.BILLING_WEBHOOK_SECRET;

  if (expected && signature !== expected) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
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
