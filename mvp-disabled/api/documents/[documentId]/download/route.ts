import { getSessionFromRequest } from "@/lib/server/auth";
import { getDraftJob } from "@/lib/server/draftJobsStore";
import { getStorageProvider } from "@/lib/server/storage";
import { buildDocxFromTemplateWithPreservedFormatting } from "@/lib/server/templateDocxPopulate";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function toDownloadFilename(title: string): string {
  const base = title.replace(/["/\\\r\n]+/g, " ").trim() || "document";
  return base.toLowerCase().endsWith(".docx") ? base : `${base}.docx`;
}

export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return new Response("Unauthorized.", { status: 401 });
  }

  const { documentId } = await context.params;
  const repos = getRepos();
  const doc = await repos.documents.getVisibleByIdForUser(session.userId, documentId);

  if (!doc) {
    return new Response("Document not found.", { status: 404 });
  }

  if (doc.status !== "generated") {
    return new Response("Document is not available for download.", { status: 409 });
  }

  let fileBuffer: Buffer;

  if (doc.storagePath.startsWith("draft-job:")) {
    const jobId = doc.storagePath.slice("draft-job:".length);
    const job = await getDraftJob(jobId);
    if (!job || job.status !== "complete") {
      return new Response("Draft output not found.", { status: 404 });
    }

    const uploads = await repos.uploads.listByDraftId(jobId);
    const templateUpload = uploads.find((upload) => upload.purpose === "template");
    if (!templateUpload) {
      return new Response("Template upload not found.", { status: 404 });
    }

    try {
      fileBuffer = await buildDocxFromTemplateWithPreservedFormatting({
        templateBuffer: templateUpload.content,
        generatedOutput: job.generatedOutput
      });
    } catch {
      return new Response("Unable to prepare DOCX output.", { status: 500 });
    }
  } else {
    const storage = getStorageProvider();
    try {
      fileBuffer = await storage.get(doc.storagePath);
    } catch {
      return new Response("Output file is temporarily unavailable.", { status: 503 });
    }
  }

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType || DOCX_MIME,
      "Content-Disposition": `attachment; filename="${toDownloadFilename(doc.title)}"`
    }
  });
}
