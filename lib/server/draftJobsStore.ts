import * as crypto from "node:crypto";
import { getRepos } from "../../src/server/repos/index.ts";
import type { DraftRecord, JobRecord } from "../../src/server/repos/contracts.ts";
import { ensureSeedData } from "../../src/server/services/bootstrap.ts";

export type DraftJobStatus = "queued" | "processing" | "complete" | "failed";

export type DraftTraceStep = {
  id: "context_summary" | "required_fields" | "missing_questions" | "final_draft";
  label: string;
  content: string;
};

export type DraftJobRecord = {
  id: string;
  ownerUserId: string;
  status: DraftJobStatus;
  templateFileName: string;
  transactionFileNames: string[];
  termSheetFileName?: string;
  dealInfo: string;
  generatedOutput: string;
  promptVersion?: string;
  promptHash?: string;
  promptPreview?: string;
  llmModel?: string;
  traceSteps?: DraftTraceStep[];
  progress: number;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
};

function buildGeneratedOutput(input: {
  templateFileName: string;
  transactionFileNames: string[];
  termSheetFileName?: string;
  dealInfo: string;
  jobId: string;
}): string {
  return [
    "Accretive Draft Output",
    "",
    `Job ID: ${input.jobId}`,
    `Template: ${input.templateFileName}`,
    `Transaction docs: ${input.transactionFileNames.join(", ") || "None supplied"}`,
    `Term sheet: ${input.termSheetFileName ?? "Not provided"}`,
    "",
    "Generated Clauses:",
    "1. Parties and recitals are tailored from source documents.",
    "2. Core commercial terms have been normalized for drafting consistency.",
    "3. Signature block election has been applied based on supplied deal structure.",
    "",
    `Matter Context: ${input.dealInfo}`,
    "",
    "Disclaimer: This is a generated first draft and requires lawyer review."
  ].join("\n");
}

function toDraftJobRecord(args: { draft: DraftRecord; job: JobRecord }): DraftJobRecord {
  const draft = args.draft;
  const job = args.job;

  if (!draft || !job) {
    throw new Error("Draft job cannot be mapped without draft and job records.");
  }

  return {
    id: job.id,
    ownerUserId: draft.ownerUserId,
    status: job.status,
    templateFileName: draft.templateFileName,
    transactionFileNames: draft.transactionFileNames,
    termSheetFileName: draft.termSheetFileName,
    dealInfo: draft.dealInfo,
    generatedOutput: draft.generatedOutput,
    promptVersion: draft.promptVersion,
    promptHash: draft.promptHash,
    promptPreview: draft.promptPreview,
    llmModel: draft.llmModel,
    traceSteps: draft.traceSteps,
    progress: job.progress,
    createdAt: draft.createdAt,
    updatedAt: job.updatedAt,
    errorMessage: job.errorMessage
  };
}

export async function createDraftJob(input: {
  ownerUserId: string;
  templateFileName: string;
  transactionFileNames: string[];
  termSheetFileName?: string;
  dealInfo: string;
}): Promise<DraftJobRecord> {
  await ensureSeedData();
  const repos = getRepos();
  const id = crypto.randomUUID();

  const draft = await repos.drafts.create({
    id,
    ownerUserId: input.ownerUserId,
    templateFileName: input.templateFileName,
    transactionFileNames: input.transactionFileNames,
    termSheetFileName: input.termSheetFileName,
    dealInfo: input.dealInfo
  });

  const job = await repos.jobs.create({
    id,
    draftId: draft.id,
    ownerUserId: input.ownerUserId,
    status: "queued",
    progress: 4
  });

  return toDraftJobRecord({ draft, job });
}

export async function getDraftJob(jobId: string): Promise<DraftJobRecord | null> {
  await ensureSeedData();
  const repos = getRepos();
  const [job, draft] = await Promise.all([repos.jobs.getById(jobId), repos.drafts.getById(jobId)]);

  if (!job || !draft) {
    return null;
  }

  const output = toDraftJobRecord({ draft, job });

  if (output.status === "complete" || output.status === "failed") {
    const owner = await repos.users.findById(output.ownerUserId);
    if (owner?.orgId) {
      await repos.documents.upsertByStoragePath({
        orgId: owner.orgId,
        ownerUserId: output.ownerUserId,
        title: `${output.templateFileName} draft`,
        docType: output.templateFileName,
        status: output.status === "complete" ? "generated" : "failed",
        storagePath: `draft-job:${output.id}`,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: Buffer.byteLength(output.generatedOutput || "", "utf8")
      });
    }
  }

  return output;
}

export async function listDraftJobsByOwner(ownerUserId: string): Promise<DraftJobRecord[]> {
  await ensureSeedData();
  const repos = getRepos();
  const drafts = await repos.drafts.listByOwner(ownerUserId);

  const rows = await Promise.all(
    drafts.map(async (draft) => {
      const job = await repos.jobs.getById(draft.id);
      return job ? toDraftJobRecord({ draft, job }) : null;
    })
  );

  return rows.filter((row): row is DraftJobRecord => row !== null);
}

export async function updateDraftJob(
  jobId: string,
  patch: Partial<
    Pick<
      DraftJobRecord,
      | "status"
      | "progress"
      | "generatedOutput"
      | "errorMessage"
      | "promptVersion"
      | "promptHash"
      | "promptPreview"
      | "llmModel"
      | "traceSteps"
    >
  >
): Promise<DraftJobRecord | null> {
  await ensureSeedData();
  const repos = getRepos();

  const [job, draft] = await Promise.all([
    repos.jobs.update(jobId, {
      status: patch.status,
      progress: patch.progress,
      errorMessage: patch.errorMessage
    }),
    repos.drafts.update(jobId, {
      generatedOutput: patch.generatedOutput,
      promptVersion: patch.promptVersion,
      promptHash: patch.promptHash,
      promptPreview: patch.promptPreview,
      llmModel: patch.llmModel,
      traceSteps: patch.traceSteps
    })
  ]);

  if (!job || !draft) {
    return null;
  }

  return toDraftJobRecord({ draft, job });
}

export async function createCompletedDraftJobForTest(input: {
  ownerUserId?: string;
  templateFileName: string;
  transactionFileNames: string[];
  termSheetFileName?: string;
  dealInfo: string;
}): Promise<DraftJobRecord> {
  const ownerUserId = input.ownerUserId ?? "user_lucas";
  const repos = getRepos();
  const orgId = "org_demo";

  await repos.orgs.upsert({ id: orgId, name: "Accretive Demo" });

  await repos.users.upsert({
    id: ownerUserId,
    email: `${ownerUserId}@accretive.local`,
    username: ownerUserId,
    passwordHash: "testhash",
    displayName: ownerUserId,
    role: "member",
    orgId
  });

  const created = await createDraftJob({
    ownerUserId,
    templateFileName: input.templateFileName,
    transactionFileNames: input.transactionFileNames,
    termSheetFileName: input.termSheetFileName,
    dealInfo: input.dealInfo
  });

  const updated = await updateDraftJob(created.id, {
    status: "complete",
    progress: 100,
    generatedOutput: buildGeneratedOutput({
      templateFileName: input.templateFileName,
      transactionFileNames: input.transactionFileNames,
      termSheetFileName: input.termSheetFileName,
      dealInfo: input.dealInfo,
      jobId: created.id
    })
  });

  if (!updated) {
    throw new Error("Unable to create completed draft job for test.");
  }

  return updated;
}
