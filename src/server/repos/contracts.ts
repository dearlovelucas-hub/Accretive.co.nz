export type UserRecord = {
  id: string;
  email: string;
  username: string;
  passwordHash: string | null;
  displayName: string;
  role: "admin" | "member";
  orgId?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrgRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  fileName: string;
  fileType: string;
  uploadId?: string;
  createdAt: string;
  updatedAt: string;
};

export type DraftJobStatus = "queued" | "processing" | "complete" | "failed";

export type DraftTraceStep = {
  id: "context_summary" | "required_fields" | "missing_questions" | "final_draft";
  label: string;
  content: string;
};

export type DraftRecord = {
  id: string;
  ownerUserId: string;
  templateFileName: string;
  transactionFileNames: string[];
  termSheetFileName?: string;
  dealInfo: string;
  generatedOutput: string;
  promptVersion?: string;
  promptHash?: string;
  promptPreview?: string;
  llmModel?: string;
  traceSteps?: DraftTraceStep[];
  // Patch plan fields (migration 0006)
  patchPlan?: unknown;
  unresolved?: unknown;
  modelTrace?: unknown;
  outputDocxTracked?: Buffer;
  createdAt: string;
  updatedAt: string;
};

export type JobRecord = {
  id: string;
  draftId: string;
  ownerUserId: string;
  status: DraftJobStatus;
  progress: number;
  errorMessage?: string;
  matterId?: string;
  // Lease fields (migration 0006)
  leasedAt?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  attempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type UploadPurpose = "template" | "transaction" | "term_sheet";

export type UploadRecord = {
  id: string;
  ownerUserId: string;
  draftId?: string;
  templateId?: string;
  purpose: UploadPurpose;
  fileName: string;
  fileType: string;
  byteSize: number;
  content: Buffer;
  createdAt: string;
};

export type EntitlementRecord = {
  userId: string;
  plan: string;
  status: "active" | "inactive";
  expiresAt?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
};

export interface UsersRepo {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
  upsert(user: {
    id: string;
    email?: string;
    username: string;
    passwordHash: string | null;
    displayName: string;
    role: "admin" | "member";
    orgId?: string;
  }): Promise<UserRecord>;
}

export interface OrgsRepo {
  getById(id: string): Promise<OrgRecord | null>;
  upsert(org: { id: string; name: string }): Promise<OrgRecord>;
}

export interface TemplatesRepo {
  create(input: {
    ownerUserId: string;
    name: string;
    fileName: string;
    fileType: string;
    uploadId?: string;
  }): Promise<TemplateRecord>;
  listByOwner(ownerUserId: string): Promise<TemplateRecord[]>;
  listByOrg(orgId: string): Promise<TemplateRecord[]>;
  findByIdForOwner(templateId: string, ownerUserId: string): Promise<TemplateRecord | null>;
  findByIdForOrg(templateId: string, orgId: string): Promise<TemplateRecord | null>;
}

export interface DraftsRepo {
  create(input: {
    id: string;
    ownerUserId: string;
    templateFileName: string;
    transactionFileNames: string[];
    termSheetFileName?: string;
    dealInfo: string;
  }): Promise<DraftRecord>;
  /**
   * SECURITY RULE: request handlers must not perform bare resource lookups by ID.
   * Use org-scoped methods in route handlers and authz checks.
   */
  getById(id: string): Promise<DraftRecord | null>;
  getByIdForOrg(id: string, orgId: string): Promise<DraftRecord | null>;
  listByOwner(ownerUserId: string): Promise<DraftRecord[]>;
  update(
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
  ): Promise<DraftRecord | null>;
}

export interface UploadsRepo {
  create(input: {
    ownerUserId: string;
    draftId?: string;
    templateId?: string;
    purpose: UploadPurpose;
    fileName: string;
    fileType: string;
    byteSize: number;
    content: Buffer;
  }): Promise<UploadRecord>;
  listByDraftId(draftId: string): Promise<UploadRecord[]>;
  listByDraftIdForOrg(draftId: string, orgId: string): Promise<UploadRecord[]>;
  getByIdForOwner(uploadId: string, ownerUserId: string): Promise<UploadRecord | null>;
  getByIdForOrg(uploadId: string, orgId: string): Promise<UploadRecord | null>;
}

export interface JobsRepo {
  create(input: {
    id: string;
    draftId?: string;
    ownerUserId: string;
    status: DraftJobStatus;
    progress: number;
    errorMessage?: string;
    matterId?: string;
  }): Promise<JobRecord>;
  /**
   * SECURITY RULE: request handlers must not perform bare resource lookups by ID.
   * Use org-scoped methods in route handlers and authz checks.
   */
  getById(id: string): Promise<JobRecord | null>;
  getByIdForOrg(id: string, orgId: string): Promise<JobRecord | null>;
  listByMatter(matterId: string): Promise<JobRecord[]>;
  listByMatterForOrg(matterId: string, orgId: string): Promise<JobRecord[]>;
  update(
    id: string,
    patch: Partial<Pick<JobRecord, "status" | "progress" | "errorMessage" | "lastErrorCode" | "lastErrorMessage">>
  ): Promise<JobRecord | null>;
  /**
   * Atomically claim the processing lease for a job.
   * Only succeeds when the job is in "queued" status, or in "processing" with
   * an expired lease.  Returns the updated record on success, null if the
   * job is already leased by another owner.
   */
  claimLease(input: {
    jobId: string;
    leaseOwner: string;
    leaseDurationMs: number;
  }): Promise<JobRecord | null>;
  /**
   * Release the lease (set leased_at / lease_owner / lease_expires_at to NULL)
   * without changing the overall job status, so the job can be re-claimed.
   */
  releaseLease(jobId: string): Promise<void>;
  /**
   * Count jobs that are currently in "processing" with a non-expired lease,
   * scoped to a specific owner user.
   */
  countActiveLeasesByOwner(ownerUserId: string): Promise<number>;
  /** Count all active leased jobs globally. */
  countActiveLeasesGlobal(): Promise<number>;
}

export interface EntitlementsRepo {
  getByUserId(userId: string): Promise<EntitlementRecord | null>;
  upsertByUserId(
    userId: string,
    input: Omit<EntitlementRecord, "userId" | "createdAt" | "updatedAt">
  ): Promise<EntitlementRecord>;
}

// ---------------------------------------------------------------------------
// Matter pipeline types
// ---------------------------------------------------------------------------

export type MatterRecord = {
  id: string;
  orgId: string;
  userId: string;
  title: string;
  createdAt: string;
};

export type MatterUploadRecord = {
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
  retained: boolean;
  createdAt: string;
};

export type DraftOutputRecord = {
  id: string;
  jobId: string;
  orgId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ExtractionCacheRecord = {
  id: string;
  uploadId: string;
  extractedText: string | null;
  extractedJson: string | null;
  createdAt: string;
};

export interface MattersRepo {
  create(input: { id: string; orgId: string; userId: string; title: string }): Promise<MatterRecord>;
  getById(id: string): Promise<MatterRecord | null>;
  findByIdAndOrg(id: string, orgId: string): Promise<MatterRecord | null>;
  listByOrg(orgId: string): Promise<MatterRecord[]>;
}

export interface MatterUploadsRepo {
  create(input: {
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
  }): Promise<MatterUploadRecord>;
  findByMatterAndKind(matterId: string, kind: "PRECEDENT" | "TERMSHEET"): Promise<MatterUploadRecord | null>;
  listByMatter(matterId: string): Promise<MatterUploadRecord[]>;
}

export interface DraftOutputsRepo {
  create(input: {
    id: string;
    jobId: string;
    orgId: string;
    storageKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<DraftOutputRecord>;
  getByJobId(jobId: string): Promise<DraftOutputRecord | null>;
  getByJobIdForOrg(jobId: string, orgId: string): Promise<DraftOutputRecord | null>;
}

export interface ExtractionCacheRepo {
  getByUploadId(uploadId: string): Promise<ExtractionCacheRecord | null>;
  create(input: {
    id: string;
    uploadId: string;
    extractedText: string | null;
    extractedJson: string;
  }): Promise<ExtractionCacheRecord>;
}

export type DocumentRecord = {
  id: string;
  orgId: string;
  ownerUserId: string;
  title: string;
  docType: string;
  status: "generated" | "failed";
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  deletedAt?: string;
};

export interface DocumentsRepo {
  upsertByStoragePath(input: {
    orgId: string;
    ownerUserId: string;
    title: string;
    docType: string;
    status: "generated" | "failed";
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<DocumentRecord>;
  listVisibleForUser(userId: string): Promise<DocumentRecord[]>;
  getVisibleByIdForUser(userId: string, documentId: string): Promise<DocumentRecord | null>;
  getByIdForOrg(documentId: string, orgId: string): Promise<DocumentRecord | null>;
}
