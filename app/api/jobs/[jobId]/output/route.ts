import { requireOrgSession } from "@/lib/server/orgAuth";
import { getRepos } from "@/src/server/repos";
import { getStorageProvider } from "@/lib/server/storage";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const auth = await requireOrgSession(request);
  if (!auth.ok) {
    return auth.response;
  }
  const { session } = auth;

  const { jobId } = await params;

  const repos = getRepos();
  const job = await repos.jobs.getById(jobId);

  if (!job || job.ownerUserId !== session.userId) {
    return new Response("Not found.", { status: 404 });
  }

  if (job.status !== "complete") {
    return new Response("Draft is not ready yet.", { status: 409 });
  }

  const output = await repos.draftOutputs.getByJobId(jobId);
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
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${output.filename}"`
    }
  });
}
