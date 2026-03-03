import { getSessionFromRequest } from "@/lib/server/auth";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

function toSafeFilename(name: string): string {
  const cleaned = name.replace(/["/\\\r\n]+/g, " ").trim();
  return cleaned || "template";
}

export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return new Response("Unauthorized.", { status: 401 });
  }

  const { templateId } = await context.params;
  const repos = getRepos();

  const template = await repos.templates.findByIdForOwner(templateId, session.userId);
  if (!template) {
    return new Response("Template not found.", { status: 404 });
  }

  if (!template.uploadId) {
    return new Response("Template source file is unavailable.", { status: 404 });
  }

  const upload = await repos.uploads.getByIdForOwner(template.uploadId, session.userId);
  if (!upload) {
    return new Response("Template source file is unavailable.", { status: 404 });
  }

  const fileName = toSafeFilename(template.fileName || upload.fileName);
  const fileType = template.fileType || upload.fileType || "application/octet-stream";

  return new Response(upload.content, {
    status: 200,
    headers: {
      "Content-Type": fileType,
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, max-age=60"
    }
  });
}
