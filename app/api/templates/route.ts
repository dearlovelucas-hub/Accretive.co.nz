import { NextResponse } from "next/server.js";
import { requireCsrfProtection, requireOrgMembership } from "@/lib/server/authorization";
import { createTemplate, listTemplatesByOwner } from "@/lib/server/templatesStore";
import { getRepos } from "@/src/server/repos";

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
    const templateFile = form.get("templateFile");
    const name = String(form.get("name") ?? "").trim();

    if (!(templateFile instanceof File)) {
      return NextResponse.json({ error: "Template file is required." }, { status: 400 });
    }

    const repos = getRepos();
    const upload = await repos.uploads.create({
      ownerUserId: auth.value.userId,
      purpose: "template",
      fileName: templateFile.name,
      fileType: templateFile.type,
      byteSize: templateFile.size,
      content: Buffer.from(await templateFile.arrayBuffer())
    });

    const record = await createTemplate({
      ownerUserId: auth.value.userId,
      name,
      fileName: templateFile.name,
      fileType: templateFile.type,
      uploadId: upload.id
    });

    return NextResponse.json({ item: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create template.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
