import { NextResponse } from "next/server.js";
import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
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

  if (job.status !== "complete") {
    return NextResponse.json({ error: "Draft is not ready yet." }, { status: 409 });
  }

  const repos = getRepos();
  const draft = await repos.drafts.getByIdForOrg(jobId, auth.value.orgId);
  if (!draft || draft.ownerUserId !== auth.value.userId) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const steps = (draft.traceSteps ?? []).map((step) => ({
    ...step,
    locked: false
  }));

  return NextResponse.json(
    {
      promptVersion: draft.promptVersion ?? "unknown",
      promptHash: draft.promptHash ?? "unknown",
      llmModel: draft.llmModel ?? "unknown",
      promptPreview: draft.promptPreview ?? "",
      steps
    },
    { status: 200, headers: buildSensitiveHeaders() }
  );
}
