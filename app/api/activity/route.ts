import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";
import { getRepos } from "@/src/server/repos";

type ActivityItem = {
  id: string;
  text: string;
  occurredAt: string;
};

function toMillis(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getRepos();
  const [templates, drafts, documents] = await Promise.all([
    repos.templates.listByOwner(session.userId),
    repos.drafts.listByOwner(session.userId),
    repos.documents.listVisibleForUser(session.userId)
  ]);

  const jobs = await Promise.all(drafts.map((draft) => repos.jobs.getById(draft.id)));

  const draftEvents: ActivityItem[] = drafts
    .map((draft, index) => {
      const job = jobs[index];
      if (!job) {
        return null;
      }

      const statusMessage =
        job.status === "complete"
          ? "Draft generated"
          : job.status === "failed"
            ? "Draft failed"
            : job.status === "processing"
              ? "Draft processing"
              : "Draft queued";

      return {
        id: `job:${job.id}`,
        text: `${statusMessage}: ${draft.templateFileName}`,
        occurredAt: job.updatedAt
      } satisfies ActivityItem;
    })
    .filter((item): item is ActivityItem => item !== null);

  const templateEvents: ActivityItem[] = templates.map((template) => ({
    id: `template:${template.id}`,
    text: `Template added: ${template.name || template.fileName}`,
    occurredAt: template.createdAt
  }));

  const documentEvents: ActivityItem[] = documents.map((document) => ({
    id: `document:${document.id}`,
    text: `Document ${document.status}: ${document.title}`,
    occurredAt: document.createdAt
  }));

  const items = [...draftEvents, ...templateEvents, ...documentEvents]
    .sort((a, b) => toMillis(b.occurredAt) - toMillis(a.occurredAt))
    .slice(0, 25);

  return NextResponse.json({ items }, { status: 200 });
}
