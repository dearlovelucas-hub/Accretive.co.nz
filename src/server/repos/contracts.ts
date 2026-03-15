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
  storageKey: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  updatedAt: string;
};

export type JobStatus = "queued" | "processing" | "complete" | "failed";

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
    storageKey: string;
    sizeBytes: number;
    sha256: string;
  }): Promise<TemplateRecord>;
  listByOwner(ownerUserId: string): Promise<TemplateRecord[]>;
  listByOrg(orgId: string): Promise<TemplateRecord[]>;
  findByIdForOwner(templateId: string, ownerUserId: string): Promise<TemplateRecord | null>;
  findByIdForOrg(templateId: string, orgId: string): Promise<TemplateRecord | null>;
}

export type JobRecord = {
  id: string;
  ownerUserId: string;
  matterId: string;
  status: JobStatus;
  progress: number;
  errorMessage?: string;
  leasedAt?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  attempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export interface JobsRepo {
  create(input: {
    id: string;
    ownerUserId: string;
    matterId: string;
    status: JobStatus;
    progress: number;
    errorMessage?: string;
  }): Promise<JobRecord>;
  getById(id: string): Promise<JobRecord | null>;
  getByIdForOrg(id: string, orgId: string): Promise<JobRecord | null>;
  listByMatter(matterId: string): Promise<JobRecord[]>;
  listByMatterForOrg(matterId: string, orgId: string): Promise<JobRecord[]>;
  update(
    id: string,
    patch: Partial<Pick<JobRecord, "status" | "progress" | "errorMessage" | "lastErrorCode" | "lastErrorMessage">>
  ): Promise<JobRecord | null>;
  claimLease(input: {
    jobId: string;
    leaseOwner: string;
    leaseDurationMs: number;
  }): Promise<JobRecord | null>;
  releaseLease(jobId: string): Promise<void>;
  countActiveLeasesByOwner(ownerUserId: string): Promise<number>;
  countActiveLeasesGlobal(): Promise<number>;
}

export interface EntitlementsRepo {
  getByUserId(userId: string): Promise<EntitlementRecord | null>;
  upsertByUserId(
    userId: string,
    input: Omit<EntitlementRecord, "userId" | "createdAt" | "updatedAt">
  ): Promise<EntitlementRecord>;
}

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
  sourceTemplateId?: string;
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
    sourceTemplateId?: string;
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
