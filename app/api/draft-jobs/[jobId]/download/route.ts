import { getDraftJob } from "@/lib/server/draftJobsStore";
import { getSessionFromRequest } from "@/lib/server/auth";
import { buildDocxFromDraftText } from "@/lib/server/docxOutput";

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
  if (job.ownerUserId !== session.userId) {
    return new Response("Job not found.", { status: 404 });
  }

  if (job.status !== "complete") {
    return new Response("Draft is not ready yet.", { status: 409 });
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = await buildDocxFromDraftText(job.generatedOutput);
  } catch {
    return new Response("Unable to prepare DOCX output.", { status: 500 });
  }

  return new Response(docxBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="accretive-generated-draft.docx"'
    }
  });
}
