import * as crypto from "node:crypto";
import { NextResponse } from "next/server.js";
import { requireCsrfProtection, requireOrgMembership, requireResourceAccess } from "@/lib/server/authorization";
import { getRepos } from "@/src/server/repos";
import { getStorageProvider, makeStorageKey } from "@/lib/server/storage";
import {
  MATTER_PRECEDENT_UPLOAD_RULE,
  MATTER_TERMSHEET_UPLOAD_RULE,
  validateUploadField
} from "@/lib/server/uploadGuards";

export const runtime = "nodejs";

const ALLOWED_KINDS = new Set(["PRECEDENT", "TERMSHEET"]);

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
  const access = await requireResourceAccess(auth.value, "matter", matterId, "write");
  if (!access.ok) {
    return access.response;
  }

  const repos = getRepos();
  const matter = await repos.matters.findByIdAndOrg(matterId, auth.value.orgId);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data." }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") ?? "").trim().toUpperCase();
  const retainedRaw = form.get("retained");
  const retained = retainedRaw !== null ? retainedRaw !== "false" : true;

  if (!ALLOWED_KINDS.has(kindRaw)) {
    return NextResponse.json({ error: "kind must be PRECEDENT or TERMSHEET." }, { status: 400 });
  }

  const fileValidation = validateUploadField(
    form,
    kindRaw === "PRECEDENT" ? MATTER_PRECEDENT_UPLOAD_RULE : MATTER_TERMSHEET_UPLOAD_RULE
  );
  if (!fileValidation.ok) {
    return NextResponse.json({ error: fileValidation.error }, { status: fileValidation.status });
  }

  const file = fileValidation.files[0];
  const kind = kindRaw as "PRECEDENT" | "TERMSHEET";
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const storageKey = makeStorageKey(auth.value.orgId, matterId, kind, file.name);

  const storage = getStorageProvider();
  await storage.put(storageKey, buffer);

  const upload = await repos.matterUploads.create({
    id: crypto.randomUUID(),
    matterId,
    orgId: auth.value.orgId,
    userId: auth.value.userId,
    kind,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    sha256,
    storageKey,
    retained
  });

  return NextResponse.json(
    {
      id: upload.id,
      kind: upload.kind,
      filename: upload.filename,
      sizeBytes: upload.sizeBytes,
      createdAt: upload.createdAt
    },
    { status: 201 }
  );
}
