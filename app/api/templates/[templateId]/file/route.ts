import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

function toSafeFilename(name: string): string {
  const cleaned = name.replace(/["/\\\r\n]+/g, " ").trim();
  return cleaned || "template";
}

export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { templateId } = await context.params;
  const access = await requireResourceAccess(auth.value, "template", templateId, "download");
  if (!access.ok) {
    return access.response;
  }

  const repos = getRepos();
  const template = access.value;

  if (!template.uploadId) {
    return new Response("Template source file is unavailable.", { status: 404 });
  }

  const upload = await repos.uploads.getByIdForOrg(template.uploadId, auth.value.orgId);
  if (!upload || upload.ownerUserId !== auth.value.userId) {
    return new Response("Template source file is unavailable.", { status: 404 });
  }

  const fileName = toSafeFilename(template.fileName || upload.fileName);
  const fileType = template.fileType || upload.fileType || "application/octet-stream";

  return new Response(upload.content, {
    status: 200,
    headers: buildSensitiveHeaders({
      "Content-Type": fileType,
      "Content-Disposition": `attachment; filename="${fileName}"`
    })
  });
}
