import fs from "node:fs/promises";
import path from "node:path";
import { execute, query, queryOne } from "../../src/server/db/index.ts";

export interface StorageProvider {
  put(key: string, buf: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/**
 * Build a storage key for a matter artifact.
 * Pattern: "{orgId}/matters/{matterId}/{kind}/{safeFilename}"
 */
export function makeStorageKey(
  orgId: string,
  matterId: string,
  kind: "PRECEDENT" | "TERMSHEET" | "OUTPUT",
  filename: string
): string {
  const safeFilename = path.basename(filename);
  return `${orgId}/matters/${matterId}/${kind}/${safeFilename}`;
}

export function makeTemplateStorageKey(orgId: string, templateId: string, filename: string): string {
  const safeFilename = path.basename(filename);
  return `${orgId}/templates/${templateId}/${safeFilename}`;
}

export class LocalDiskStorageProvider implements StorageProvider {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath);
  }

  private resolveSafe(key: string): string {
    const resolved = path.resolve(this.basePath, key);
    const separator = path.sep;
    if (resolved !== this.basePath && !resolved.startsWith(this.basePath + separator)) {
      throw new Error(`Storage key escapes base path: ${key}`);
    }
    return resolved;
  }

  async put(key: string, buf: Buffer): Promise<void> {
    const fullPath = this.resolveSafe(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buf);
  }

  async get(key: string): Promise<Buffer> {
    const fullPath = this.resolveSafe(key);
    return fs.readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveSafe(key);
    await fs.unlink(fullPath);
  }
}

type StorageBlobRow = {
  content: Buffer | Uint8Array;
};

export class DatabaseStorageProvider implements StorageProvider {
  async put(key: string, buf: Buffer): Promise<void> {
    await query(
      `INSERT INTO storage_blobs (key, content)
       VALUES ($1, $2)
       ON CONFLICT (key)
       DO UPDATE SET
         content = EXCLUDED.content,
         updated_at = NOW()`,
      [key, buf]
    );
  }

  async get(key: string): Promise<Buffer> {
    const row = await queryOne<StorageBlobRow>(
      `SELECT content
       FROM storage_blobs
       WHERE key = $1
       LIMIT 1`,
      [key]
    );

    if (!row) {
      throw new Error(`Storage object not found for key: ${key}`);
    }

    return row.content instanceof Buffer ? row.content : Buffer.from(row.content);
  }

  async delete(key: string): Promise<void> {
    await execute(`DELETE FROM storage_blobs WHERE key = $1`, [key]);
  }
}

let storageInstance: StorageProvider | null = null;

function resolveStorageProviderKind(): "disk" | "database" {
  const configured = (process.env.STORAGE_PROVIDER ?? "").trim().toLowerCase();
  if (configured === "disk" || configured === "local") {
    return "disk";
  }
  if (configured === "db" || configured === "database") {
    return "database";
  }

  return "database";
}

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    const providerKind = resolveStorageProviderKind();
    if (providerKind === "database") {
      storageInstance = new DatabaseStorageProvider();
    } else {
      const basePath = process.env.STORAGE_BASE_PATH ?? path.join(process.cwd(), "data");
      storageInstance = new LocalDiskStorageProvider(basePath);
    }
  }
  return storageInstance;
}

/** Override the storage provider (useful in tests). */
export function setStorageProvider(provider: StorageProvider): void {
  storageInstance = provider;
}
