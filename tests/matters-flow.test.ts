import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildDocxFromDraftText } from "../lib/server/docxOutput.ts";
import { createSessionToken, getAuthCookieName } from "../lib/server/auth.ts";
import { getStorageProvider, makeTemplateStorageKey } from "../lib/server/storage.ts";
import { getRepos } from "../src/server/repos/index.ts";
import { ensureTestDatabase, resetTestData, shutdownTestDatabase } from "./helpers/dbTest.ts";
import { startNextTestServer, type NextTestServer } from "./helpers/nextTestServer.ts";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEXT_MIME = "text/plain";

const USERS = {
  memberA: {
    id: "matters_flow_user_a",
    orgId: "matters_flow_org_a",
    username: "matters_flow_a",
    displayName: "Matters Flow A",
    role: "member" as const
  },
  memberB: {
    id: "matters_flow_user_b",
    orgId: "matters_flow_org_b",
    username: "matters_flow_b",
    displayName: "Matters Flow B",
    role: "member" as const
  }
};

let nextServer: NextTestServer;

function sessionCookieFor(user: typeof USERS.memberA | typeof USERS.memberB): string {
  const token = createSessionToken({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role
  });
  return `${getAuthCookieName()}=${token}`;
}

function makeHeaders(
  user?: typeof USERS.memberA | typeof USERS.memberB,
  options?: {
    origin?: string;
    contentType?: string;
  }
): Headers {
  const headers = new Headers();

  if (user) {
    headers.set("cookie", sessionCookieFor(user));
  }
  if (options?.origin) {
    headers.set("origin", options.origin);
  }
  if (options?.contentType) {
    headers.set("content-type", options.contentType);
  }

  return headers;
}

async function authedFetch(
  path: string,
  user?: typeof USERS.memberA | typeof USERS.memberB,
  init?: RequestInit & {
    origin?: string;
  }
): Promise<Response> {
  const headers = new Headers(init?.headers);
  for (const [key, value] of makeHeaders(user, {
    origin: init?.origin,
    contentType: headers.has("content-type") ? undefined : undefined
  }).entries()) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  return fetch(`${nextServer.origin}${path}`, {
    ...init,
    headers
  });
}

async function createMatterViaHttp(title: string, user = USERS.memberA): Promise<string> {
  const response = await authedFetch("/api/matters", user, {
    method: "POST",
    origin: nextServer.origin,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ title })
  });

  if (response.status !== 201) {
    const bodyText = await response.text();
    assert.fail(`Expected POST /api/matters to return 201, received ${response.status}: ${bodyText}`);
  }
  const body = (await response.json()) as { id: string };
  assert.ok(body.id);
  return body.id;
}

async function uploadMatterFile(input: {
  matterId: string;
  user?: typeof USERS.memberA | typeof USERS.memberB;
  kind: "PRECEDENT" | "TERMSHEET";
  file: File;
}): Promise<void> {
  const form = new FormData();
  form.append("kind", input.kind);
  form.append("file", input.file);

  const response = await authedFetch(`/api/matters/${encodeURIComponent(input.matterId)}/uploads`, input.user, {
    method: "POST",
    origin: nextServer.origin,
    body: form
  });

  assert.equal(response.status, 201);
}

async function waitForJobCompletion(jobId: string, user = USERS.memberA): Promise<{ id: string; status: string }> {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const response = await authedFetch(`/api/jobs/${encodeURIComponent(jobId)}`, user);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { id: string; status: string; errorMessage?: string };

    if (body.status === "complete") {
      return body;
    }

    if (body.status === "failed") {
      assert.fail(`Matter job ${jobId} failed: ${body.errorMessage ?? "unknown error"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  assert.fail(`Timed out waiting for matter job ${jobId} to complete.`);
}

async function seedUsers(): Promise<void> {
  const repos = getRepos();

  await repos.orgs.upsert({ id: USERS.memberA.orgId, name: "Matters Flow Org A" });
  await repos.orgs.upsert({ id: USERS.memberB.orgId, name: "Matters Flow Org B" });

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

async function seedTemplateForUser(
  user: typeof USERS.memberA | typeof USERS.memberB,
  name: string
): Promise<{ id: string }> {
  const repos = getRepos();
  const fileBuffer = await buildDocxFromDraftText("Template precedent for snapshot tests.");
  const templateId = crypto.randomUUID();
  const storageKey = makeTemplateStorageKey(user.orgId, templateId, "seed-template.docx");
  const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  await getStorageProvider().put(storageKey, fileBuffer);

  const record = await repos.templates.create({
    ownerUserId: user.id,
    name,
    fileName: "seed-template.docx",
    fileType: DOCX_MIME,
    storageKey,
    sizeBytes: fileBuffer.length,
    sha256
  });

  return { id: record.id };
}

test.before(async () => {
  await ensureTestDatabase();

  const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_TEST (or DATABASE_URL) is required for HTTP matter flow tests.");
  }

  nextServer = await startNextTestServer({
    workdir: process.cwd(),
    env: {
      DATABASE_URL: databaseUrl,
      DATABASE_URL_TEST: databaseUrl,
      SESSION_SECRET: process.env.SESSION_SECRET ?? "test-only-session-secret-1234",
      STORAGE_PROVIDER: "database",
      ANTHROPIC_API_KEY: ""
    }
  });

  const warmResponse = await fetch(`${nextServer.origin}/api/matters`);
  assert.equal(warmResponse.status, 401);
});

test.beforeEach(async () => {
  await resetTestData();
  await seedUsers();
});

test.after(async () => {
  await nextServer.stop();
  await shutdownTestDatabase();
});

test("matter flow works end-to-end over HTTP", async () => {
  const precedentBuffer = await buildDocxFromDraftText(
    "Asset Purchase Agreement\n\nSeller: [SELLER]\nBuyer: [BUYER]\nPurchase Price: [PRICE]"
  );
  const matterId = await createMatterViaHttp("HTTP Matter Flow");

  const createMatterDetail = await authedFetch(`/api/matters/${encodeURIComponent(matterId)}`, USERS.memberA);
  assert.equal(createMatterDetail.status, 200);

  await uploadMatterFile({
    matterId,
    kind: "PRECEDENT",
    user: USERS.memberA,
    file: new File([precedentBuffer], "precedent.docx", { type: DOCX_MIME })
  });

  await uploadMatterFile({
    matterId,
    kind: "TERMSHEET",
    user: USERS.memberA,
    file: new File(
      [Buffer.from("Seller: Alice\nBuyer: Bob\nPurchase Price: NZD 100,000\nSigning Date: 2026-03-15", "utf8")],
      "termsheet.txt",
      { type: TEXT_MIME }
    )
  });

  const draftResponse = await authedFetch(`/api/matters/${encodeURIComponent(matterId)}/draft`, USERS.memberA, {
    method: "POST",
    origin: nextServer.origin,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({})
  });

  assert.equal(draftResponse.status, 202);
  const draftBody = (await draftResponse.json()) as { jobId: string };
  assert.ok(draftBody.jobId);

  const job = await waitForJobCompletion(draftBody.jobId, USERS.memberA);
  assert.equal(job.status, "complete");

  const outputResponse = await authedFetch(`/api/jobs/${encodeURIComponent(draftBody.jobId)}/output`, USERS.memberA);
  assert.equal(outputResponse.status, 200);
  assert.equal(outputResponse.headers.get("content-type"), DOCX_MIME);

  const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
  assert.ok(outputBuffer.length > 0);

  const documentsResponse = await authedFetch("/api/documents", USERS.memberA);
  assert.equal(documentsResponse.status, 200);
  const documentsBody = (await documentsResponse.json()) as {
    items: Array<{ id: string; title: string; docType: string; status: string }>;
  };

  const generatedDocument = documentsBody.items.find(
    (item) => item.title === "precedent-populated.docx" && item.docType === "precedent-populated"
  );
  assert.ok(generatedDocument);

  const documentDownloadResponse = await authedFetch(
    `/api/documents/${encodeURIComponent(generatedDocument.id)}/download`,
    USERS.memberA
  );
  assert.equal(documentDownloadResponse.status, 200);
  assert.equal(documentDownloadResponse.headers.get("content-type"), DOCX_MIME);
});

test("removed legacy draft routes return 404 over HTTP", async () => {
  const [draftJobsResponse, draftsResponse] = await Promise.all([
    fetch(`${nextServer.origin}/api/draft-jobs`),
    fetch(`${nextServer.origin}/api/drafts`)
  ]);

  assert.equal(draftJobsResponse.status, 404);
  assert.equal(draftsResponse.status, 404);
});

test("cross-org users cannot read another org's matter over HTTP", async () => {
  const matterId = await createMatterViaHttp("Org A Matter", USERS.memberA);

  const response = await authedFetch(`/api/matters/${encodeURIComponent(matterId)}`, USERS.memberB);
  assert.equal(response.status, 404);
});

test("cross-org template snapshot is blocked over HTTP", async () => {
  const repos = getRepos();
  const matter = await repos.matters.create({
    id: crypto.randomUUID(),
    orgId: USERS.memberA.orgId,
    userId: USERS.memberA.id,
    title: "Org A Snapshot Target"
  });
  const template = await seedTemplateForUser(USERS.memberB, "Org B Template");

  const response = await authedFetch(
    `/api/matters/${encodeURIComponent(matter.id)}/precedent-from-template`,
    USERS.memberA,
    {
      method: "POST",
      origin: nextServer.origin,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ templateId: template.id })
    }
  );

  assert.equal(response.status, 404);
});
