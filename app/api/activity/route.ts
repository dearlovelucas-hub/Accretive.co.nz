import { NextResponse } from "next/server.js";
import { requireOrgMembership } from "@/lib/server/authorization";
import { buildMatterSummary } from "@/lib/server/matters";
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
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const repos = getRepos();
  const [templates, matters, documents] = await Promise.all([
    repos.templates.listByOwner(auth.value.userId),
    repos.matters.listByOrg(auth.value.orgId),
    repos.documents.listVisibleForUser(auth.value.userId)
  ]);
  const matterSummaries = await Promise.all(matters.map((matter) => buildMatterSummary(matter, auth.value.orgId, repos)));

  const matterEvents: ActivityItem[] = matterSummaries.flatMap((matter) => {
    const events: ActivityItem[] = [
      {
        id: `matter:${matter.id}`,
        text: `Matter created: ${matter.title}`,
        occurredAt: matter.createdAt
      }
    ];

    if (matter.activePrecedent) {
      events.push({
        id: `upload:${matter.activePrecedent.id}`,
        text: `Precedent attached: ${matter.activePrecedent.filename}`,
        occurredAt: matter.activePrecedent.createdAt
      });
    }

    if (matter.activeTermSheet) {
      events.push({
        id: `upload:${matter.activeTermSheet.id}`,
        text: `Term sheet attached: ${matter.activeTermSheet.filename}`,
        occurredAt: matter.activeTermSheet.createdAt
      });
    }

    if (matter.latestJob) {
      const statusMessage =
        matter.latestJob.status === "complete"
          ? "Draft generated"
          : matter.latestJob.status === "failed"
            ? "Draft failed"
            : matter.latestJob.status === "processing"
              ? "Draft processing"
              : "Draft queued";
      events.push({
        id: `job:${matter.latestJob.id}`,
        text: `${statusMessage}: ${matter.title}`,
        occurredAt: matter.latestJob.updatedAt
      });
    }

    return events;
  });

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

  const items = [...matterEvents, ...templateEvents, ...documentEvents]
    .sort((a, b) => toMillis(b.occurredAt) - toMillis(a.occurredAt))
    .slice(0, 25);

  return NextResponse.json({ items }, { status: 200 });
}
