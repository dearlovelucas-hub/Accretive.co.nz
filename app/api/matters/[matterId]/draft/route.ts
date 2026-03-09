import * as crypto from "node:crypto";
import { after, NextResponse } from "next/server.js";
import { requireCsrfProtection, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos";
import { runQueuedJobs } from "@/lib/server/jobRunner";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ matterId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }
  const csrf = requireCsrfProtection(request);
  if (!csrf.ok) {
    return csrf.response;
  }

  const { matterId } = await params;
  const matterAccess = await requireResourceAccess(auth.value, "matter", matterId, "run");
  if (!matterAccess.ok) {
    return matterAccess.response;
  }

  const repos = getRepos();

  const matter = await repos.matters.findByIdAndOrg(matterId, auth.value.orgId);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  }

  const [precedentUpload, termsheetUpload] = await Promise.all([
    repos.matterUploads.findByMatterAndKind(matterId, "PRECEDENT"),
    repos.matterUploads.findByMatterAndKind(matterId, "TERMSHEET")
  ]);

  if (!precedentUpload) {
    return NextResponse.json({ error: "A PRECEDENT upload is required before drafting." }, { status: 422 });
  }
  if (!termsheetUpload) {
    return NextResponse.json({ error: "A TERMSHEET upload is required before drafting." }, { status: 422 });
  }

  // Parse optional force flag
  let force = false;
  try {
    const bodyText = await request.text();
    if (bodyText.trim()) {
      const parsed = JSON.parse(bodyText) as Record<string, unknown>;
      if (parsed.force === true) {
        force = true;
      }
    }
  } catch {
    // Ignore parse errors — empty body is valid
  }

  // Idempotency: if a complete job with output already exists for this matter, return it
  if (!force) {
    const existingJobs = await repos.jobs.listByMatterForOrg(matterId, auth.value.orgId);
    for (const job of existingJobs) {
      if (job.status === "complete") {
        const output = await repos.draftOutputs.getByJobIdForOrg(job.id, auth.value.orgId);
        if (output) {
          return NextResponse.json({ jobId: job.id, status: job.status, progress: job.progress }, { status: 200 });
        }
      }
    }
  }

  const jobId = crypto.randomUUID();
  const job = await repos.jobs.create({
    id: jobId,
    ownerUserId: auth.value.userId,
    status: "queued",
    progress: 4,
    matterId
  });

  after(async () => {
    try {
      await runQueuedJobs({
        maxJobs: 1,
        source: "matter-draft-enqueue"
      });
    } catch {
      // Queue fallback is handled by the cron worker; no-op here.
    }
  });

  return NextResponse.json({ jobId: job.id, status: job.status, progress: job.progress }, { status: 202 });
}
