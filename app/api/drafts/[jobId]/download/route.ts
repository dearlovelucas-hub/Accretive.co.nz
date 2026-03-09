/**
 * GET /api/drafts/:jobId/download?variant=tracked
 *
 * Downloads the tracked-changes DOCX for a completed job.
 * Supports ?variant=tracked (tracked changes output from llm-run).
 *
 * RLS: org admins see org-wide; members only their own.
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
  const variant = request.nextUrl.searchParams.get("variant") ?? "tracked";

  if (variant !== "tracked") {
    return NextResponse.json(
      { error: `Unknown variant "${variant}". Only "tracked" is supported on this endpoint.` },
      { status: 400 }
    );
  }

  const jobAccess = await requireResourceAccess(auth.value, "job", jobId, "download");
  if (!jobAccess.ok) {
    return jobAccess.response;
  }
  const draftAccess = await requireResourceAccess(auth.value, "draft", jobId, "download");
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

  if (job.status !== "complete") {
    return NextResponse.json(
      { error: "Job is not complete yet.", status: job.status },
      { status: 409 }
    );
  }

  if (!draft.outputDocxTracked) {
    return NextResponse.json(
      { error: "Tracked-changes DOCX not available. Run /api/drafts/:jobId/llm-run first." },
      { status: 404 }
    );
  }

  const safeName = draft.templateFileName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.(docx|pdf)$/i, "");

  return new NextResponse(draft.outputDocxTracked, {
    status: 200,
    headers: buildSensitiveHeaders({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName}_tracked-changes.docx"`,
      "Content-Length": String(draft.outputDocxTracked.byteLength)
    })
  });
}
