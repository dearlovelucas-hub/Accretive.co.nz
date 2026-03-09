import { NextResponse } from "next/server.js";
import { requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const access = await requireResourceAccess(auth.value, "job", jobId, "read");
  if (!access.ok) {
    return access.response;
  }

  const repos = getRepos();
  const job = await repos.jobs.getByIdForOrg(jobId, auth.value.orgId);
  if (!job) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Additional org-level check for matter-scoped jobs
  if (job.matterId) {
    const matter = await repos.matters.findByIdAndOrg(job.matterId, auth.value.orgId);
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
