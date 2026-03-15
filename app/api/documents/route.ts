import { NextResponse } from "next/server.js";
import { requireOrgMembership } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const repos = getRepos();
  const documents = await repos.documents.listVisibleForUser(auth.value.userId);
  const items = documents.map((document) => ({
    id: document.id,
    title: document.title,
    docType: document.docType,
    status: document.status,
    createdAt: document.createdAt
  }));

  return NextResponse.json({ items }, { status: 200 });
}
