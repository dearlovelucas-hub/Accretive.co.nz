import assert from "node:assert/strict";
import test from "node:test";
import { validateBillingWebhookAuth } from "../lib/server/billingWebhookAuth.ts";

test("billing webhook auth fails in production when secret missing", () => {
  const request = new Request("http://localhost/api/billing/webhook", {
    method: "POST"
  });

  const result = validateBillingWebhookAuth(request, {
    NODE_ENV: "production"
  } as NodeJS.ProcessEnv);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 500);
    assert.equal(result.code, "missing_secret");
  }
});

test("billing webhook auth rejects invalid signatures", () => {
  const request = new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: {
      "x-billing-signature": "wrong"
    }
  });

  const result = validateBillingWebhookAuth(request, {
    NODE_ENV: "production",
    BILLING_WEBHOOK_SECRET: "expected"
  } as NodeJS.ProcessEnv);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 401);
    assert.equal(result.code, "invalid_signature");
  }
});

test("billing webhook auth accepts matching signature", () => {
  const request = new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: {
      "x-billing-signature": "expected"
    }
  });

  const result = validateBillingWebhookAuth(request, {
    NODE_ENV: "production",
    BILLING_WEBHOOK_SECRET: "expected"
  } as NodeJS.ProcessEnv);

  assert.equal(result.ok, true);
});
