import type { Pool, QueryResultRow } from "pg";
import { getDatabaseUrl } from "../env.ts";

type RowMapper<T> = (row: QueryResultRow) => T;

let poolPromise: Promise<Pool> | null = null;

async function createPool(): Promise<Pool> {
  const [{ Pool }] = await Promise.all([import("pg")]);
  const schema = process.env.ACCRETIVE_DB_SCHEMA?.trim();

  return new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
    ...(schema ? { options: `-c search_path=${schema},public` } : {})
  });
}

async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = createPool();
  }

  return poolPromise;
}

export async function query<T = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
  mapper?: RowMapper<T>
): Promise<T[]> {
  const pool = await getPool();
  const result = await pool.query(text, params as unknown[]);

  if (!mapper) {
    return result.rows as T[];
  }

  return result.rows.map((row) => mapper(row));
}

export async function queryOne<T = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
  mapper?: RowMapper<T>
): Promise<T | null> {
  const rows = await query<T>(text, params, mapper);
  return rows[0] ?? null;
}

export async function execute(text: string, params: readonly unknown[] = []): Promise<number> {
  const pool = await getPool();
  const result = await pool.query(text, params as unknown[]);
  return result.rowCount ?? 0;
}

/**
 * Run `fn` inside a transaction with the document session context set.
 * All queries against the documents table must execute within this wrapper so
 * that PostgreSQL RLS policies (and the explicit WHERE guards in repo queries)
 * restrict rows to the authenticated user's own documents.
 *
 * The SET LOCAL calls are transaction-scoped and reset automatically on COMMIT
 * or ROLLBACK, so the context never leaks across pool connections.
 */
export async function withDocumentSession<T>(
  userId: string,
  orgId: string,
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  return withTransaction(async (client) => {
    await client.query("SET LOCAL app.user_id = $1", [userId]);
    await client.query("SET LOCAL app.org_id = $1", [orgId]);
    return fn(client);
  });
}

export async function withTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (!poolPromise) {
    return;
  }

  const pool = await poolPromise;
  await pool.end();
  poolPromise = null;
}
