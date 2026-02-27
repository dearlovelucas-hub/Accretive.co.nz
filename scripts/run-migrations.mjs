import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../db/migrations");

const databaseUrl =
  process.env.NODE_ENV === "test"
    ? process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
    : process.env.DATABASE_URL || process.env.DATABASE_URL_TEST;
if (!databaseUrl) {
  throw new Error("DATABASE_URL (or DATABASE_URL_TEST) is required to run migrations.");
}

const schema = process.env.ACCRETIVE_DB_SCHEMA?.trim();
if (schema && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
  throw new Error("ACCRETIVE_DB_SCHEMA must be a valid SQL identifier.");
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ...(schema ? { options: `-c search_path=${schema},public` } : {})
});

async function ensureMigrationsTable() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensureSchema() {
  if (!schema) return;
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
}

async function listMigrationFiles() {
  const files = await fs.readdir(migrationsDir);
  return files.filter((name) => name.endsWith(".sql")).sort();
}

async function run() {
  await client.connect();
  await ensureSchema();
  await ensureMigrationsTable();

  const files = await listMigrationFiles();

  for (const file of files) {
    const alreadyApplied = await client.query(`SELECT 1 FROM schema_migrations WHERE id = $1 LIMIT 1`, [file]);
    if (alreadyApplied.rowCount) {
      continue;
    }

    const migrationSql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(migrationSql);
      await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [file]);
      await client.query("COMMIT");
      process.stdout.write(`applied ${file}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

run()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
