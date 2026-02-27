import test from "node:test";
import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { ensureTestDatabase, resetTestData, shutdownTestDatabase } from "./helpers/dbTest.ts";
import { getRepos } from "../src/server/repos/index.ts";
import { extractContextFromTermSheet, DealContextSchema } from "../lib/server/termSheetExtraction.ts";
import { generateEditPlan, EditPlanSchema } from "../lib/server/editPlanGeneration.ts";
import { requireOrgSession } from "../lib/server/orgAuth.ts";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

test.before(async () => {
  await ensureTestDatabase();
});

test.beforeEach(async () => {
  await resetTestData();
  // Ensure fallback paths are exercised (no real Claude calls in tests)
  delete process.env.ANTHROPIC_API_KEY;
});

test.after(async () => {
  await shutdownTestDatabase();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createOrgAndUser(suffix: string): Promise<{ orgId: string; userId: string }> {
  const repos = getRepos();
  const orgId = `org_test_${suffix}`;
  const userId = `user_test_${suffix}`;
  await repos.orgs.upsert({ id: orgId, name: `Test Org ${suffix}` });
  await repos.users.upsert({
    id: userId,
    email: `user_${suffix}@accretive.local`,
    username: `user_${suffix}`,
    passwordHash: "testhash",
    displayName: "Test User",
    role: "member",
    orgId
  });
  return { orgId, userId };
}

async function createMatter(orgId: string, userId: string, title: string): Promise<string> {
  const repos = getRepos();
  const matter = await repos.matters.create({
    id: crypto.randomUUID(),
    orgId,
    userId,
    title
  });
  return matter.id;
}

// ---------------------------------------------------------------------------
// (a) Term sheet extraction returns valid DealContext schema with no API key
// ---------------------------------------------------------------------------

test("term sheet extraction returns a valid DealContext when ANTHROPIC_API_KEY is absent (fallback)", async () => {
  const result = await extractContextFromTermSheet(
    "TERM SHEET\nVendor: Acme Ltd\nPurchaser: Beta Corp\nPrice: $1,000,000\nClosing: 2026-03-31"
  );

  const parsed = DealContextSchema.safeParse(result);
  assert.ok(parsed.success, `DealContext failed schema: ${JSON.stringify(parsed.error ?? null)}`);
});

// ---------------------------------------------------------------------------
// (b) Edit plan generation returns EditPlan with operations array
// ---------------------------------------------------------------------------

test("edit plan generation returns valid EditPlan with empty operations when ANTHROPIC_API_KEY is absent (fallback)", async () => {
  const mockContext = DealContextSchema.parse({});
  const result = await generateEditPlan(
    "This is a precedent document.\n\nParties: [PARTY A] and [PARTY B].\n\nDate: [DATE].",
    mockContext
  );

  const parsed = EditPlanSchema.safeParse(result);
  assert.ok(parsed.success, `EditPlan failed schema: ${JSON.stringify(parsed.error ?? null)}`);
  assert.ok(Array.isArray(result.operations));
  assert.equal(result.operations.length, 0, "Fallback should return empty operations");
});

// ---------------------------------------------------------------------------
// (c) Tenant isolation: org A's matter is invisible to org B
// ---------------------------------------------------------------------------

test("matter from org A is not accessible to org B via findByIdAndOrg", async () => {
  const orgA = await createOrgAndUser("isolation_a");
  const orgB = await createOrgAndUser("isolation_b");

  const matterId = await createMatter(orgA.orgId, orgA.userId, "Org A Secret Matter");

  const repos = getRepos();
  const resultForOrgB = await repos.matters.findByIdAndOrg(matterId, orgB.orgId);
  assert.equal(resultForOrgB, null, "Org B should not be able to see org A's matter");

  const resultForOrgA = await repos.matters.findByIdAndOrg(matterId, orgA.orgId);
  assert.ok(resultForOrgA, "Org A should be able to see its own matter");
});

// ---------------------------------------------------------------------------
// (d) Job ownership: a job created for user A is not owned by user B
// ---------------------------------------------------------------------------

test("job ownerUserId reflects the creating user, not an unrelated user", async () => {
  const orgA = await createOrgAndUser("owner_a");
  const { userId: userB } = await createOrgAndUser("owner_b");

  const matterId = await createMatter(orgA.orgId, orgA.userId, "Ownership Test Matter");

  const repos = getRepos();
  const jobId = crypto.randomUUID();
  await repos.jobs.create({
    id: jobId,
    ownerUserId: orgA.userId,
    matterId,
    status: "queued",
    progress: 4
  });

  const job = await repos.jobs.getById(jobId);
  assert.ok(job, "Job should exist");
  assert.equal(job.ownerUserId, orgA.userId);
  assert.notEqual(job.ownerUserId, userB, "User B should not own org A's job");
});

// ---------------------------------------------------------------------------
// (e) Idempotency: a completed job is discoverable via listByMatter
// ---------------------------------------------------------------------------

test("listByMatter returns the completed job for idempotency check", async () => {
  const { orgId, userId } = await createOrgAndUser("idempotent");
  const matterId = await createMatter(orgId, userId, "Idempotency Test Matter");

  const repos = getRepos();

  const jobId = crypto.randomUUID();
  await repos.jobs.create({
    id: jobId,
    ownerUserId: userId,
    matterId,
    status: "complete",
    progress: 100
  });

  await repos.draftOutputs.create({
    id: crypto.randomUUID(),
    jobId,
    orgId,
    storageKey: `${orgId}/matters/${matterId}/OUTPUT/precedent-populated.docx`,
    filename: "precedent-populated.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 512
  });

  const jobs = await repos.jobs.listByMatter(matterId);
  const completeJob = jobs.find((j) => j.status === "complete");
  assert.ok(completeJob, "listByMatter should return the completed job");
  assert.equal(completeJob.id, jobId);

  const output = await repos.draftOutputs.getByJobId(completeJob.id);
  assert.ok(output, "Draft output should exist for completed job");
  assert.equal(output.jobId, jobId);
});

// ---------------------------------------------------------------------------
// (f) Authentication required: requireOrgSession rejects requests without a cookie
// ---------------------------------------------------------------------------

test("requireOrgSession returns 401 for request with no session cookie", async () => {
  const requestWithoutCookie = new Request("http://localhost/api/jobs/fake-id/output", {
    method: "GET"
  });

  const result = await requireOrgSession(requestWithoutCookie);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.status, 401);
  }
});

// ---------------------------------------------------------------------------
// (g) ExtractionCache: second extraction uses cached result
// ---------------------------------------------------------------------------

test("extraction cache stores and retrieves extracted JSON by uploadId", async () => {
  const { orgId, userId } = await createOrgAndUser("cache_test");
  const matterId = await createMatter(orgId, userId, "Cache Test Matter");

  const repos = getRepos();

  // Create a matter upload record (without actual file on disk)
  const uploadId = crypto.randomUUID();
  await repos.matterUploads.create({
    id: uploadId,
    matterId,
    orgId,
    userId,
    kind: "TERMSHEET",
    filename: "termsheet.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    sha256: crypto.createHash("sha256").update("test").digest("hex"),
    storageKey: `${orgId}/matters/${matterId}/TERMSHEET/termsheet.pdf`,
    retained: true
  });

  const cachedJson = JSON.stringify({ transactionType: "Share Sale", parties: [] });
  await repos.extractionCache.create({
    id: crypto.randomUUID(),
    uploadId,
    extractedText: "term sheet text",
    extractedJson: cachedJson
  });

  const cached = await repos.extractionCache.getByUploadId(uploadId);
  assert.ok(cached, "Cache entry should exist");
  assert.equal(cached.extractedJson, cachedJson);
});
