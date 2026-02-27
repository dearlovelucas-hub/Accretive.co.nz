import * as crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireOrgSession } from "@/lib/server/orgAuth";
import { getRepos } from "@/src/server/repos";
import { processPrecedentJob } from "@/lib/server/precedentPipeline";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ matterId: string }> }) {
  const auth = await requireOrgSession(request);
  if (!auth.ok) {
    return auth.response;
  }
  const { session, orgId } = auth;

  const { matterId } = await params;

  const repos = getRepos();

  const matter = await repos.matters.findByIdAndOrg(matterId, orgId);
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
    const existingJobs = await repos.jobs.listByMatter(matterId);
    for (const job of existingJobs) {
      if (job.status === "complete") {
        const output = await repos.draftOutputs.getByJobId(job.id);
        if (output) {
          return NextResponse.json({ jobId: job.id, status: job.status, progress: job.progress }, { status: 200 });
        }
      }
    }
  }

  const jobId = crypto.randomUUID();
  const job = await repos.jobs.create({
    id: jobId,
    ownerUserId: session.userId,
    status: "queued",
    progress: 4,
    matterId
  });

  void processPrecedentJob({
    jobId: job.id,
    matterId,
    orgId,
    userId: session.userId
  });

  return NextResponse.json({ jobId: job.id, status: job.status, progress: job.progress }, { status: 202 });
}
