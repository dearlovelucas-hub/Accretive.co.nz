import crypto from "node:crypto";
import { NextResponse } from "next/server.js";
import { requireCsrfProtection, requireOrgMembership } from "@/lib/server/authorization";
import { getStorageProvider, makeTemplateStorageKey } from "@/lib/server/storage";
import { createTemplate, listTemplatesByOwner } from "@/lib/server/templatesStore";
import { TEMPLATE_UPLOAD_RULE, validateUploadField } from "@/lib/server/uploadGuards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({ items: await listTemplatesByOwner(auth.value.userId) }, { status: 200 });
}

export async function POST(request: Request) {
  const auth = await requireOrgMembership(request);
  if (!auth.ok) {
    return auth.response;
  }
  const csrf = requireCsrfProtection(request);
  if (!csrf.ok) {
    return csrf.response;
  }

  try {
    const form = await request.formData();
    const templateFileValidation = validateUploadField(form, TEMPLATE_UPLOAD_RULE);
    if (!templateFileValidation.ok) {
      return NextResponse.json({ error: templateFileValidation.error }, { status: templateFileValidation.status });
    }
    const templateFile = templateFileValidation.files[0];
    const name = String(form.get("name") ?? "").trim();
    const fileBuffer = Buffer.from(await templateFile.arrayBuffer());
    const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const storageKey = makeTemplateStorageKey(auth.value.orgId, crypto.randomUUID(), templateFile.name);
    await getStorageProvider().put(storageKey, fileBuffer);

    const record = await createTemplate({
      ownerUserId: auth.value.userId,
      name,
      fileName: templateFile.name,
      fileType: templateFile.type,
      storageKey,
      sizeBytes: templateFile.size,
      sha256
    });

    return NextResponse.json({ item: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create template.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
