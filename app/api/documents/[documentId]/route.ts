import { NextResponse } from "next/server.js";
import { requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { documentId } = await context.params;
  const access = await requireResourceAccess(auth.value, "document", documentId, "read");
  if (!access.ok) {
    return access.response;
  }
  const doc = access.value;

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
