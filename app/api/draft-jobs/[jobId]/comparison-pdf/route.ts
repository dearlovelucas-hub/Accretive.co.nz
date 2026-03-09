import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos";
import { buildComparisonPdf } from "@/lib/server/comparisonPdf";

export const runtime = "nodejs";

async function extractTemplateText(fileName: string, fileType: string, content: Buffer): Promise<string> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: content });
    return result.value || "";
  }

  if (lower.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(content);
    return result.text || "";
  }

  if (fileType.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md")) {
    return content.toString("utf8");
  }

  return "";
}

function toFilename(name: string): string {
  const base = name.replace(/["/\\\r\n]+/g, " ").trim() || "comparison";
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

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

  const uploads = await repos.uploads.listByDraftIdForOrg(jobId, auth.value.orgId);
  const templateUpload = uploads.find((upload) => upload.purpose === "template");

  if (!templateUpload) {
    return new Response("Template upload not found.", { status: 404 });
  }

  let templateText = "";
  try {
    templateText = await extractTemplateText(templateUpload.fileName, templateUpload.fileType, templateUpload.content);
  } catch {
    return new Response("Unable to read template for comparison.", { status: 500 });
  }

  const generatedText = draft.generatedOutput || "";
  const pdf = buildComparisonPdf({
    templateText,
    generatedText,
    title: "Accretive Template vs Generated Output",
    templateName: draft.templateFileName
  });

  return new Response(pdf, {
    status: 200,
    headers: buildSensitiveHeaders({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${toFilename(`${draft.templateFileName}-comparison`)}"`
    })
  });
}
