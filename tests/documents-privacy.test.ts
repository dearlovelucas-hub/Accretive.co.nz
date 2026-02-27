import test from "node:test";
import assert from "node:assert/strict";
import { getRepos } from "../src/server/repos/index.ts";
import { ensureTestDatabase, resetTestData, shutdownTestDatabase } from "./helpers/dbTest.ts";

test.before(async () => {
  await ensureTestDatabase();
});

test.beforeEach(async () => {
  await resetTestData();
});

test.after(async () => {
  await shutdownTestDatabase();
});

test("documents visibility is owner-only for members and org-wide for admins", async () => {
  const repos = getRepos();

  await repos.orgs.upsert({ id: "org_a", name: "Org A" });
  await repos.orgs.upsert({ id: "org_b", name: "Org B" });

  await repos.users.upsert({
    id: "user_a_admin",
    email: "admin@orga.local",
    username: "orga_admin",
    passwordHash: "hash",
    displayName: "Org A Admin",
    role: "admin",
    orgId: "org_a"
  });

  await repos.users.upsert({
    id: "user_a_member",
    email: "member@orga.local",
    username: "orga_member",
    passwordHash: "hash",
    displayName: "Org A Member",
    role: "member",
    orgId: "org_a"
  });

  await repos.users.upsert({
    id: "user_b_member",
    email: "member@orgb.local",
    username: "orgb_member",
    passwordHash: "hash",
    displayName: "Org B Member",
    role: "member",
    orgId: "org_b"
  });

  const docA1 = await repos.documents.upsertByStoragePath({
    orgId: "org_a",
    ownerUserId: "user_a_member",
    title: "A Member Doc",
    docType: "draft",
    status: "generated",
    storagePath: "test:org_a:member",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 100
  });

  const docA2 = await repos.documents.upsertByStoragePath({
    orgId: "org_a",
    ownerUserId: "user_a_admin",
    title: "A Admin Doc",
    docType: "draft",
    status: "generated",
    storagePath: "test:org_a:admin",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 101
  });

  const docB1 = await repos.documents.upsertByStoragePath({
    orgId: "org_b",
    ownerUserId: "user_b_member",
    title: "B Member Doc",
    docType: "draft",
    status: "generated",
    storagePath: "test:org_b:member",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 102
  });

  const memberAVisible = await repos.documents.listVisibleForUser("user_a_member");
  assert.deepEqual(
    memberAVisible.map((doc) => doc.id),
    [docA1.id]
  );

  const adminAVisible = await repos.documents.listVisibleForUser("user_a_admin");
  assert.deepEqual(
    adminAVisible.map((doc) => doc.id).sort(),
    [docA1.id, docA2.id].sort()
  );

  const memberBVisible = await repos.documents.listVisibleForUser("user_b_member");
  assert.deepEqual(
    memberBVisible.map((doc) => doc.id),
    [docB1.id]
  );
});

test("documents owner user must belong to same org (composite FK)", async () => {
  const repos = getRepos();

  await repos.orgs.upsert({ id: "org_a", name: "Org A" });
  await repos.orgs.upsert({ id: "org_b", name: "Org B" });

  await repos.users.upsert({
    id: "user_a_member",
    email: "member@orga.local",
    username: "orga_member",
    passwordHash: "hash",
    displayName: "Org A Member",
    role: "member",
    orgId: "org_a"
  });

  await assert.rejects(
    repos.documents.upsertByStoragePath({
      orgId: "org_b",
      ownerUserId: "user_a_member",
      title: "Cross-org mismatch",
      docType: "draft",
      status: "generated",
      storagePath: "test:cross-org",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 99
    })
  );
});
