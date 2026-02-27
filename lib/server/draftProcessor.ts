import { generateDraftWithLlm } from "@/lib/server/llmDrafting";
import { getDraftJob, updateDraftJob } from "@/lib/server/draftJobsStore";

type IncomingFile = {
  name: string;
  type: string;
  size: number;
  textExcerpt?: string;
  extractionNote: string;
};

const MAX_TEXT_CHARS = 20000;

function isTextLikeFile(file: File): boolean {
  if (file.type.startsWith("text/")) {
    return true;
  }

  const lower = file.name.toLowerCase();
  return lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv") || lower.endsWith(".json");
}

async function preprocessFile(file: File): Promise<IncomingFile> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth");
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      return {
        name: file.name,
        type: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: file.size,
        extractionNote: result.value.trim()
          ? "DOCX extraction completed."
          : "DOCX parsed but no textual content was extracted.",
        textExcerpt: result.value.slice(0, MAX_TEXT_CHARS)
      };
    } catch {
      return {
        name: file.name,
        type: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: file.size,
        extractionNote: "DOCX parsing failed or parser dependency is unavailable."
      };
    }
  }

  if (lowerName.endsWith(".pdf")) {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await pdfParse(buffer);
      return {
        name: file.name,
        type: file.type || "application/pdf",
        size: file.size,
        extractionNote: result.text.trim()
          ? "PDF extraction completed."
          : "PDF parsed but no textual content was extracted.",
        textExcerpt: result.text.slice(0, MAX_TEXT_CHARS)
      };
    } catch {
      return {
        name: file.name,
        type: file.type || "application/pdf",
        size: file.size,
        extractionNote: "PDF parsing failed or parser dependency is unavailable."
      };
    }
  }

  if (isTextLikeFile(file)) {
    const text = await file.text();
    return {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      extractionNote: "Plain-text extraction completed.",
      textExcerpt: text.slice(0, MAX_TEXT_CHARS)
    };
  }

  return {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    extractionNote: "Binary file provided. Content extraction parser not yet configured for this format."
  };
}

function detectTemplateFieldHints(text: string | undefined): string[] {
  if (!text) {
    return [];
  }

  const patterns = [/\{\{([^}]{2,80})\}\}/g, /\[([^\]]{2,80})\]/g, /<([^>]{2,80})>/g];
  const matches = new Set<string>();

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const field = (match[1] || "").trim();
      if (field) {
        matches.add(field);
      }
    }
  }

  return [...matches].slice(0, 20);
}

export async function processDraftJob(args: {
  jobId: string;
  templateFile: File;
  transactionFiles: File[];
  termSheetFile?: File;
  dealInfo: string;
}): Promise<void> {
  const job = await getDraftJob(args.jobId);
  if (!job) {
    return;
  }

  try {
    await updateDraftJob(args.jobId, { status: "processing", progress: 18 });
    const templateDoc = await preprocessFile(args.templateFile);
    const templateFieldHints = detectTemplateFieldHints(templateDoc.textExcerpt);

    await updateDraftJob(args.jobId, { status: "processing", progress: 33 });
    const transactionDocs = await Promise.all(args.transactionFiles.map((file) => preprocessFile(file)));

    await updateDraftJob(args.jobId, { status: "processing", progress: 52 });
    const termSheet = args.termSheetFile ? await preprocessFile(args.termSheetFile) : undefined;

    await updateDraftJob(args.jobId, { status: "processing", progress: 71 });
    const generation = await generateDraftWithLlm({
      template: templateDoc,
      templateFieldHints,
      transactionDocuments: transactionDocs,
      termSheet,
      dealInfo: args.dealInfo
    });

    await updateDraftJob(args.jobId, {
      status: "complete",
      progress: 100,
      generatedOutput: generation.output,
      llmModel: generation.model,
      promptVersion: generation.promptVersion,
      promptHash: generation.promptHash,
      promptPreview: generation.promptPreview,
      traceSteps: generation.traceSteps,
      errorMessage: undefined
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Draft processing failed.";
    await updateDraftJob(args.jobId, {
      status: "failed",
      progress: 100,
      errorMessage
    });
  }
}
