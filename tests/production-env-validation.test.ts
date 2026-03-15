import assert from "node:assert/strict";
import test from "node:test";
import { getCriticalProductionEnvIssues } from "../src/server/env.ts";

test("production startup env validation requires billing and runner secrets", () => {
  const issues = getCriticalProductionEnvIssues("startup", {
    NODE_ENV: "production"
  } as NodeJS.ProcessEnv);

  assert.equal(issues.some((issue) => issue.key === "BILLING_WEBHOOK_SECRET"), true);
  assert.equal(issues.some((issue) => issue.key === "CRON_SECRET|INTERNAL_JOBS_SECRET"), true);
});

test("production billing webhook validation requires billing secret only", () => {
  const issues = getCriticalProductionEnvIssues("billing-webhook", {
    NODE_ENV: "production",
    CRON_SECRET: "cron"
  } as NodeJS.ProcessEnv);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.key, "BILLING_WEBHOOK_SECRET");
});

test("production runner validation passes when either runner secret exists", () => {
  const withCron = getCriticalProductionEnvIssues("internal-runner", {
    NODE_ENV: "production",
    CRON_SECRET: "cron"
  } as NodeJS.ProcessEnv);
  const withInternal = getCriticalProductionEnvIssues("internal-runner", {
    NODE_ENV: "production",
    INTERNAL_JOBS_SECRET: "internal"
  } as NodeJS.ProcessEnv);

  assert.equal(withCron.length, 0);
  assert.equal(withInternal.length, 0);
});

test("non-production env skips critical production checks", () => {
  const issues = getCriticalProductionEnvIssues("startup", {
    NODE_ENV: "development"
  } as NodeJS.ProcessEnv);
  assert.equal(issues.length, 0);
});
