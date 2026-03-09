/**
 * POST /api/drafts/:jobId/llm-run
 *
 * Triggers the two-step LLM patch-plan generation and applies it to the
 * original template DOCX as tracked changes.
 *
 * Concurrency:
 *  - Atomically claims a DB lease before calling Anthropic.
 *  - Respects per-org and global concurrency caps.
 *  - Idempotent: if the job is already complete returns the existing output.
 */

import { NextRequest, NextResponse } from "next/server.js";
import * as crypto from "node:crypto";
import {
  buildSensitiveHeaders,
  requireCsrfProtection,
  requireOrgMembership,
  requireResourceAccess
} from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos/index";
import { tryClaimLease, failJobAndReleaseLease } from "@/src/server/llm/leasing";
import { generatePatchPlan, buildFallbackPatchPlan } from "@/src/server/llm/anthropicWrapper";
import { patchDocxWithTrackedChanges } from "@/src/server/docx/docxTrackedChangesPatcher";
import type { PatchPlan, UnresolvedField } from "@/src/server/llm/types";

const MAX_TEXT_CHARS = 20_000;

// ---------------------------------------------------------------------------
// Text extraction (reuse pattern from draftProcessor.ts)
// ---------------------------------------------------------------------------

async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value.slice(0, MAX_TEXT_CHARS);
    } catch {
      return "";
    }
  }

  if (lower.endsWith(".pdf")) {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buffer);
      return result.text.slice(0, MAX_TEXT_CHARS);
    } catch {
      return "";
    }
  }

  // Plain text fallback
  return buffer.toString("utf-8").slice(0, MAX_TEXT_CHARS);
}

function detectPlaceholders(text: string): string[] {
  const patterns = [/\{\{([^}]{2,80})\}\}/g, /\[([^\]]{2,80})\]/g, /<([^>]{2,80})>/g];
  const matches = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const field = (match[1] ?? "").trim();
      if (field) {
        matches.add(match[0]); // keep full token e.g. {{FIELD}}
      }
    }
  }
  return [...matches].slice(0, 30);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }
  const csrf = requireCsrfProtection(request);
  if (!csrf.ok) {
    return csrf.response;
  }

  const { jobId } = await params;
  const jobAccess = await requireResourceAccess(auth.value, "job", jobId, "run");
  if (!jobAccess.ok) {
    return jobAccess.response;
  }
  const draftAccess = await requireResourceAccess(auth.value, "draft", jobId, "run");
  if (!draftAccess.ok) {
    return draftAccess.response;
  }

  const repos = getRepos();

  // ------------------------------------------------------------------
  // Load job + draft
  // ------------------------------------------------------------------
  const [job, draft] = await Promise.all([
    repos.jobs.getByIdForOrg(jobId, auth.value.orgId),
    repos.drafts.getByIdForOrg(jobId, auth.value.orgId)
  ]);

  if (!job || !draft) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const orgId = auth.value.orgId;

  // ------------------------------------------------------------------
  // Idempotency: already complete with tracked output
  // ------------------------------------------------------------------
  if (job.status === "complete" && draft.patchPlan && draft.outputDocxTracked) {
    return NextResponse.json(
      {
        jobId,
        status: "complete",
        patchPlan: draft.patchPlan,
        unresolved: draft.unresolved ?? [],
        message: "Already complete."
      },
      { headers: buildSensitiveHeaders() }
    );
  }

  // ------------------------------------------------------------------
  // If currently processing by someone else, return 202
  // ------------------------------------------------------------------
  if (job.status === "processing" && job.leaseExpiresAt) {
    const expiresAt = new Date(job.leaseExpiresAt).getTime();
    if (expiresAt > Date.now()) {
      return NextResponse.json(
        { jobId, status: "processing", message: "Job is being processed." },
        { status: 202 }
      );
    }
  }

  // ------------------------------------------------------------------
  // Claim lease + enforce concurrency caps
  // ------------------------------------------------------------------
  const leaseOwner = `instance-${crypto.randomUUID().slice(0, 8)}`;
  const leaseResult = await tryClaimLease({
    jobId,
    ownerUserId: draft.ownerUserId,
    leaseOwner
  });

  if (!leaseResult.claimed) {
    if (leaseResult.reason === "cap_global" || leaseResult.reason === "cap_per_org") {
      return NextResponse.json(
        { error: "Too many concurrent jobs. Please retry shortly.", reason: leaseResult.reason },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((leaseResult.retryAfterMs ?? 5_000) / 1_000))
          }
        }
      );
    }
    if (leaseResult.reason === "max_attempts") {
      return NextResponse.json(
        { error: "Job has exceeded maximum retry attempts and is permanently failed." },
        { status: 409 }
      );
    }
    // not_claimable — job may be complete or failed
    return NextResponse.json(
      { jobId, status: job.status, message: "Job cannot be claimed." },
      { status: 409 }
    );
  }

  // ------------------------------------------------------------------
  // Load uploads (template + transaction docs)
  // ------------------------------------------------------------------
  let uploads;
  try {
    uploads = await repos.uploads.listByDraftIdForOrg(jobId, auth.value.orgId);
  } catch (err) {
    await failJobAndReleaseLease({
      jobId,
      errorMessage: "Failed to load uploads.",
      errorCode: "UPLOADS_LOAD_ERROR"
    });
    throw err;
  }

  const templateUpload = uploads.find((u) => u.purpose === "template");
  const transactionUploads = uploads.filter((u) => u.purpose === "transaction");

  if (!templateUpload) {
    await failJobAndReleaseLease({
      jobId,
      errorMessage: "No template upload found for this job.",
      errorCode: "NO_TEMPLATE"
    });
    return NextResponse.json({ error: "No template upload found." }, { status: 422 });
  }

  // ------------------------------------------------------------------
  // Extract text from all documents
  // ------------------------------------------------------------------
  let templateText: string;
  let transactionTexts: { id: string; text: string }[];

  try {
    [templateText, ...transactionTexts] = await Promise.all([
      extractText(templateUpload.content, templateUpload.fileName).then((t) => t),
      ...transactionUploads.map(async (u) => ({
        id: u.id,
        text: await extractText(u.content, u.fileName)
      }))
    ]);
  } catch (err) {
    await failJobAndReleaseLease({
      jobId,
      errorMessage: "Text extraction failed.",
      errorCode: "EXTRACTION_ERROR"
    });
    throw err;
  }

  const placeholderList = detectPlaceholders(templateText);

  // ------------------------------------------------------------------
  // Generate patch plan (or use fallback)
  // ------------------------------------------------------------------
  let patchPlan: PatchPlan;
  let modelTrace: object | undefined;

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      patchPlan = buildFallbackPatchPlan({ placeholderList, metadata: { jobId } });
    } else {
      const result = await generatePatchPlan({
        templateText,
        transactionTexts,
        otherInfo: draft.dealInfo || undefined,
        placeholderList,
        constraints: { jurisdiction: "NZ", noNewClauses: true },
        metadata: { jobId, orgId, userId: auth.value.userId }
      });
      patchPlan = result.patchPlan;
      modelTrace = result.modelTrace;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM generation failed.";
    await failJobAndReleaseLease({ jobId, errorMessage: msg, errorCode: "LLM_ERROR" });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // ------------------------------------------------------------------
  // Apply tracked changes to DOCX
  // ------------------------------------------------------------------
  let outputDocxBuffer: Buffer;
  let additionalUnresolved: UnresolvedField[] = [];

  try {
    const patchResult = await patchDocxWithTrackedChanges({
      inputDocxBuffer: templateUpload.content,
      patchPlan,
      authorName: "Accretive",
      nowIso: new Date().toISOString()
    });
    outputDocxBuffer = patchResult.docxBuffer;
    additionalUnresolved = patchResult.additionalUnresolved;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DOCX patching failed.";
    await failJobAndReleaseLease({ jobId, errorMessage: msg, errorCode: "DOCX_PATCH_ERROR" });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Merge additional unresolved into the patch plan
  const mergedPatchPlan: PatchPlan = {
    ...patchPlan,
    unresolved: [...patchPlan.unresolved, ...additionalUnresolved]
  };

  // ------------------------------------------------------------------
  // Persist output + mark complete
  // ------------------------------------------------------------------
  try {
    await repos.drafts.update(jobId, {
      patchPlan: mergedPatchPlan,
      unresolved: mergedPatchPlan.unresolved,
      modelTrace: modelTrace ?? null,
      outputDocxTracked: outputDocxBuffer,
      llmModel: mergedPatchPlan.llm_model
    });

    await repos.jobs.update(jobId, {
      status: "complete",
      progress: 100
    });

    // Release lease on success (status is "complete" so it can't be re-claimed)
    await repos.jobs.releaseLease(jobId);
  } catch (err) {
    await failJobAndReleaseLease({ jobId, errorMessage: "Failed to persist output.", errorCode: "PERSIST_ERROR" });
    throw err;
  }

  return NextResponse.json(
    {
      jobId,
      status: "complete",
      patchPlan: mergedPatchPlan,
      unresolved: mergedPatchPlan.unresolved,
      unresolvedCount: mergedPatchPlan.unresolved.length
    },
    { headers: buildSensitiveHeaders() }
  );
}
