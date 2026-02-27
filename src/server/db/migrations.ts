import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getDatabaseUrl } from "../env.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../../../db/migrations");

function getSchema(): string | undefined {
  const schema = process.env.ACCRETIVE_DB_SCHEMA?.trim();
  if (!schema) {
    return undefined;
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error("ACCRETIVE_DB_SCHEMA must be a valid SQL identifier.");
  }

  return schema;
}

async function listMigrationFiles(): Promise<string[]> {
  const files = await fs.readdir(migrationsDir);
  return files.filter((name) => name.endsWith(".sql")).sort();
}

export async function runMigrations(): Promise<string[]> {
  const schema = getSchema();

  const client = new pg.Client({
    connectionString: getDatabaseUrl(),
    ...(schema ? { options: `-c search_path=${schema},public` } : {})
  });

  const applied: string[] = [];

  await client.connect();

  try {
    if (schema) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = await listMigrationFiles();

    for (const file of files) {
      const existing = await client.query(`SELECT 1 FROM schema_migrations WHERE id = $1 LIMIT 1`, [file]);
      if (existing.rowCount) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }

  return applied;
}
