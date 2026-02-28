import { NextResponse } from "next/server";
import { requireOrgSession } from "@/lib/server/orgAuth";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await requireOrgSession(request);
  if (!auth.ok) {
    return auth.response;
  }
  const { session, orgId } = auth;

  const { jobId } = await params;

  const repos = getRepos();
  const job = await repos.jobs.getById(jobId);

  if (!job) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (job.ownerUserId !== session.userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Additional org-level check for matter-scoped jobs
  if (job.matterId) {
    const matter = await repos.matters.findByIdAndOrg(job.matterId, orgId);
    if (!matter) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  return NextResponse.json(
    {
      id: job.id,
      status: job.status,
      progress: job.progress,
      errorMessage: job.errorMessage,
      matterId: job.matterId,
      updatedAt: job.updatedAt
    },
    { status: 200 }
  );
}
