import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { buildDocxFromDraftText } from "@/lib/server/docxOutput";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await context.params;
  const access = await requireResourceAccess(auth.value, "job", jobId, "download");
  if (!access.ok) {
    return access.response;
  }
  const job = access.value;

  if (job.status !== "complete") {
    return new Response("Draft is not ready yet.", { status: 409 });
  }

  const repos = getRepos();
  const draft = await repos.drafts.getByIdForOrg(jobId, auth.value.orgId);
  if (!draft || draft.ownerUserId !== auth.value.userId) {
    return new Response("Job not found.", { status: 404 });
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = await buildDocxFromDraftText(draft.generatedOutput);
  } catch {
    return new Response("Unable to prepare DOCX output.", { status: 500 });
  }

  return new Response(docxBuffer, {
    status: 200,
    headers: buildSensitiveHeaders({
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="accretive-generated-draft.docx"'
    })
  });
}
