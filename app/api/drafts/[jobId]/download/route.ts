/**
 * GET /api/drafts/:jobId/download?variant=tracked
 *
 * Downloads the tracked-changes DOCX for a completed job.
 * Supports ?variant=tracked (tracked changes output from llm-run).
 *
 * RLS: org admins see org-wide; members only their own.
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
  const variant = request.nextUrl.searchParams.get("variant") ?? "tracked";

  if (variant !== "tracked") {
    return NextResponse.json(
      { error: `Unknown variant "${variant}". Only "tracked" is supported on this endpoint.` },
      { status: 400 }
    );
  }

  const repos = getRepos();

  const [job, draft] = await Promise.all([
    repos.jobs.getById(jobId),
    repos.drafts.getById(jobId)
  ]);

  if (!job || !draft) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  // RLS: members can only see their own; admins can see org-wide
  if (session.role !== "admin" && draft.ownerUserId !== session.userId) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeName}_tracked-changes.docx"`,
      "Content-Length": String(draft.outputDocxTracked.byteLength)
    }
  });
}
