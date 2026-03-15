import { getCriticalProductionEnvIssues } from "../../src/server/env.ts";

export type BillingWebhookAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string; code: "invalid_signature" | "missing_secret" };

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function validateBillingWebhookAuth(request: Request, env: NodeJS.ProcessEnv = process.env): BillingWebhookAuthResult {
  const issues = getCriticalProductionEnvIssues("billing-webhook", env);
  if (issues.length > 0) {
    return {
      ok: false,
      status: 500,
      error: "Billing webhook is misconfigured.",
      code: "missing_secret"
    };
  }

  const expected = normalize(env.BILLING_WEBHOOK_SECRET);
  const signature = normalize(request.headers.get("x-billing-signature") ?? undefined);

  if (expected && signature !== expected) {
    return {
      ok: false,
      status: 401,
      error: "Invalid webhook signature.",
      code: "invalid_signature"
    };
  }

  return { ok: true };
}
