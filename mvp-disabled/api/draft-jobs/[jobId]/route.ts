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
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      id: job.id,
      status: job.status,
      progress: job.progress,
      templateFileName: job.templateFileName,
      transactionFileNames: job.transactionFileNames,
      termSheetFileName: job.termSheetFileName,
      updatedAt: job.updatedAt,
      errorMessage: job.errorMessage
    },
    { status: 200 }
  );
}
