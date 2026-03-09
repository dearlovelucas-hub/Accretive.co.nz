/**
 * POST /api/drafts/:jobId/resolve
 *
 * Accepts user answers for unresolved fields, then re-applies the patch
 * plan (augmented with the answers) WITHOUT calling the model again.
 *
 * Request body:
 * {
 *   answers: { [field: string]: string }
 * }
 */

import { NextRequest, NextResponse } from "next/server.js";
import { buildSensitiveHeaders, requireCsrfProtection, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos/index";
import { patchDocxWithTrackedChanges } from "@/src/server/docx/docxTrackedChangesPatcher";
import type { PatchPlan, FillPlaceholderOp, UnresolvedField } from "@/src/server/llm/types";
import { validatePatchPlan } from "@/src/server/llm/types";

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
  const jobAccess = await requireResourceAccess(auth.value, "job", jobId, "write");
  if (!jobAccess.ok) {
    return jobAccess.response;
  }
  const draftAccess = await requireResourceAccess(auth.value, "draft", jobId, "write");
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

  if (!draft.patchPlan) {
    return NextResponse.json(
      { error: "No patch plan found. Run llm-run first." },
      { status: 409 }
    );
  }

  if (!validatePatchPlan(draft.patchPlan)) {
    return NextResponse.json({ error: "Stored patch plan is invalid." }, { status: 500 });
  }

  // ------------------------------------------------------------------
  // Parse answers
  // ------------------------------------------------------------------
  let body: { answers?: Record<string, string> };
  try {
    body = (await request.json()) as { answers?: Record<string, string> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const answers = body.answers ?? {};
  if (typeof answers !== "object" || Array.isArray(answers)) {
    return NextResponse.json({ error: "'answers' must be an object mapping field names to string values." }, { status: 400 });
  }

  // ------------------------------------------------------------------
  // Build augmented patch plan
  // ------------------------------------------------------------------
  const existingPlan = draft.patchPlan as PatchPlan;

  // Convert answered unresolved fields into placeholder_fills
  const newFills: FillPlaceholderOp[] = Object.entries(answers)
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .map(([field, value]) => ({
      type: "fill_placeholder" as const,
      placeholder: field,
      value: value.trim(),
      reason: "Resolved by user answer.",
      evidenceRefs: [],
      confidence: 1.0,
      requires_exact_match: true as const
    }));

  // Remove resolved fields from unresolved list
  const answeredFields = new Set(Object.keys(answers));
  const remainingUnresolved: UnresolvedField[] = existingPlan.unresolved.filter(
    (u) => !answeredFields.has(u.field)
  );

  const augmentedPlan: PatchPlan = {
    ...existingPlan,
    placeholder_fills: [...existingPlan.placeholder_fills, ...newFills],
    unresolved: remainingUnresolved
  };

  // ------------------------------------------------------------------
  // Load template upload and re-apply
  // ------------------------------------------------------------------
  const uploads = await repos.uploads.listByDraftIdForOrg(jobId, auth.value.orgId);
  const templateUpload = uploads.find((u) => u.purpose === "template");

  if (!templateUpload) {
    return NextResponse.json({ error: "Template upload not found." }, { status: 422 });
  }

  let outputDocxBuffer: Buffer;
  let additionalUnresolved: UnresolvedField[];

  try {
    const patchResult = await patchDocxWithTrackedChanges({
      inputDocxBuffer: templateUpload.content,
      patchPlan: augmentedPlan,
      authorName: "Accretive",
      nowIso: new Date().toISOString()
    });
    outputDocxBuffer = patchResult.docxBuffer;
    additionalUnresolved = patchResult.additionalUnresolved;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DOCX patching failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const finalPlan: PatchPlan = {
    ...augmentedPlan,
    unresolved: [...augmentedPlan.unresolved, ...additionalUnresolved]
  };

  // ------------------------------------------------------------------
  // Persist updated output
  // ------------------------------------------------------------------
  await repos.drafts.update(jobId, {
    patchPlan: finalPlan,
    unresolved: finalPlan.unresolved,
    outputDocxTracked: outputDocxBuffer
  });

  return NextResponse.json(
    {
      jobId,
      status: "complete",
      resolvedCount: newFills.length,
      remainingUnresolved: finalPlan.unresolved,
      unresolvedCount: finalPlan.unresolved.length
    },
    { headers: buildSensitiveHeaders() }
  );
}
