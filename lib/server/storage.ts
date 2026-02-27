import fs from "node:fs/promises";
import path from "node:path";

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

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    const basePath = process.env.STORAGE_BASE_PATH ?? path.join(process.cwd(), "data");
    storageInstance = new LocalDiskStorageProvider(basePath);
  }
  return storageInstance;
}

/** Override the storage provider (useful in tests). */
export function setStorageProvider(provider: StorageProvider): void {
  storageInstance = provider;
}
