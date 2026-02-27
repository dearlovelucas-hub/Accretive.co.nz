import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";
import { createTemplate, listTemplatesByOwner } from "@/lib/server/templatesStore";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ items: await listTemplatesByOwner(session.userId) }, { status: 200 });
}

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      ownerUserId: session.userId,
      purpose: "template",
      fileName: templateFile.name,
      fileType: templateFile.type,
      byteSize: templateFile.size,
      content: Buffer.from(await templateFile.arrayBuffer())
    });

    const record = await createTemplate({
      ownerUserId: session.userId,
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
