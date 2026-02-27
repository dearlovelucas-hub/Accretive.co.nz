import { closePool } from "../../src/server/db/index.ts";
import { runMigrations } from "../../src/server/db/migrations.ts";
import { truncateAllTablesForTests } from "../../src/server/repos/index.ts";
import { resetSeedStateForTests } from "../../src/server/services/bootstrap.ts";
import { resetEnvForTests } from "../../src/server/env.ts";

let migrationsRan = false;

export async function ensureTestDatabase(): Promise<void> {
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = "test-only-session-secret-1234";
  }

  if (!process.env.DATABASE_URL_TEST && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST (or DATABASE_URL) is required for test runs.");
  }

  if (migrationsRan) {
    return;
  }

  await runMigrations();
  migrationsRan = true;
}

export async function resetTestData(): Promise<void> {
  await truncateAllTablesForTests();
  resetSeedStateForTests();
}

export async function shutdownTestDatabase(): Promise<void> {
  await closePool();
  migrationsRan = false;
  resetEnvForTests();
}
