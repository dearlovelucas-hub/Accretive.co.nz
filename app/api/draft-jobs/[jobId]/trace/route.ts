import { NextResponse } from "next/server";
import { getDraftJob } from "@/lib/server/draftJobsStore";
import { getSessionFromRequest } from "@/lib/server/auth";
import { canAccessUserOwnedDocument } from "@/lib/server/privacy";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await context.params;
  const job = await getDraftJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const canAccess = await canAccessUserOwnedDocument({ session, ownerUserId: job.ownerUserId });
  if (!canAccess) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (job.status !== "complete") {
    return NextResponse.json({ error: "Draft is not ready yet." }, { status: 409 });
  }

  const steps = (job.traceSteps ?? []).map((step) => ({
    ...step,
    locked: false
  }));

  return NextResponse.json(
    {
      promptVersion: job.promptVersion ?? "unknown",
      promptHash: job.promptHash ?? "unknown",
      llmModel: job.llmModel ?? "unknown",
      promptPreview: job.promptPreview ?? "",
      steps
    },
    { status: 200 }
  );
}
