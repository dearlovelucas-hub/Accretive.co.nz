/**
 * GET /api/drafts/:jobId/patch-plan
 *
 * Returns the stored patch plan and unresolved fields for a completed job.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";
import { getRepos } from "@/src/server/repos/index";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const repos = getRepos();

  const [job, draft] = await Promise.all([
    repos.jobs.getById(jobId),
    repos.drafts.getById(jobId)
  ]);

  if (!job || !draft) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (draft.ownerUserId !== session.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (!draft.patchPlan) {
    return NextResponse.json(
      { error: "Patch plan not yet available. Run /api/drafts/:jobId/llm-run first." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    jobId,
    status: job.status,
    patchPlan: draft.patchPlan,
    unresolved: draft.unresolved ?? [],
    llmModel: draft.llmModel
  });
}
