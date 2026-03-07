import test from "node:test";
import assert from "node:assert/strict";
import { createCompletedDraftJobForTest } from "../lib/server/draftJobsStore.ts";
import { setSubscriptionForUser, getEntitlement } from "../lib/server/subscriptions.ts";
import { buildDraftResultPayload } from "../lib/server/draftOutput.ts";
import { ensureTestDatabase, resetTestData, shutdownTestDatabase } from "./helpers/dbTest.ts";

test.before(async () => {
  await ensureTestDatabase();
});

test.beforeEach(async () => {
  await resetTestData();
});

test.after(async () => {
  await shutdownTestDatabase();
});

test("inactive subscription still receives full output", async () => {
  await setSubscriptionForUser("user_lucas", {
    plan: "free",
    status: "inactive"
  });

  const job = await createCompletedDraftJobForTest({
    ownerUserId: "user_lucas",
    templateFileName: "template.docx",
    transactionFileNames: ["side-letter.pdf"],
    dealInfo: "Deal details for output behavior test"
  });

  const entitlement = await getEntitlement("user_lucas");
  const result = buildDraftResultPayload({
    job,
    entitlement,
    previewLength: 120,
    upgradeUrlOrRoute: "/pricing"
  });

  assert.equal(result.canDownload, true);
  assert.equal(result.content, job.generatedOutput);
});

test("subscribed user receives full output", async () => {
  await setSubscriptionForUser("user_lucas", {
    plan: "pro",
    status: "active",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });

  const job = await createCompletedDraftJobForTest({
    ownerUserId: "user_lucas",
    templateFileName: "template.docx",
    transactionFileNames: [],
    dealInfo: "Subscribed user test"
  });

  const entitlement = await getEntitlement("user_lucas");
  const result = buildDraftResultPayload({
    job,
    entitlement,
    previewLength: 120,
    upgradeUrlOrRoute: "/pricing"
  });

  assert.equal(result.canDownload, true);
  assert.equal(result.content, job.generatedOutput);
});

test("output payload returns full output for inactive subscriptions", async () => {
  await setSubscriptionForUser("user_lucas", {
    plan: "free",
    status: "inactive"
  });

  const job = await createCompletedDraftJobForTest({
    ownerUserId: "user_lucas",
    templateFileName: "template.docx",
    transactionFileNames: [],
    dealInfo: "Bypass attempt"
  });

  const entitlement = await getEntitlement("user_lucas");
  const result = buildDraftResultPayload({
    job,
    entitlement,
    previewLength: 120,
    upgradeUrlOrRoute: "/pricing"
  });

  assert.equal(result.canDownload, true);
  assert.equal(result.content, job.generatedOutput);
});
