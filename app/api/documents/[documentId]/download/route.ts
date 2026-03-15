import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getStorageProvider } from "@/lib/server/storage";

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

  let fileBuffer: Buffer;
  const storage = getStorageProvider();
  try {
    fileBuffer = await storage.get(doc.storagePath);
  } catch {
    return new Response("Output file is temporarily unavailable.", { status: 503 });
  }

  return new Response(fileBuffer, {
    status: 200,
    headers: buildSensitiveHeaders({
      "Content-Type": doc.mimeType || DOCX_MIME,
      "Content-Disposition": `attachment; filename="${toDownloadFilename(doc.title)}"`
    })
  });
}
