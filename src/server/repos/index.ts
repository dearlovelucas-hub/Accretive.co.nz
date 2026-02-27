import { execute } from "../db/index.ts";
import { getEnv } from "../env.ts";
import type {
  DocumentsRepo,
  DraftOutputsRepo,
  DraftsRepo,
  EntitlementsRepo,
  ExtractionCacheRepo,
  JobsRepo,
  MatterUploadsRepo,
  MattersRepo,
  OrgsRepo,
  TemplatesRepo,
  UploadsRepo,
  UsersRepo
} from "./contracts.ts";
import {
  PostgresDocumentsRepo,
  PostgresDraftOutputsRepo,
  PostgresDraftsRepo,
  PostgresEntitlementsRepo,
  PostgresExtractionCacheRepo,
  PostgresJobsRepo,
  PostgresMatterUploadsRepo,
  PostgresMattersRepo,
  PostgresOrgsRepo,
  PostgresTemplatesRepo,
  PostgresUploadsRepo,
  PostgresUsersRepo
} from "./postgres.ts";

export type Repos = {
  users: UsersRepo;
  orgs: OrgsRepo;
  templates: TemplatesRepo;
  drafts: DraftsRepo;
  uploads: UploadsRepo;
  jobs: JobsRepo;
  entitlements: EntitlementsRepo;
  documents: DocumentsRepo;
  matters: MattersRepo;
  matterUploads: MatterUploadsRepo;
  draftOutputs: DraftOutputsRepo;
  extractionCache: ExtractionCacheRepo;
};

let repos: Repos | null = null;

export function getRepos(): Repos {
  getEnv();

  if (!repos) {
    repos = {
      users: new PostgresUsersRepo(),
      orgs: new PostgresOrgsRepo(),
      templates: new PostgresTemplatesRepo(),
      drafts: new PostgresDraftsRepo(),
      uploads: new PostgresUploadsRepo(),
      jobs: new PostgresJobsRepo(),
      entitlements: new PostgresEntitlementsRepo(),
      documents: new PostgresDocumentsRepo(),
      matters: new PostgresMattersRepo(),
      matterUploads: new PostgresMatterUploadsRepo(),
      draftOutputs: new PostgresDraftOutputsRepo(),
      extractionCache: new PostgresExtractionCacheRepo()
    };
  }

  return repos;
}

export function setRepos(next: Repos): void {
  repos = next;
}

export async function truncateAllTablesForTests(): Promise<void> {
  await execute(
    `TRUNCATE TABLE
      extraction_cache,
      documents,
      draft_outputs,
      matter_uploads,
      matters,
      uploads,
      jobs,
      drafts,
      templates,
      subscriptions,
      users,
      organisations,
      orgs
    RESTART IDENTITY CASCADE`
  );
}
