import { NextResponse } from "next/server.js";
import { requireOrgMembership } from "@/lib/server/authorization";
import { listDraftJobsByOwner } from "@/lib/server/draftJobsStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const jobs = await listDraftJobsByOwner(auth.value.userId);
  const items = jobs.map((job) => ({
    id: job.id,
    name: `${job.templateFileName} draft`,
    templateFileName: job.templateFileName,
    status: job.status,
    updatedAt: job.updatedAt
  }));

  return NextResponse.json({ items }, { status: 200 });
}
