/**
 * GET /api/drafts/:jobId/patch-plan
 *
 * Returns the stored patch plan and unresolved fields for a completed job.
 */

import { NextRequest, NextResponse } from "next/server.js";
import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos/index";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const jobAccess = await requireResourceAccess(auth.value, "job", jobId, "read");
  if (!jobAccess.ok) {
    return jobAccess.response;
  }
  const draftAccess = await requireResourceAccess(auth.value, "draft", jobId, "read");
  if (!draftAccess.ok) {
    return draftAccess.response;
  }

  const repos = getRepos();
  const [job, draft] = await Promise.all([
    repos.jobs.getByIdForOrg(jobId, auth.value.orgId),
    repos.drafts.getByIdForOrg(jobId, auth.value.orgId)
  ]);
  if (!job || !draft) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (!draft.patchPlan) {
    return NextResponse.json(
      { error: "Patch plan not yet available. Run /api/drafts/:jobId/llm-run first." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      jobId,
      status: job.status,
      patchPlan: draft.patchPlan,
      unresolved: draft.unresolved ?? [],
      llmModel: draft.llmModel
    },
    { headers: buildSensitiveHeaders() }
  );
}
