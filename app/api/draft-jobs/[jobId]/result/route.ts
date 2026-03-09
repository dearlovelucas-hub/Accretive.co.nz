import { NextResponse } from "next/server.js";
import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { buildDraftResultPayload } from "@/lib/server/draftOutput";
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
  const draft = await repos.drafts.getByIdForOrg(jobId, auth.value.orgId);
  if (!draft || draft.ownerUserId !== auth.value.userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (job.status !== "complete") {
    return NextResponse.json({ error: "Draft is not ready yet." }, { status: 409 });
  }

  const result = buildDraftResultPayload({
    job: {
      id: job.id,
      ownerUserId: draft.ownerUserId,
      status: job.status,
      templateFileName: draft.templateFileName,
      transactionFileNames: draft.transactionFileNames,
      termSheetFileName: draft.termSheetFileName,
      dealInfo: draft.dealInfo,
      generatedOutput: draft.generatedOutput,
      promptVersion: draft.promptVersion,
      promptHash: draft.promptHash,
      promptPreview: draft.promptPreview,
      llmModel: draft.llmModel,
      traceSteps: draft.traceSteps,
      progress: job.progress,
      createdAt: draft.createdAt,
      updatedAt: job.updatedAt,
      errorMessage: job.errorMessage
    },
    previewLength: 600,
    upgradeUrlOrRoute: "/pricing"
  });

  return NextResponse.json(result, { status: 200, headers: buildSensitiveHeaders() });
}
