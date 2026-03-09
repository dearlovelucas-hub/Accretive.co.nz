import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createSessionToken, getAuthCookieName } from "../lib/server/auth.ts";
import {
  requireOrgMembership,
  requireResourceAccess,
  requireRole,
  requireSession
} from "../lib/server/authorization.ts";
import { getRepos } from "../src/server/repos/index.ts";
import { ensureTestDatabase, resetTestData, shutdownTestDatabase } from "./helpers/dbTest.ts";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const USERS = {
  adminA: {
    id: "user_org_a_admin",
    orgId: "org_a",
    username: "admin_a",
    displayName: "Admin A",
    role: "admin" as const
  },
  memberA: {
    id: "user_org_a_member",
    orgId: "org_a",
    username: "member_a",
    displayName: "Member A",
    role: "member" as const
  },
  memberB: {
    id: "user_org_b_member",
    orgId: "org_b",
    username: "member_b",
    displayName: "Member B",
    role: "member" as const
  }
};

function authCookieFor(user: { id: string; username: string; displayName: string; role: "admin" | "member" }): string {
  const token = createSessionToken({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role
  });
  return `${getAuthCookieName()}=${token}`;
}

function buildRequest(cookie?: string): Request {
  return new Request("http://localhost/security-test", {
    headers: cookie ? { cookie } : undefined
  });
}

async function seedUsers(): Promise<void> {
  const repos = getRepos();
  await repos.orgs.upsert({ id: "org_a", name: "Org A" });
  await repos.orgs.upsert({ id: "org_b", name: "Org B" });

  await repos.users.upsert({
    id: USERS.adminA.id,
    orgId: USERS.adminA.orgId,
    email: `${USERS.adminA.username}@example.local`,
    username: USERS.adminA.username,
    passwordHash: "hash",
    displayName: USERS.adminA.displayName,
    role: USERS.adminA.role
  });

  await repos.users.upsert({
    id: USERS.memberA.id,
    orgId: USERS.memberA.orgId,
    email: `${USERS.memberA.username}@example.local`,
    username: USERS.memberA.username,
    passwordHash: "hash",
    displayName: USERS.memberA.displayName,
    role: USERS.memberA.role
  });

  await repos.users.upsert({
    id: USERS.memberB.id,
    orgId: USERS.memberB.orgId,
    email: `${USERS.memberB.username}@example.local`,
    username: USERS.memberB.username,
    passwordHash: "hash",
    displayName: USERS.memberB.displayName,
    role: USERS.memberB.role
  });
}

async function seedCompletedDraftJobForUserA(): Promise<{ jobId: string; storageKey: string }> {
  const repos = getRepos();
  const jobId = crypto.randomUUID();
  const storageKey = `org_a/matters/matter-a/OUTPUT/${jobId}.docx`;

  await repos.drafts.create({
    id: jobId,
    ownerUserId: USERS.memberA.id,
    templateFileName: "template-a.docx",
    transactionFileNames: ["tx-a.pdf"],
    dealInfo: "Test matter A"
  });

  await repos.jobs.create({
    id: jobId,
    draftId: jobId,
    ownerUserId: USERS.memberA.id,
    status: "complete",
    progress: 100
  });

  await repos.draftOutputs.create({
    id: crypto.randomUUID(),
    jobId,
    orgId: USERS.memberA.orgId,
    storageKey,
    filename: "output-a.docx",
    mimeType: DOCX_MIME,
    sizeBytes: 12
  });

  return { jobId, storageKey };
}

async function membershipFor(user: typeof USERS.adminA | typeof USERS.memberA | typeof USERS.memberB) {
  const membership = await requireOrgMembership(buildRequest(authCookieFor(user)));
  assert.equal(membership.ok, true);
  if (!membership.ok) {
    throw new Error("membership resolution failed");
  }
  return membership.value;
}

test.before(async () => {
  await ensureTestDatabase();
});

test.beforeEach(async () => {
  await resetTestData();
  await seedUsers();
});

test.after(async () => {
  await shutdownTestDatabase();
});

test("user from org B cannot access org A document by changing ID", async () => {
  const repos = getRepos();
  const document = await repos.documents.upsertByStoragePath({
    orgId: USERS.memberA.orgId,
    ownerUserId: USERS.memberA.id,
    title: "Org A Secret Doc",
    docType: "draft",
    status: "generated",
    storagePath: "org_a/private/doc-1",
    mimeType: DOCX_MIME,
    sizeBytes: 120
  });

  const memberB = await membershipFor(USERS.memberB);
  const access = await requireResourceAccess(memberB, "document", document.id, "read");
  assert.equal(access.ok, false);
  if (!access.ok) {
    assert.equal(access.response.status, 404);
  }
});

test("user from org B cannot download org A generated output", async () => {
  const { jobId, storageKey } = await seedCompletedDraftJobForUserA();

  const memberB = await membershipFor(USERS.memberB);
  const access = await requireResourceAccess(memberB, "draft_output", jobId, "download");
  assert.equal(access.ok, false);
  if (!access.ok) {
    assert.equal(access.response.status, 404);
    const body = await access.response.text();
    assert.equal(body.includes(jobId), false);
    assert.equal(body.includes(storageKey), false);
  }
});

test("member cannot perform admin-only action", async () => {
  const memberA = await membershipFor(USERS.memberA);
  const roleCheck = requireRole(memberA, ["admin"]);
  assert.equal(roleCheck.ok, false);
  if (!roleCheck.ok) {
    assert.equal(roleCheck.response.status, 403);
  }
});

test("unauthorized or cross-tenant callers are blocked for trace/comparison/unresolved resource checks", async () => {
  const { jobId } = await seedCompletedDraftJobForUserA();

  const noSession = requireSession(buildRequest());
  assert.equal(noSession.ok, false);
  if (!noSession.ok) {
    assert.equal(noSession.response.status, 401);
  }

  const memberB = await membershipFor(USERS.memberB);

  const traceAccess = await requireResourceAccess(memberB, "job", jobId, "read");
  assert.equal(traceAccess.ok, false);
  if (!traceAccess.ok) {
    assert.equal(traceAccess.response.status, 404);
  }

  const unresolvedAccess = await requireResourceAccess(memberB, "draft", jobId, "read");
  assert.equal(unresolvedAccess.ok, false);
  if (!unresolvedAccess.ok) {
    assert.equal(unresolvedAccess.response.status, 404);
  }
});

test("session-required checks reject missing and invalid sessions", async () => {
  const missing = requireSession(buildRequest());
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.response.status, 401);
  }

  const invalid = requireSession(buildRequest(`${getAuthCookieName()}=invalid-token`));
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.response.status, 401);
  }
});

test("bare-ID access with invalid/empty ID is rejected by centralized authz guard", async () => {
  const memberA = await membershipFor(USERS.memberA);
  const access = await requireResourceAccess(memberA, "document", "", "read");
  assert.equal(access.ok, false);
  if (!access.ok) {
    assert.equal(access.response.status, 404);
  }
});

