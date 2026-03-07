import * as crypto from "node:crypto";
import mammoth from "mammoth";
import { getRepos } from "../../src/server/repos/index.ts";
import { getStorageProvider, makeStorageKey } from "./storage.ts";
import { extractAndCacheContext } from "./termSheetExtraction.ts";
import { generateEditPlan } from "./editPlanGeneration.ts";
import { applyEditPlanToDocx } from "./docxEditor.ts";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function extractFileText(buffer: Buffer, filename: string): Promise<string> {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (lowerName.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text;
  }

  return buffer.toString("utf8");
}

function buildOutputFilename(precedentFilename: string): string {
  return precedentFilename.replace(/\.docx$/i, "") + "-populated.docx";
}

/**
 * Main orchestrator for the precedent-populate pipeline.
 * Intended to be called fire-and-forget (void) from the API route.
 */
export async function processPrecedentJob(args: {
  jobId: string;
  matterId: string;
  orgId: string;
  userId: string;
  releaseLeaseOnFinish?: boolean;
}): Promise<void> {
  const repos = getRepos();
  const storage = getStorageProvider();

  try {
    // Idempotency: skip if already complete with an output
    const existingJob = await repos.jobs.getById(args.jobId);
    if (existingJob?.status === "complete") {
      const existingOutput = await repos.draftOutputs.getByJobId(args.jobId);
      if (existingOutput) {
        return;
      }
    }

    // Step 1 (18%): Retrieve the precedent DOCX bytes
    await repos.jobs.update(args.jobId, { status: "processing", progress: 18 });

    const precedentUpload = await repos.matterUploads.findByMatterAndKind(args.matterId, "PRECEDENT");
    if (!precedentUpload) {
      throw new Error("No PRECEDENT upload found for this matter.");
    }
    const precedentBuffer = await storage.get(precedentUpload.storageKey);

    // Step 2 (33%): Retrieve the term sheet bytes and extract text
    await repos.jobs.update(args.jobId, { status: "processing", progress: 33 });

    const termsheetUpload = await repos.matterUploads.findByMatterAndKind(args.matterId, "TERMSHEET");
    if (!termsheetUpload) {
      throw new Error("No TERMSHEET upload found for this matter.");
    }
    const termsheetBuffer = await storage.get(termsheetUpload.storageKey);
    const termsheetText = await extractFileText(termsheetBuffer, termsheetUpload.filename);

    // Step 3 (52%): Extract and cache deal context via Claude (call 1)
    await repos.jobs.update(args.jobId, { status: "processing", progress: 52 });
    const dealContext = await extractAndCacheContext(termsheetUpload.id, termsheetText);

    // Step 4 (71%): Extract precedent text and generate edit plan via Claude (call 2)
    await repos.jobs.update(args.jobId, { status: "processing", progress: 71 });
    const precedentText = await extractFileText(precedentBuffer, precedentUpload.filename);
    const editPlan = await generateEditPlan(precedentText, dealContext);

    // Step 5 (90%): Apply edit plan to the original DOCX bytes
    await repos.jobs.update(args.jobId, { status: "processing", progress: 90 });
    const outputBuffer = await applyEditPlanToDocx(precedentBuffer, editPlan);

    // Step 6 (100%): Persist the output and mark job complete
    const outputFilename = buildOutputFilename(precedentUpload.filename);
    const outputKey = makeStorageKey(args.orgId, args.matterId, "OUTPUT", outputFilename);

    await storage.put(outputKey, outputBuffer);

    await repos.draftOutputs.create({
      id: crypto.randomUUID(),
      jobId: args.jobId,
      orgId: args.orgId,
      storageKey: outputKey,
      filename: outputFilename,
      mimeType: DOCX_MIME,
      sizeBytes: outputBuffer.length
    });

    await repos.documents.upsertByStoragePath({
      orgId: args.orgId,
      ownerUserId: args.userId,
      title: outputFilename,
      docType: "precedent-populated",
      status: "generated",
      storagePath: outputKey,
      mimeType: DOCX_MIME,
      sizeBytes: outputBuffer.length
    });

    await repos.jobs.update(args.jobId, { status: "complete", progress: 100 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Precedent pipeline failed.";
    await repos.documents.upsertByStoragePath({
      orgId: args.orgId,
      ownerUserId: args.userId,
      title: `matter-${args.matterId}-draft`,
      docType: "precedent-populated",
      status: "failed",
      storagePath: `matter-job:${args.jobId}`,
      mimeType: DOCX_MIME,
      sizeBytes: 0
    });
    await repos.jobs.update(args.jobId, {
      status: "failed",
      progress: 100,
      errorMessage
    });
  } finally {
    if (args.releaseLeaseOnFinish) {
      await repos.jobs.releaseLease(args.jobId);
    }
  }
}
