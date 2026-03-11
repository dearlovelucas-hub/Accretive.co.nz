import { NextResponse } from "next/server";
import { getDraftJob } from "@/lib/server/draftJobsStore";
import { getSessionFromRequest } from "@/lib/server/auth";
import { buildDraftResultPayload } from "@/lib/server/draftOutput";
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
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (job.status !== "complete") {
    return NextResponse.json({ error: "Draft is not ready yet." }, { status: 409 });
  }

  const result = buildDraftResultPayload({
    job,
    previewLength: 600,
    upgradeUrlOrRoute: "/pricing"
  });

  return NextResponse.json(result, { status: 200 });
}
