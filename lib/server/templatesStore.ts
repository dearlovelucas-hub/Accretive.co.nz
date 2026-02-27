import { getRepos } from "../../src/server/repos/index.ts";
import { ensureSeedData } from "../../src/server/services/bootstrap.ts";

export type TemplateRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  fileName: string;
  fileType: string;
  createdAt: string;
  updatedAt: string;
};

function isAllowedTemplateFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".docx") || lower.endsWith(".pdf");
}

export async function createTemplate(input: {
  ownerUserId: string;
  name: string;
  fileName: string;
  fileType: string;
  uploadId?: string;
}): Promise<TemplateRecord> {
  if (!isAllowedTemplateFile(input.fileName)) {
    throw new Error("Template file must be DOCX or PDF.");
  }

  await ensureSeedData();
  const repos = getRepos();

  const record = await repos.templates.create({
    ownerUserId: input.ownerUserId,
    name: input.name.trim() || input.fileName,
    fileName: input.fileName,
    fileType: input.fileType,
    uploadId: input.uploadId
  });

  return {
    id: record.id,
    ownerUserId: record.ownerUserId,
    name: record.name,
    fileName: record.fileName,
    fileType: record.fileType,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export async function listTemplatesByOwner(ownerUserId: string): Promise<TemplateRecord[]> {
  await ensureSeedData();
  const repos = getRepos();
  const records = await repos.templates.listByOwner(ownerUserId);

  return records.map((record) => ({
    id: record.id,
    ownerUserId: record.ownerUserId,
    name: record.name,
    fileName: record.fileName,
    fileType: record.fileType,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }));
}
