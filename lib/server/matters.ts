import crypto from "node:crypto";
import { getStorageProvider, makeStorageKey } from "./storage.ts";
import type {
  DraftOutputRecord,
  JobRecord,
  MatterRecord,
  MatterUploadRecord,
  TemplateRecord
} from "../../src/server/repos/contracts.ts";
import { getRepos, type Repos } from "../../src/server/repos/index.ts";

export type MatterUploadSummary = {
  id: string;
  kind: "PRECEDENT" | "TERMSHEET";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  sourceTemplateId?: string;
  sourceTemplateName?: string;
};

export type MatterJobSummary = {
  id: string;
  status: JobRecord["status"];
  progress: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type MatterOutputSummary = {
  jobId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type MatterSummary = {
  id: string;
  title: string;
  createdAt: string;
  activePrecedent: MatterUploadSummary | null;
  activeTermSheet: MatterUploadSummary | null;
  latestJob: MatterJobSummary | null;
  latestOutput: MatterOutputSummary | null;
};

export type MatterDetail = MatterSummary & {
  jobs: MatterJobSummary[];
  uploads: MatterUploadSummary[];
};

function toJobSummary(job: JobRecord): MatterJobSummary {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

function toOutputSummary(output: DraftOutputRecord): MatterOutputSummary {
  return {
    jobId: output.jobId,
    filename: output.filename,
    mimeType: output.mimeType,
    sizeBytes: output.sizeBytes,
    createdAt: output.createdAt
  };
}

async function enrichUpload(repos: Repos, orgId: string, upload: MatterUploadRecord): Promise<MatterUploadSummary> {
  let sourceTemplateName: string | undefined;
  if (upload.sourceTemplateId) {
    const template = await repos.templates.findByIdForOrg(upload.sourceTemplateId, orgId);
    sourceTemplateName = template?.name;
  }

  return {
    id: upload.id,
    kind: upload.kind,
    filename: upload.filename,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    createdAt: upload.createdAt,
    sourceTemplateId: upload.sourceTemplateId,
    sourceTemplateName
  };
}

function pickLatestUpload(uploads: MatterUploadRecord[], kind: "PRECEDENT" | "TERMSHEET"): MatterUploadRecord | null {
  const matches = uploads.filter((upload) => upload.kind === kind);
  return matches[matches.length - 1] ?? null;
}

async function resolveLatestOutput(repos: Repos, orgId: string, jobs: JobRecord[]): Promise<MatterOutputSummary | null> {
  for (const job of jobs) {
    if (job.status !== "complete") {
      continue;
    }

    const output = await repos.draftOutputs.getByJobIdForOrg(job.id, orgId);
    if (output) {
      return toOutputSummary(output);
    }
  }

  return null;
}

export async function buildMatterSummary(matter: MatterRecord, orgId: string, repos = getRepos()): Promise<MatterSummary> {
  const [uploads, jobs] = await Promise.all([
    repos.matterUploads.listByMatter(matter.id),
    repos.jobs.listByMatterForOrg(matter.id, orgId)
  ]);
  const precedent = pickLatestUpload(uploads, "PRECEDENT");
  const termSheet = pickLatestUpload(uploads, "TERMSHEET");

  const [activePrecedent, activeTermSheet, latestOutput] = await Promise.all([
    precedent ? enrichUpload(repos, orgId, precedent) : Promise.resolve(null),
    termSheet ? enrichUpload(repos, orgId, termSheet) : Promise.resolve(null),
    resolveLatestOutput(repos, orgId, jobs)
  ]);

  return {
    id: matter.id,
    title: matter.title,
    createdAt: matter.createdAt,
    activePrecedent,
    activeTermSheet,
    latestJob: jobs[0] ? toJobSummary(jobs[0]) : null,
    latestOutput
  };
}

export async function buildMatterDetail(matter: MatterRecord, orgId: string, repos = getRepos()): Promise<MatterDetail> {
  const [uploads, jobs] = await Promise.all([
    repos.matterUploads.listByMatter(matter.id),
    repos.jobs.listByMatterForOrg(matter.id, orgId)
  ]);
  const uploadSummaries = await Promise.all(uploads.map((upload) => enrichUpload(repos, orgId, upload)));
  const latestOutput = await resolveLatestOutput(repos, orgId, jobs);

  return {
    id: matter.id,
    title: matter.title,
    createdAt: matter.createdAt,
    activePrecedent: uploadSummaries.filter((upload) => upload.kind === "PRECEDENT").at(-1) ?? null,
    activeTermSheet: uploadSummaries.filter((upload) => upload.kind === "TERMSHEET").at(-1) ?? null,
    latestJob: jobs[0] ? toJobSummary(jobs[0]) : null,
    latestOutput,
    jobs: jobs.map(toJobSummary),
    uploads: uploadSummaries
  };
}

export async function snapshotTemplateIntoMatter(input: {
  matter: MatterRecord;
  userId: string;
  template: TemplateRecord;
}): Promise<MatterUploadRecord> {
  const repos = getRepos();
  const storage = getStorageProvider();
  const content = await storage.get(input.template.storageKey);
  const storageKey = makeStorageKey(input.matter.orgId, input.matter.id, "PRECEDENT", input.template.fileName);

  await storage.put(storageKey, content);

  return repos.matterUploads.create({
    id: crypto.randomUUID(),
    matterId: input.matter.id,
    orgId: input.matter.orgId,
    userId: input.userId,
    kind: "PRECEDENT",
    filename: input.template.fileName,
    mimeType: input.template.fileType,
    sizeBytes: input.template.sizeBytes,
    sha256: input.template.sha256,
    storageKey,
    retained: true,
    sourceTemplateId: input.template.id
  });
}
