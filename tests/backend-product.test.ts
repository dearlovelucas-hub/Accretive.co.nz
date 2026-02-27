import test from "node:test";
import assert from "node:assert/strict";
import { validateDraftJobInput } from "../lib/server/validation.ts";
import { createCompletedDraftJobForTest, listDraftJobsByOwner } from "../lib/server/draftJobsStore.ts";
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

test("draft validation requires at least one transaction document", () => {
  const result = validateDraftJobInput({
    templateFileName: "base-template.docx",
    dealInfo: "Deal information",
    transactionDocumentCount: 0
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.message, "At least one transaction document is required.");
  }
});

test("draft jobs are listed only for their owner", async () => {
  await createCompletedDraftJobForTest({
    ownerUserId: "user_owner_a",
    templateFileName: "template-a.docx",
    transactionFileNames: ["tx-a.pdf"],
    dealInfo: "Owner A draft"
  });

  await createCompletedDraftJobForTest({
    ownerUserId: "user_owner_b",
    templateFileName: "template-b.docx",
    transactionFileNames: ["tx-b.pdf"],
    dealInfo: "Owner B draft"
  });

  const ownerAJobs = await listDraftJobsByOwner("user_owner_a");
  assert.equal(ownerAJobs.some((job) => job.ownerUserId !== "user_owner_a"), false);
  assert.ok(ownerAJobs.length >= 1);
});
