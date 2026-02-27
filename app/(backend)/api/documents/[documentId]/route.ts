import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await context.params;
  const repos = getRepos();
  const doc = await repos.documents.getVisibleByIdForUser(session.userId, documentId);

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      item: {
        id: doc.id,
        orgId: doc.orgId,
        ownerUserId: doc.ownerUserId,
        title: doc.title,
        docType: doc.docType,
        status: doc.status,
        createdAt: doc.createdAt
      }
    },
    { status: 200 }
  );
}
