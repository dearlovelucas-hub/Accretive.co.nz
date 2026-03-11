import { getDraftJob } from "@/lib/server/draftJobsStore";
import { getSessionFromRequest } from "@/lib/server/auth";
import { getRepos } from "@/src/server/repos";
import { buildDocxFromTemplateWithPreservedFormatting } from "@/lib/server/templateDocxPopulate";
import { canAccessUserOwnedDocument } from "@/lib/server/privacy";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return new Response("Unauthorized.", { status: 401 });
  }

  const { jobId } = await context.params;
  const job = await getDraftJob(jobId);

  if (!job) {
    return new Response("Job not found.", { status: 404 });
  }
  const canAccess = await canAccessUserOwnedDocument({ session, ownerUserId: job.ownerUserId });
  if (!canAccess) {
    return new Response("Job not found.", { status: 404 });
  }

  if (job.status !== "complete") {
    return new Response("Draft is not ready yet.", { status: 409 });
  }

  const repos = getRepos();
  const uploads = await repos.uploads.listByDraftId(jobId);
  const templateUpload = uploads.find((upload) => upload.purpose === "template");

  if (!templateUpload) {
    return new Response("Template upload not found for this job.", { status: 404 });
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = await buildDocxFromTemplateWithPreservedFormatting({
      templateBuffer: templateUpload.content,
      generatedOutput: job.generatedOutput
    });
  } catch {
    return new Response("Unable to prepare DOCX output from template.", { status: 500 });
  }

  return new Response(docxBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="accretive-generated-draft.docx"'
    }
  });
}
