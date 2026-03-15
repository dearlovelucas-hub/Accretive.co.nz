import { NextResponse } from "next/server.js";
import { requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getStorageProvider } from "@/lib/server/storage";

const MAX_PREVIEW_CHARS = 12000;

export const runtime = "nodejs";

function isTextLike(fileName: string, fileType: string): boolean {
  if (fileType.startsWith("text/")) {
    return true;
  }

  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".json") ||
    lower.endsWith(".xml")
  );
}

async function extractPreviewText(fileName: string, fileType: string, content: Buffer): Promise<string | null> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: content });
    return result.value.trim() ? result.value.slice(0, MAX_PREVIEW_CHARS) : null;
  }

  if (lower.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(content);
    return result.text.trim() ? result.text.slice(0, MAX_PREVIEW_CHARS) : null;
  }

  if (isTextLike(fileName, fileType)) {
    const text = content.toString("utf8").trim();
    return text ? text.slice(0, MAX_PREVIEW_CHARS) : null;
  }

  return null;
}

export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { templateId } = await context.params;
  const access = await requireResourceAccess(auth.value, "template", templateId, "read");
  if (!access.ok) {
    return access.response;
  }

  const template = access.value;
  let content: Buffer;
  try {
    content = await getStorageProvider().get(template.storageKey);
  } catch {
    return NextResponse.json({ error: "Template source file is unavailable." }, { status: 404 });
  }

  try {
    const previewText = await extractPreviewText(template.fileName, template.fileType, content);

    return NextResponse.json(
      {
        template: {
          id: template.id,
          name: template.name,
          fileName: template.fileName,
          fileType: template.fileType
        },
        previewText,
        previewNote: previewText
          ? "Showing extracted text preview."
          : "Preview is unavailable for this file format. You can still use this template for drafting."
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        template: {
          id: template.id,
          name: template.name,
          fileName: template.fileName,
          fileType: template.fileType
        },
        previewText: null,
        previewNote: "Preview extraction failed, but you can still use this template for drafting."
      },
      { status: 200 }
    );
  }
}
