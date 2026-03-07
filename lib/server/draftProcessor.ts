import { generateDraftWithLlm } from "@/lib/server/llmDrafting";
import { getDraftJob, updateDraftJob } from "@/lib/server/draftJobsStore";
import { getRepos } from "@/src/server/repos";
import type { UploadRecord } from "@/src/server/repos/contracts";

type IncomingFile = {
  name: string;
  type: string;
  size: number;
  textExcerpt?: string;
  extractionNote: string;
};

const MAX_TEXT_CHARS = 20000;

type BinaryFileInput = {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
};

function isTextLikeFile(input: { name: string; type: string }): boolean {
  if (input.type.startsWith("text/")) {
    return true;
  }

  const lower = input.name.toLowerCase();
  return lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv") || lower.endsWith(".json");
}

async function preprocessBinaryFile(file: BinaryFileInput): Promise<IncomingFile> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
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
      const result = await pdfParse(file.buffer);
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

  if (isTextLikeFile({ name: file.name, type: file.type })) {
    const text = file.buffer.toString("utf8");
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

async function preprocessFile(file: File): Promise<IncomingFile> {
  return preprocessBinaryFile({
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    buffer: Buffer.from(await file.arrayBuffer())
  });
}

function toBinaryFile(upload: UploadRecord): BinaryFileInput {
  return {
    name: upload.fileName,
    type: upload.fileType,
    size: upload.byteSize,
    buffer: upload.content
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

export async function processDraftJobFromUploads(args: {
  jobId: string;
  releaseLeaseOnFinish?: boolean;
}): Promise<void> {
  const repos = getRepos();
  const releaseLeaseOnFinish = Boolean(args.releaseLeaseOnFinish);

  try {
    const [job, draft] = await Promise.all([repos.jobs.getById(args.jobId), repos.drafts.getById(args.jobId)]);
    if (!job || !draft) {
      return;
    }

    const uploads = await repos.uploads.listByDraftId(args.jobId);
    const templateUpload = uploads.find((upload) => upload.purpose === "template");
    const transactionUploads = uploads.filter((upload) => upload.purpose === "transaction");
    const termSheetUpload = uploads.find((upload) => upload.purpose === "term_sheet");

    if (!templateUpload) {
      await updateDraftJob(args.jobId, {
        status: "failed",
        progress: 100,
        errorMessage: "Template upload is missing."
      });
      return;
    }

    if (transactionUploads.length === 0) {
      await updateDraftJob(args.jobId, {
        status: "failed",
        progress: 100,
        errorMessage: "At least one transaction document is required."
      });
      return;
    }

    await updateDraftJob(args.jobId, { status: "processing", progress: 18 });
    const templateDoc = await preprocessBinaryFile(toBinaryFile(templateUpload));
    const templateFieldHints = detectTemplateFieldHints(templateDoc.textExcerpt);

    await updateDraftJob(args.jobId, { status: "processing", progress: 33 });
    const transactionDocs = await Promise.all(transactionUploads.map((upload) => preprocessBinaryFile(toBinaryFile(upload))));

    await updateDraftJob(args.jobId, { status: "processing", progress: 52 });
    const termSheet = termSheetUpload ? await preprocessBinaryFile(toBinaryFile(termSheetUpload)) : undefined;

    await updateDraftJob(args.jobId, { status: "processing", progress: 71 });
    const generation = await generateDraftWithLlm({
      template: templateDoc,
      templateFieldHints,
      transactionDocuments: transactionDocs,
      termSheet,
      dealInfo: draft.dealInfo
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
  } finally {
    if (releaseLeaseOnFinish) {
      await repos.jobs.releaseLease(args.jobId);
    }
  }
}
