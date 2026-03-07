import * as crypto from "node:crypto";
import { query, queryOne } from "../db/index.ts";
import type {
  DocumentRecord,
  DocumentsRepo,
  DraftOutputRecord,
  DraftOutputsRepo,
  DraftRecord,
  DraftTraceStep,
  DraftsRepo,
  EntitlementRecord,
  EntitlementsRepo,
  ExtractionCacheRecord,
  ExtractionCacheRepo,
  JobRecord,
  JobsRepo,
  MatterRecord,
  MatterUploadRecord,
  MatterUploadsRepo,
  MattersRepo,
  OrgRecord,
  OrgsRepo,
  TemplateRecord,
  TemplatesRepo,
  UploadRecord,
  UploadsRepo,
  UserRecord,
  UsersRepo
} from "./contracts.ts";

function toIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    username: String(row.username),
    passwordHash: row.password_hash ? String(row.password_hash) : null,
    displayName: String(row.display_name),
    role: String(row.role) as "admin" | "member",
    orgId: row.org_id ? String(row.org_id) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapOrg(row: Record<string, unknown>): OrgRecord {
  const createdAt = toIso(row.created_at);
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt,
    updatedAt: row.updated_at ? toIso(row.updated_at) : createdAt
  };
}

function mapTemplate(row: Record<string, unknown>): TemplateRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    fileName: String(row.file_name),
    fileType: String(row.file_type),
    uploadId: row.upload_id ? String(row.upload_id) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function parseTraceSteps(value: unknown): DraftTraceStep[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      if (!candidate.id || !candidate.label || !candidate.content) {
        return null;
      }

      return {
        id: String(candidate.id) as DraftTraceStep["id"],
        label: String(candidate.label),
        content: String(candidate.content)
      } satisfies DraftTraceStep;
    })
    .filter((item): item is DraftTraceStep => item !== null);
}

function mapDraft(row: Record<string, unknown>): DraftRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    templateFileName: String(row.template_file_name),
    transactionFileNames: Array.isArray(row.transaction_file_names)
      ? row.transaction_file_names.map((value) => String(value))
      : [],
    termSheetFileName: row.term_sheet_file_name ? String(row.term_sheet_file_name) : undefined,
    dealInfo: String(row.deal_info),
    generatedOutput: String(row.generated_output ?? ""),
    promptVersion: row.prompt_version ? String(row.prompt_version) : undefined,
    promptHash: row.prompt_hash ? String(row.prompt_hash) : undefined,
    promptPreview: row.prompt_preview ? String(row.prompt_preview) : undefined,
    llmModel: row.llm_model ? String(row.llm_model) : undefined,
    traceSteps: parseTraceSteps(row.trace_steps),
    patchPlan: row.patch_plan ?? undefined,
    unresolved: row.unresolved ?? undefined,
    modelTrace: row.model_trace ?? undefined,
    outputDocxTracked:
      row.output_docx_tracked instanceof Buffer
        ? row.output_docx_tracked
        : row.output_docx_tracked
          ? Buffer.from(row.output_docx_tracked as Uint8Array)
          : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapJob(row: Record<string, unknown>): JobRecord {
  return {
    id: String(row.id),
    draftId: row.draft_id ? String(row.draft_id) : "",
    ownerUserId: String(row.owner_user_id),
    status: String(row.status) as JobRecord["status"],
    progress: Number(row.progress),
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    matterId: row.matter_id ? String(row.matter_id) : undefined,
    leasedAt: row.leased_at ? toIso(row.leased_at) : undefined,
    leaseOwner: row.lease_owner ? String(row.lease_owner) : undefined,
    leaseExpiresAt: row.lease_expires_at ? toIso(row.lease_expires_at) : undefined,
    attempts: Number(row.attempts ?? 0),
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : undefined,
    lastErrorMessage: row.last_error_message ? String(row.last_error_message) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapUpload(row: Record<string, unknown>): UploadRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    draftId: row.draft_id ? String(row.draft_id) : undefined,
    templateId: row.template_id ? String(row.template_id) : undefined,
    purpose: String(row.purpose) as UploadRecord["purpose"],
    fileName: String(row.file_name),
    fileType: String(row.file_type),
    byteSize: Number(row.byte_size),
    content: row.content instanceof Buffer ? row.content : Buffer.from(row.content as Uint8Array),
    createdAt: toIso(row.created_at)
  };
}

function mapEntitlement(row: Record<string, unknown>): EntitlementRecord {
  return {
    userId: String(row.user_id),
    plan: String(row.plan),
    status: String(row.status) as EntitlementRecord["status"],
    expiresAt: row.expires_at ? toIso(row.expires_at) : undefined,
    providerCustomerId: row.provider_customer_id ? String(row.provider_customer_id) : undefined,
    providerSubscriptionId: row.provider_subscription_id ? String(row.provider_subscription_id) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

export class PostgresUsersRepo implements UsersRepo {
  async findByUsername(username: string): Promise<UserRecord | null> {
    return queryOne(
      `SELECT * FROM users WHERE lower(username) = lower($1) LIMIT 1`,
      [username],
      (row) => mapUser(row as Record<string, unknown>)
    );
  }

  async findById(userId: string): Promise<UserRecord | null> {
    return queryOne(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId], (row) => mapUser(row as Record<string, unknown>));
  }

  async upsert(user: {
    id: string;
    email?: string;
    username: string;
    passwordHash: string | null;
    displayName: string;
    role: "admin" | "member";
    orgId?: string;
  }): Promise<UserRecord> {
    const result = await query(
      `INSERT INTO users (id, email, username, password_hash, display_name, role, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id)
       DO UPDATE SET
         email = EXCLUDED.email,
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name,
         role = EXCLUDED.role,
         org_id = EXCLUDED.org_id,
         updated_at = NOW()
       RETURNING *`,
      [
        user.id,
        user.email ?? `${user.username.toLowerCase()}@accretive.local`,
        user.username,
        user.passwordHash,
        user.displayName,
        user.role,
        user.orgId ?? null
      ],
      (row) => mapUser(row as Record<string, unknown>)
    );

    return result[0];
  }
}

export class PostgresOrgsRepo implements OrgsRepo {
  async getById(id: string): Promise<OrgRecord | null> {
    return queryOne(`SELECT * FROM organisations WHERE id = $1 LIMIT 1`, [id], (row) =>
      mapOrg(row as Record<string, unknown>)
    );
  }

  async upsert(org: { id: string; name: string }): Promise<OrgRecord> {
    const result = await query(
      `INSERT INTO organisations (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [org.id, org.name],
      (row) => mapOrg(row as Record<string, unknown>)
    );

    // Keep legacy orgs table in sync for the matter pipeline schema in 0003.
    await query(
      `INSERT INTO orgs (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
      [org.id, org.name]
    );

    return result[0];
  }
}

export class PostgresTemplatesRepo implements TemplatesRepo {
  async create(input: {
    ownerUserId: string;
    name: string;
    fileName: string;
    fileType: string;
    uploadId?: string;
  }): Promise<TemplateRecord> {
    const result = await query(
      `INSERT INTO templates (id, owner_user_id, name, file_name, file_type, upload_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [crypto.randomUUID(), input.ownerUserId, input.name, input.fileName, input.fileType, input.uploadId ?? null],
      (row) => mapTemplate(row as Record<string, unknown>)
    );

    return result[0];
  }

  async listByOwner(ownerUserId: string): Promise<TemplateRecord[]> {
    return query(
      `SELECT * FROM templates WHERE owner_user_id = $1 ORDER BY updated_at DESC`,
      [ownerUserId],
      (row) => mapTemplate(row as Record<string, unknown>)
    );
  }

  async findByIdForOwner(templateId: string, ownerUserId: string): Promise<TemplateRecord | null> {
    return queryOne(
      `SELECT *
       FROM templates
       WHERE id = $1
         AND owner_user_id = $2
       LIMIT 1`,
      [templateId, ownerUserId],
      (row) => mapTemplate(row as Record<string, unknown>)
    );
  }
}

export class PostgresDraftsRepo implements DraftsRepo {
  async create(input: {
    id: string;
    ownerUserId: string;
    templateFileName: string;
    transactionFileNames: string[];
    termSheetFileName?: string;
    dealInfo: string;
  }): Promise<DraftRecord> {
    const result = await query(
      `INSERT INTO drafts (
         id,
         owner_user_id,
         template_file_name,
         transaction_file_names,
         term_sheet_file_name,
         deal_info,
         generated_output
       ) VALUES ($1, $2, $3, $4::text[], $5, $6, $7)
       RETURNING *`,
      [
        input.id,
        input.ownerUserId,
        input.templateFileName,
        input.transactionFileNames,
        input.termSheetFileName ?? null,
        input.dealInfo,
        ""
      ],
      (row) => mapDraft(row as Record<string, unknown>)
    );

    return result[0];
  }

  async getById(id: string): Promise<DraftRecord | null> {
    return queryOne(`SELECT * FROM drafts WHERE id = $1 LIMIT 1`, [id], (row) => mapDraft(row as Record<string, unknown>));
  }

  async listByOwner(ownerUserId: string): Promise<DraftRecord[]> {
    return query(
      `SELECT * FROM drafts WHERE owner_user_id = $1 ORDER BY updated_at DESC`,
      [ownerUserId],
      (row) => mapDraft(row as Record<string, unknown>)
    );
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        DraftRecord,
        | "generatedOutput"
        | "promptVersion"
        | "promptHash"
        | "promptPreview"
        | "llmModel"
        | "traceSteps"
        | "patchPlan"
        | "unresolved"
        | "modelTrace"
        | "outputDocxTracked"
      >
    >
  ): Promise<DraftRecord | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const result = await query(
      `UPDATE drafts
       SET
         generated_output = $2,
         prompt_version = $3,
         prompt_hash = $4,
         prompt_preview = $5,
         llm_model = $6,
         trace_steps = $7::jsonb,
         patch_plan = $8::jsonb,
         unresolved = $9::jsonb,
         model_trace = $10::jsonb,
         output_docx_tracked = $11,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.generatedOutput ?? existing.generatedOutput,
        patch.promptVersion ?? existing.promptVersion ?? null,
        patch.promptHash ?? existing.promptHash ?? null,
        patch.promptPreview ?? existing.promptPreview ?? null,
        patch.llmModel ?? existing.llmModel ?? null,
        JSON.stringify(patch.traceSteps ?? existing.traceSteps ?? null),
        "patchPlan" in patch
          ? patch.patchPlan != null ? JSON.stringify(patch.patchPlan) : null
          : existing.patchPlan != null ? JSON.stringify(existing.patchPlan) : null,
        "unresolved" in patch
          ? patch.unresolved != null ? JSON.stringify(patch.unresolved) : null
          : existing.unresolved != null ? JSON.stringify(existing.unresolved) : null,
        "modelTrace" in patch
          ? patch.modelTrace != null ? JSON.stringify(patch.modelTrace) : null
          : existing.modelTrace != null ? JSON.stringify(existing.modelTrace) : null,
        "outputDocxTracked" in patch
          ? (patch.outputDocxTracked ?? null)
          : (existing.outputDocxTracked ?? null)
      ],
      (row) => mapDraft(row as Record<string, unknown>)
    );

    return result[0] ?? null;
  }
}

export class PostgresUploadsRepo implements UploadsRepo {
  async create(input: {
    ownerUserId: string;
    draftId?: string;
    templateId?: string;
    purpose: "template" | "transaction" | "term_sheet";
    fileName: string;
    fileType: string;
    byteSize: number;
    content: Buffer;
  }): Promise<UploadRecord> {
    const result = await query(
      `INSERT INTO uploads (
         id,
         owner_user_id,
         draft_id,
         template_id,
         purpose,
         file_name,
         file_type,
         byte_size,
         content
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        crypto.randomUUID(),
        input.ownerUserId,
        input.draftId ?? null,
        input.templateId ?? null,
        input.purpose,
        input.fileName,
        input.fileType,
        input.byteSize,
        input.content
      ],
      (row) => mapUpload(row as Record<string, unknown>)
    );

    return result[0];
  }

  async listByDraftId(draftId: string): Promise<UploadRecord[]> {
    return query(
      `SELECT * FROM uploads WHERE draft_id = $1 ORDER BY created_at ASC`,
      [draftId],
      (row) => mapUpload(row as Record<string, unknown>)
    );
  }

  async getByIdForOwner(uploadId: string, ownerUserId: string): Promise<UploadRecord | null> {
    return queryOne(
      `SELECT *
       FROM uploads
       WHERE id = $1
         AND owner_user_id = $2
       LIMIT 1`,
      [uploadId, ownerUserId],
      (row) => mapUpload(row as Record<string, unknown>)
    );
  }
}

export class PostgresJobsRepo implements JobsRepo {
  async create(input: {
    id: string;
    draftId?: string;
    ownerUserId: string;
    status: JobRecord["status"];
    progress: number;
    errorMessage?: string;
    matterId?: string;
  }): Promise<JobRecord> {
    const result = await query(
      `INSERT INTO jobs (id, draft_id, owner_user_id, status, progress, error_message, matter_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.id,
        input.draftId ?? null,
        input.ownerUserId,
        input.status,
        input.progress,
        input.errorMessage ?? null,
        input.matterId ?? null
      ],
      (row) => mapJob(row as Record<string, unknown>)
    );

    return result[0];
  }

  async getById(id: string): Promise<JobRecord | null> {
    return queryOne(`SELECT * FROM jobs WHERE id = $1 LIMIT 1`, [id], (row) => mapJob(row as Record<string, unknown>));
  }

  async listByMatter(matterId: string): Promise<JobRecord[]> {
    return query(
      `SELECT * FROM jobs WHERE matter_id = $1 ORDER BY created_at DESC`,
      [matterId],
      (row) => mapJob(row as Record<string, unknown>)
    );
  }

  async update(
    id: string,
    patch: Partial<Pick<JobRecord, "status" | "progress" | "errorMessage" | "lastErrorCode" | "lastErrorMessage">>
  ): Promise<JobRecord | null> {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const result = await query(
      `UPDATE jobs
       SET
         status = $2,
         progress = $3,
         error_message = $4,
         last_error_code = $5,
         last_error_message = $6,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        patch.status ?? existing.status,
        patch.progress ?? existing.progress,
        patch.errorMessage ?? null,
        patch.lastErrorCode ?? existing.lastErrorCode ?? null,
        patch.lastErrorMessage ?? existing.lastErrorMessage ?? null
      ],
      (row) => mapJob(row as Record<string, unknown>)
    );

    return result[0] ?? null;
  }

  async claimLease(input: {
    jobId: string;
    leaseOwner: string;
    leaseDurationMs: number;
  }): Promise<JobRecord | null> {
    const leaseExpiry = new Date(Date.now() + input.leaseDurationMs).toISOString();

    // Atomically transition queued → processing, or steal an expired processing lease.
    const rows = await query(
      `UPDATE jobs
       SET
         status            = 'processing',
         leased_at         = NOW(),
         lease_owner       = $2,
         lease_expires_at  = $3::timestamptz,
         attempts          = COALESCE(attempts, 0) + 1,
         updated_at        = NOW()
       WHERE id = $1
         AND (
           status = 'queued'
           OR (status = 'processing' AND (lease_expires_at IS NULL OR lease_expires_at < NOW()))
         )
       RETURNING *`,
      [input.jobId, input.leaseOwner, leaseExpiry],
      (row) => mapJob(row as Record<string, unknown>)
    );

    return rows[0] ?? null;
  }

  async releaseLease(jobId: string): Promise<void> {
    await query(
      `UPDATE jobs
       SET
         leased_at        = NULL,
         lease_owner      = NULL,
         lease_expires_at = NULL,
         updated_at       = NOW()
       WHERE id = $1`,
      [jobId]
    );
  }

  async countActiveLeasesByOwner(ownerUserId: string): Promise<number> {
    const rows = await query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt
       FROM jobs
       WHERE owner_user_id = $1
         AND status = 'processing'
         AND lease_expires_at > NOW()`,
      [ownerUserId]
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async countActiveLeasesGlobal(): Promise<number> {
    const rows = await query<{ cnt: string }>(
      `SELECT COUNT(*) AS cnt
       FROM jobs
       WHERE status = 'processing'
         AND lease_expires_at > NOW()`
    );
    return Number(rows[0]?.cnt ?? 0);
  }
}

export class PostgresEntitlementsRepo implements EntitlementsRepo {
  async getByUserId(userId: string): Promise<EntitlementRecord | null> {
    return queryOne(`SELECT * FROM subscriptions WHERE user_id = $1 LIMIT 1`, [userId], (row) => mapEntitlement(row as Record<string, unknown>));
  }

  async upsertByUserId(
    userId: string,
    input: Omit<EntitlementRecord, "userId" | "createdAt" | "updatedAt">
  ): Promise<EntitlementRecord> {
    const id = crypto.randomUUID();
    const result = await query(
      `INSERT INTO subscriptions (
         id,
         user_id,
         plan,
         status,
         expires_at,
         provider_customer_id,
         provider_subscription_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id)
       DO UPDATE SET
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         expires_at = EXCLUDED.expires_at,
         provider_customer_id = EXCLUDED.provider_customer_id,
         provider_subscription_id = EXCLUDED.provider_subscription_id,
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        userId,
        input.plan,
        input.status,
        input.expiresAt ?? null,
        input.providerCustomerId ?? null,
        input.providerSubscriptionId ?? null
      ],
      (row) => mapEntitlement(row as Record<string, unknown>)
    );

    return result[0];
  }
}

function mapDocument(row: Record<string, unknown>): DocumentRecord {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    ownerUserId: String(row.owner_user_id),
    title: String(row.title),
    docType: String(row.doc_type),
    status: String(row.status) as "generated" | "failed",
    storagePath: String(row.storage_path),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    createdAt: toIso(row.created_at),
    deletedAt: row.deleted_at ? toIso(row.deleted_at) : undefined
  };
}

export class PostgresDocumentsRepo implements DocumentsRepo {
  async upsertByStoragePath(input: {
    orgId: string;
    ownerUserId: string;
    title: string;
    docType: string;
    status: "generated" | "failed";
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<DocumentRecord> {
    const result = await query(
      `INSERT INTO documents (
        id,
        org_id,
        owner_user_id,
        title,
        doc_type,
        status,
        storage_path,
        mime_type,
        size_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (storage_path)
      DO UPDATE SET
        title = EXCLUDED.title,
        doc_type = EXCLUDED.doc_type,
        status = EXCLUDED.status,
        mime_type = EXCLUDED.mime_type,
        size_bytes = EXCLUDED.size_bytes,
        deleted_at = NULL
      RETURNING *`,
      [
        crypto.randomUUID(),
        input.orgId,
        input.ownerUserId,
        input.title,
        input.docType,
        input.status,
        input.storagePath,
        input.mimeType,
        input.sizeBytes
      ],
      (row) => mapDocument(row as Record<string, unknown>)
    );

    return result[0];
  }

  async listVisibleForUser(userId: string): Promise<DocumentRecord[]> {
    return query(
      `WITH me AS (
         SELECT id, org_id, role
         FROM users
         WHERE id = $1
         LIMIT 1
       )
       SELECT d.*
       FROM documents d
       JOIN me ON d.org_id = me.org_id
       WHERE d.deleted_at IS NULL
         AND (me.role = 'admin' OR d.owner_user_id = me.id)
       ORDER BY d.created_at DESC`,
      [userId],
      (row) => mapDocument(row as Record<string, unknown>)
    );
  }

  async getVisibleByIdForUser(userId: string, documentId: string): Promise<DocumentRecord | null> {
    return queryOne(
      `WITH me AS (
         SELECT id, org_id, role
         FROM users
         WHERE id = $1
         LIMIT 1
       )
       SELECT d.*
       FROM documents d
       JOIN me ON d.org_id = me.org_id
       WHERE d.deleted_at IS NULL
         AND d.id = $2
         AND (me.role = 'admin' OR d.owner_user_id = me.id)
       LIMIT 1`,
      [userId, documentId],
      (row) => mapDocument(row as Record<string, unknown>)
    );
  }
}

// ---------------------------------------------------------------------------
// Matter pipeline repo implementations
// ---------------------------------------------------------------------------

function mapMatter(row: Record<string, unknown>): MatterRecord {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    userId: String(row.user_id),
    title: String(row.title),
    createdAt: toIso(row.created_at)
  };
}

function mapMatterUpload(row: Record<string, unknown>): MatterUploadRecord {
  return {
    id: String(row.id),
    matterId: String(row.matter_id),
    orgId: String(row.org_id),
    userId: String(row.user_id),
    kind: String(row.kind) as "PRECEDENT" | "TERMSHEET",
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    storageKey: String(row.storage_key),
    retained: Boolean(row.retained),
    createdAt: toIso(row.created_at)
  };
}

function mapDraftOutput(row: Record<string, unknown>): DraftOutputRecord {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    orgId: String(row.org_id),
    storageKey: String(row.storage_key),
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    createdAt: toIso(row.created_at)
  };
}

function mapExtractionCache(row: Record<string, unknown>): ExtractionCacheRecord {
  return {
    id: String(row.id),
    uploadId: String(row.upload_id),
    extractedText: row.extracted_text ? String(row.extracted_text) : null,
    extractedJson: row.extracted_json ? String(row.extracted_json) : null,
    createdAt: toIso(row.created_at)
  };
}

export class PostgresMattersRepo implements MattersRepo {
  async create(input: { id: string; orgId: string; userId: string; title: string }): Promise<MatterRecord> {
    const result = await query(
      `INSERT INTO matters (id, org_id, user_id, title) VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.id, input.orgId, input.userId, input.title],
      (row) => mapMatter(row as Record<string, unknown>)
    );
    return result[0];
  }

  async getById(id: string): Promise<MatterRecord | null> {
    return queryOne(
      `SELECT * FROM matters WHERE id = $1 LIMIT 1`,
      [id],
      (row) => mapMatter(row as Record<string, unknown>)
    );
  }

  async findByIdAndOrg(id: string, orgId: string): Promise<MatterRecord | null> {
    return queryOne(
      `SELECT * FROM matters WHERE id = $1 AND org_id = $2 LIMIT 1`,
      [id, orgId],
      (row) => mapMatter(row as Record<string, unknown>)
    );
  }

  async listByOrg(orgId: string): Promise<MatterRecord[]> {
    return query(
      `SELECT * FROM matters WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
      (row) => mapMatter(row as Record<string, unknown>)
    );
  }
}

export class PostgresMatterUploadsRepo implements MatterUploadsRepo {
  async create(input: {
    id: string;
    matterId: string;
    orgId: string;
    userId: string;
    kind: "PRECEDENT" | "TERMSHEET";
    filename: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    storageKey: string;
    retained?: boolean;
  }): Promise<MatterUploadRecord> {
    const result = await query(
      `INSERT INTO matter_uploads
         (id, matter_id, org_id, user_id, kind, filename, mime_type, size_bytes, sha256, storage_key, retained)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.id,
        input.matterId,
        input.orgId,
        input.userId,
        input.kind,
        input.filename,
        input.mimeType,
        input.sizeBytes,
        input.sha256,
        input.storageKey,
        input.retained ?? true
      ],
      (row) => mapMatterUpload(row as Record<string, unknown>)
    );
    return result[0];
  }

  async findByMatterAndKind(matterId: string, kind: "PRECEDENT" | "TERMSHEET"): Promise<MatterUploadRecord | null> {
    return queryOne(
      `SELECT * FROM matter_uploads WHERE matter_id = $1 AND kind = $2 ORDER BY created_at DESC LIMIT 1`,
      [matterId, kind],
      (row) => mapMatterUpload(row as Record<string, unknown>)
    );
  }

  async listByMatter(matterId: string): Promise<MatterUploadRecord[]> {
    return query(
      `SELECT * FROM matter_uploads WHERE matter_id = $1 ORDER BY created_at ASC`,
      [matterId],
      (row) => mapMatterUpload(row as Record<string, unknown>)
    );
  }
}

export class PostgresDraftOutputsRepo implements DraftOutputsRepo {
  async create(input: {
    id: string;
    jobId: string;
    orgId: string;
    storageKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<DraftOutputRecord> {
    const result = await query(
      `INSERT INTO draft_outputs (id, job_id, org_id, storage_key, filename, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [input.id, input.jobId, input.orgId, input.storageKey, input.filename, input.mimeType, input.sizeBytes],
      (row) => mapDraftOutput(row as Record<string, unknown>)
    );
    return result[0];
  }

  async getByJobId(jobId: string): Promise<DraftOutputRecord | null> {
    return queryOne(
      `SELECT * FROM draft_outputs WHERE job_id = $1 LIMIT 1`,
      [jobId],
      (row) => mapDraftOutput(row as Record<string, unknown>)
    );
  }
}

export class PostgresExtractionCacheRepo implements ExtractionCacheRepo {
  async getByUploadId(uploadId: string): Promise<ExtractionCacheRecord | null> {
    return queryOne(
      `SELECT * FROM extraction_cache WHERE upload_id = $1 LIMIT 1`,
      [uploadId],
      (row) => mapExtractionCache(row as Record<string, unknown>)
    );
  }

  async create(input: {
    id: string;
    uploadId: string;
    extractedText: string | null;
    extractedJson: string;
  }): Promise<ExtractionCacheRecord> {
    const result = await query(
      `INSERT INTO extraction_cache (id, upload_id, extracted_text, extracted_json)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.id, input.uploadId, input.extractedText, input.extractedJson],
      (row) => mapExtractionCache(row as Record<string, unknown>)
    );
    return result[0];
  }
}
