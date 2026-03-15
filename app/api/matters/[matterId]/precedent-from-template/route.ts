import { NextResponse } from "next/server.js";
import { requireCsrfProtection, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { snapshotTemplateIntoMatter } from "@/lib/server/matters";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ matterId: string }> }) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }
  const csrf = requireCsrfProtection(request);
  if (!csrf.ok) {
    return csrf.response;
  }

  const { matterId } = await params;
  const matterAccess = await requireResourceAccess(auth.value, "matter", matterId, "write");
  if (!matterAccess.ok) {
    return matterAccess.response;
  }

  const body = (await request.json().catch(() => null)) as { templateId?: string } | null;
  const templateId = String(body?.templateId ?? "").trim();
  if (!templateId) {
    return NextResponse.json({ error: "templateId is required." }, { status: 400 });
  }

  const templateAccess = await requireResourceAccess(auth.value, "template", templateId, "read");
  if (!templateAccess.ok) {
    return templateAccess.response;
  }

  const upload = await snapshotTemplateIntoMatter({
    matter: matterAccess.value,
    userId: auth.value.userId,
    template: templateAccess.value
  });

  return NextResponse.json(
    {
      item: {
        id: upload.id,
        kind: upload.kind,
        filename: upload.filename,
        sourceTemplateId: upload.sourceTemplateId,
        createdAt: upload.createdAt
      }
    },
    { status: 201 }
  );
}
