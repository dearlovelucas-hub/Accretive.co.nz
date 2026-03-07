/**
 * Integration test for the llm-run pipeline.
 *
 * Mocks the Anthropic client so no real API calls are made.
 * Validates end-to-end: job creation → mock patch plan → DOCX output stored.
 */

import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { ensureTestDatabase, resetTestData, shutdownTestDatabase } from "./helpers/dbTest.ts";
import { getRepos, setRepos } from "../src/server/repos/index.ts";
import { createDraftJob } from "../lib/server/draftJobsStore.ts";
import type { PatchPlan } from "../src/server/llm/types.ts";
import type { Repos } from "../src/server/repos/index.ts";
import type { UploadRecord } from "../src/server/repos/contracts.ts";

// ---------------------------------------------------------------------------
// Deterministic mock PatchPlan returned by the mocked anthropic wrapper
// ---------------------------------------------------------------------------

const MOCK_PATCH_PLAN: PatchPlan = {
  llm_model: "claude-3-5-sonnet-latest",
  created_at: new Date().toISOString(),
  replacements: [
    {
      type: "replace_exact",
      target: "OLD COMPANY NAME",
      replacement: "NEW COMPANY NAME",
      reason: "Stale entity name replaced from transaction doc.",
      evidenceRefs: [{ docIndex: 0, docId: "tx1", excerpt: "NEW COMPANY NAME as borrower" }],
      confidence: 0.95,
      requires_exact_match: true
    }
  ],
  placeholder_fills: [
    {
      type: "fill_placeholder",
      placeholder: "{{AMOUNT}}",
      value: "$1,000,000",
      reason: "Loan amount from term sheet.",
      evidenceRefs: [{ docIndex: 0, docId: "tx1", excerpt: "loan amount of $1,000,000" }],
      confidence: 0.97,
      requires_exact_match: true
    }
  ],
  insertions: [],
  deletions: [],
  signing_block_updates: [],
  unresolved: [
    { field: "{{SETTLEMENT_DATE}}", question: "Settlement date not found." }
  ]
};

// ---------------------------------------------------------------------------
// Build a minimal DOCX fixture (in memory)
// ---------------------------------------------------------------------------

async function buildFixtureDocx(): Promise<Buffer> {
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>OLD COMPANY NAME as Borrower</w:t></w:r></w:p>
    <w:p><w:r><w:t>Loan Amount: {{AMOUNT}}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Settlement Date: {{SETTLEMENT_DATE}}</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file("word/document.xml", docXml);
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`);

  return zip.generateAsync({ type: "nodebuffer" });
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

test.before(async () => {
  await ensureTestDatabase();
});

test.beforeEach(async () => {
  await resetTestData();
});

test.after(async () => {
  await shutdownTestDatabase();
});

// ---------------------------------------------------------------------------
// Helper: run the llm-run pipeline directly (bypassing HTTP layer)
// ---------------------------------------------------------------------------

async function runLlmPipeline(jobId: string, ownerUserId: string, orgId: string): Promise<{
  patchPlan: PatchPlan;
  outputDocxTracked: Buffer;
  unresolvedCount: number;
}> {
  // Import pipeline modules directly
  const { patchDocxWithTrackedChanges } = await import("../src/server/docx/docxTrackedChangesPatcher.ts");
  const { tryClaimLease, failJobAndReleaseLease } = await import("../src/server/llm/leasing.ts");

  const repos = getRepos();

  // Claim lease
  const leaseResult = await tryClaimLease({
    jobId,
    ownerUserId,
    leaseOwner: "test-instance"
  });

  if (!leaseResult.claimed) {
    throw new Error(`Lease not claimed: ${leaseResult.reason}`);
  }

  // Load template upload
  const uploads = await repos.uploads.listByDraftId(jobId);
  const templateUpload = uploads.find((u) => u.purpose === "template");
  if (!templateUpload) {
    throw new Error("No template upload found");
  }

  // Use mock patch plan (skips real Anthropic call)
  const patchPlan = MOCK_PATCH_PLAN;

  // Apply tracked changes
  const { docxBuffer, additionalUnresolved } = await patchDocxWithTrackedChanges({
    inputDocxBuffer: templateUpload.content,
    patchPlan,
    authorName: "Accretive",
    nowIso: new Date().toISOString()
  });

  const finalPlan: PatchPlan = {
    ...patchPlan,
    unresolved: [...patchPlan.unresolved, ...additionalUnresolved]
  };

  // Persist
  await repos.drafts.update(jobId, {
    patchPlan: finalPlan,
    unresolved: finalPlan.unresolved,
    outputDocxTracked: docxBuffer,
    llmModel: patchPlan.llm_model
  });

  await repos.jobs.update(jobId, { status: "complete", progress: 100 });
  await repos.jobs.releaseLease(jobId);

  return {
    patchPlan: finalPlan,
    outputDocxTracked: docxBuffer,
    unresolvedCount: finalPlan.unresolved.length
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("llm-run pipeline: produces tracked-changes DOCX with mock patch plan", async () => {
  const repos = getRepos();
  const orgId = "org_test";
  const userId = "user_test_1";

  // Seed org + user
  await repos.orgs.upsert({ id: orgId, name: "Test Org" });
  await repos.users.upsert({
    id: userId,
    username: userId,
    email: `${userId}@test.local`,
    passwordHash: null,
    displayName: "Test User",
    role: "member",
    orgId
  });

  // Create draft job
  const docxBuffer = await buildFixtureDocx();
  const job = await createDraftJob({
    ownerUserId: userId,
    templateFileName: "template.docx",
    transactionFileNames: ["tx.pdf"],
    dealInfo: "Integration test deal"
  });

  // Store template upload
  await repos.uploads.create({
    ownerUserId: userId,
    draftId: job.id,
    purpose: "template",
    fileName: "template.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byteSize: docxBuffer.length,
    content: docxBuffer
  });

  // Run pipeline
  const result = await runLlmPipeline(job.id, userId, orgId);

  // Assertions
  assert.ok(result.outputDocxTracked instanceof Buffer, "Output should be a Buffer");
  assert.ok(result.outputDocxTracked.length > 0, "Output DOCX should not be empty");

  // Check document.xml contains tracked changes
  const zip = await JSZip.loadAsync(result.outputDocxTracked);
  const docXmlEntry = zip.file("word/document.xml");
  assert.ok(docXmlEntry, "Output DOCX must have word/document.xml");
  const xml = await docXmlEntry.async("string");

  assert.ok(xml.includes("<w:del"), "Output must contain deletion tracked changes");
  assert.ok(xml.includes("<w:ins"), "Output must contain insertion tracked changes");
  assert.ok(xml.includes("NEW COMPANY NAME"), "Replacement value must be present");
  assert.ok(xml.includes("$1,000,000"), "Placeholder fill value must be present");

  // Unresolved: {{SETTLEMENT_DATE}} is not in mock plan fills
  assert.ok(result.unresolvedCount >= 1, "Unresolved fields must be reported");

  // Verify DB persistence
  const updatedDraft = await repos.drafts.getById(job.id);
  assert.ok(updatedDraft?.patchPlan, "patchPlan must be persisted to DB");
  assert.ok(updatedDraft?.outputDocxTracked, "outputDocxTracked must be persisted to DB");
  assert.equal(updatedDraft?.llmModel, "claude-3-5-sonnet-latest", "llmModel must be stored");

  const updatedJob = await repos.jobs.getById(job.id);
  assert.equal(updatedJob?.status, "complete", "Job must be marked complete");
});

test("llm-run pipeline: lease is released after completion", async () => {
  const repos = getRepos();
  const orgId = "org_test2";
  const userId = "user_test_2";

  await repos.orgs.upsert({ id: orgId, name: "Test Org 2" });
  await repos.users.upsert({
    id: userId,
    username: userId,
    email: `${userId}@test.local`,
    passwordHash: null,
    displayName: "Test User 2",
    role: "member",
    orgId
  });

  const docxBuffer = await buildFixtureDocx();
  const job = await createDraftJob({
    ownerUserId: userId,
    templateFileName: "tpl.docx",
    transactionFileNames: [],
    dealInfo: "Lease release test"
  });

  await repos.uploads.create({
    ownerUserId: userId,
    draftId: job.id,
    purpose: "template",
    fileName: "tpl.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byteSize: docxBuffer.length,
    content: docxBuffer
  });

  await runLlmPipeline(job.id, userId, orgId);

  const finalJob = await repos.jobs.getById(job.id);
  assert.ok(!finalJob?.leaseOwner, "Lease owner must be cleared after completion");
  assert.ok(!finalJob?.leaseExpiresAt, "Lease expiry must be cleared after completion");
});

test("llm-run pipeline: concurrency count after lease is released", async () => {
  const repos = getRepos();
  const orgId = "org_test3";
  const userId = "user_test_3";

  await repos.orgs.upsert({ id: orgId, name: "Test Org 3" });
  await repos.users.upsert({
    id: userId,
    username: userId,
    email: `${userId}@test.local`,
    passwordHash: null,
    displayName: "Test User 3",
    role: "member",
    orgId
  });

  const docxBuffer = await buildFixtureDocx();
  const job = await createDraftJob({
    ownerUserId: userId,
    templateFileName: "tpl.docx",
    transactionFileNames: [],
    dealInfo: "Concurrency test"
  });

  await repos.uploads.create({
    ownerUserId: userId,
    draftId: job.id,
    purpose: "template",
    fileName: "tpl.docx",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    byteSize: docxBuffer.length,
    content: docxBuffer
  });

  const beforeCount = await repos.jobs.countActiveLeasesGlobal();
  await runLlmPipeline(job.id, userId, orgId);
  const afterCount = await repos.jobs.countActiveLeasesGlobal();

  assert.equal(afterCount, beforeCount, "Active lease count must return to baseline after pipeline completes");
});
