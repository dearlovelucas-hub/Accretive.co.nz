import { NextResponse } from "next/server.js";
import { requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await context.params;
  const access = await requireResourceAccess(auth.value, "job", jobId, "read");
  if (!access.ok) {
    return access.response;
  }
  const job = access.value;

  const repos = getRepos();
  const draft = await repos.drafts.getByIdForOrg(job.id, auth.value.orgId);
  if (!draft || draft.ownerUserId !== auth.value.userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      id: job.id,
      status: job.status,
      progress: job.progress,
      templateFileName: draft.templateFileName,
      transactionFileNames: draft.transactionFileNames,
      termSheetFileName: draft.termSheetFileName,
      updatedAt: job.updatedAt,
      errorMessage: job.errorMessage
    },
    { status: 200 }
  );
}
