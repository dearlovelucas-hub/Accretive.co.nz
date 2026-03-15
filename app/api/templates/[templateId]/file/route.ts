import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getStorageProvider } from "@/lib/server/storage";

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

  const template = access.value;
  const fileName = toSafeFilename(template.fileName);
  const fileType = template.fileType || "application/octet-stream";

  let fileBuffer: Buffer;
  try {
    fileBuffer = await getStorageProvider().get(template.storageKey);
  } catch {
    return new Response("Template source file is unavailable.", { status: 404 });
  }

  return new Response(fileBuffer, {
    status: 200,
    headers: buildSensitiveHeaders({
      "Content-Type": fileType,
      "Content-Disposition": `attachment; filename="${fileName}"`
    })
  });
}
