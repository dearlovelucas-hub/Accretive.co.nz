import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";
import { listDraftJobsByOwner } from "@/lib/server/draftJobsStore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await listDraftJobsByOwner(session.userId);
  const items = jobs.map((job) => ({
    id: job.id,
    name: `${job.templateFileName} draft`,
    templateFileName: job.templateFileName,
    status: job.status,
    updatedAt: job.updatedAt
  }));

  return NextResponse.json({ items }, { status: 200 });
}
