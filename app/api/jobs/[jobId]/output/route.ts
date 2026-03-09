import { buildSensitiveHeaders, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos";
import { getStorageProvider } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const jobAccess = await requireResourceAccess(auth.value, "job", jobId, "download");
  if (!jobAccess.ok) {
    return jobAccess.response;
  }
  const outputAccess = await requireResourceAccess(auth.value, "draft_output", jobId, "download");
  if (!outputAccess.ok) {
    return outputAccess.response;
  }

  const repos = getRepos();
  const job = await repos.jobs.getByIdForOrg(jobId, auth.value.orgId);
  if (!job) {
    return new Response("Not found.", { status: 404 });
  }

  if (job.status !== "complete") {
    return new Response("Draft is not ready yet.", { status: 409 });
  }

  const output = await repos.draftOutputs.getByJobIdForOrg(jobId, auth.value.orgId);
  if (!output) {
    return new Response("Output not found.", { status: 404 });
  }

  const storage = getStorageProvider();

  let fileBuffer: Buffer;
  try {
    fileBuffer = await storage.get(output.storageKey);
  } catch {
    return new Response("Output file is temporarily unavailable.", { status: 503 });
  }

  return new Response(fileBuffer, {
    status: 200,
    headers: buildSensitiveHeaders({
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${output.filename}"`
    })
  });
}
