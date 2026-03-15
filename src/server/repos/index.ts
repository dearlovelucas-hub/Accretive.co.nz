import { execute } from "../db/index.ts";
import { getEnv } from "../env.ts";
import type {
  DocumentsRepo,
  DraftOutputsRepo,
  EntitlementsRepo,
  ExtractionCacheRepo,
  JobsRepo,
  MatterUploadsRepo,
  MattersRepo,
  OrgsRepo,
  TemplatesRepo,
  UsersRepo
} from "./contracts.ts";
import {
  PostgresDocumentsRepo,
  PostgresDraftOutputsRepo,
  PostgresEntitlementsRepo,
  PostgresExtractionCacheRepo,
  PostgresJobsRepo,
  PostgresMatterUploadsRepo,
  PostgresMattersRepo,
  PostgresOrgsRepo,
  PostgresTemplatesRepo,
  PostgresUsersRepo
} from "./postgres.ts";

export type Repos = {
  users: UsersRepo;
  orgs: OrgsRepo;
  templates: TemplatesRepo;
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
      storage_blobs,
      extraction_cache,
      documents,
      draft_outputs,
      matter_uploads,
      matters,
      jobs,
      templates,
      subscriptions,
      users,
      organisations,
      orgs
    RESTART IDENTITY CASCADE`
  );
}
