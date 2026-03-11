import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getRepos();
  const docs = await repos.documents.listVisibleForUser(session.userId);

  const items = docs.map((doc) => ({
    id: doc.id,
    name: doc.title,
    templateFileName: doc.docType,
    status: doc.status,
    updatedAt: doc.createdAt
  }));

  return NextResponse.json({ items }, { status: 200 });
}
