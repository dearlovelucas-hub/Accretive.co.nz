import { NextResponse } from "next/server.js";
import { requireCsrfProtection, requireOrgMembership } from "@/lib/server/authorization";
import { setSubscriptionForUser } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }
  const csrf = requireCsrfProtection(request);
  if (!csrf.ok) {
    return csrf.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    plan?: string;
    paymentMethod?: "credit_charge" | "internet_banking" | "direct_debit";
  };
  const plan = body.plan ?? "pro";
  const paymentMethod = body.paymentMethod ?? "credit_charge";

  const autoActivate = (process.env.BILLING_STUB_AUTO_ACTIVATE ?? "true") === "true";

  // Stripe integration stub: keep secrets server-side only and return a redirect URL.
  if (!process.env.STRIPE_SECRET_KEY && autoActivate) {
    await setSubscriptionForUser(auth.value.userId, {
      plan,
      status: "active",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    return NextResponse.json(
      {
        checkoutUrl: "/dashboard/drafting?upgraded=1",
        mode: "stub",
        paymentMethod
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      checkoutUrl: "/pricing?checkout=pending",
      mode: "provider_stub",
      paymentMethod,
      message: "Connect Stripe checkout session creation here."
    },
    { status: 200 }
  );
}
