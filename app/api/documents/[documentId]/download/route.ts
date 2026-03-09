import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
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
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { documentId } = await context.params;
  const docAccess = await requireResourceAccess(auth.value, "document", documentId, "download");
  if (!docAccess.ok) {
    return docAccess.response;
  }
  const doc = docAccess.value;

  if (doc.status !== "generated") {
    return new Response("Document is not available for download.", { status: 409 });
  }

  const repos = getRepos();
  let fileBuffer: Buffer;

  if (doc.storagePath.startsWith("draft-job:")) {
    const jobId = doc.storagePath.slice("draft-job:".length);
    const jobAccess = await requireResourceAccess(auth.value, "job", jobId, "download");
    if (!jobAccess.ok) {
      return jobAccess.response;
    }

    if (jobAccess.value.status !== "complete") {
      return new Response("Draft output not found.", { status: 404 });
    }

    const draft = await repos.drafts.getByIdForOrg(jobId, auth.value.orgId);
    if (!draft || draft.ownerUserId !== auth.value.userId) {
      return new Response("Draft output not found.", { status: 404 });
    }

    const uploads = await repos.uploads.listByDraftIdForOrg(jobId, auth.value.orgId);
    const templateUpload = uploads.find((upload) => upload.purpose === "template");
    if (!templateUpload) {
      return new Response("Template upload not found.", { status: 404 });
    }

    try {
      fileBuffer = await buildDocxFromTemplateWithPreservedFormatting({
        templateBuffer: templateUpload.content,
        generatedOutput: draft.generatedOutput
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
    headers: buildSensitiveHeaders({
      "Content-Type": doc.mimeType || DOCX_MIME,
      "Content-Disposition": `attachment; filename="${toDownloadFilename(doc.title)}"`
    })
  });
}
