import { NextResponse } from "next/server";
import { createDraftJob } from "@/lib/server/draftJobsStore";
import { validateDraftJobInput } from "@/lib/server/validation";
import { getSessionFromRequest } from "@/lib/server/auth";
import { processDraftJob } from "@/lib/server/draftProcessor";
import { getRepos } from "@/src/server/repos";
import { getEntitlement } from "@/lib/server/subscriptions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entitlement = await getEntitlement(session.userId);
  if (!entitlement.active) {
    return NextResponse.json({ error: "Connect billing before generating a document." }, { status: 402 });
  }

  try {
    const form = await request.formData();
    const templateFile = form.get("templateFile");
    const termSheet = form.get("termSheet");
    const dealInfo = String(form.get("dealInfo") ?? "");
    const transactionFiles = form.getAll("transactionFiles");

    if (!(templateFile instanceof File)) {
      return NextResponse.json({ error: "Template file is required." }, { status: 400 });
    }

    const transactionFileObjects = transactionFiles.filter((item): item is File => item instanceof File);
    const transactionFileNames = transactionFileObjects.map((file) => file.name);

    const validation = validateDraftJobInput({
      templateFileName: templateFile.name,
      dealInfo,
      transactionDocumentCount: transactionFileNames.length
    });

    if (!validation.success) {
      return NextResponse.json({ error: validation.message }, { status: 400 });
    }

    const termSheetFileName = termSheet instanceof File ? termSheet.name : undefined;

    const job = await createDraftJob({
      ownerUserId: session.userId,
      templateFileName: templateFile.name,
      transactionFileNames,
      termSheetFileName,
      dealInfo
    });

    const repos = getRepos();
    await repos.uploads.create({
      ownerUserId: session.userId,
      draftId: job.id,
      purpose: "template",
      fileName: templateFile.name,
      fileType: templateFile.type,
      byteSize: templateFile.size,
      content: Buffer.from(await templateFile.arrayBuffer())
    });

    for (const file of transactionFileObjects) {
      await repos.uploads.create({
        ownerUserId: session.userId,
        draftId: job.id,
        purpose: "transaction",
        fileName: file.name,
        fileType: file.type,
        byteSize: file.size,
        content: Buffer.from(await file.arrayBuffer())
      });
    }

    if (termSheet instanceof File) {
      await repos.uploads.create({
        ownerUserId: session.userId,
        draftId: job.id,
        purpose: "term_sheet",
        fileName: termSheet.name,
        fileType: termSheet.type,
        byteSize: termSheet.size,
        content: Buffer.from(await termSheet.arrayBuffer())
      });
    }

    void processDraftJob({
      jobId: job.id,
      templateFile,
      transactionFiles: transactionFileObjects,
      termSheetFile: termSheet instanceof File ? termSheet : undefined,
      dealInfo
    });

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        progress: job.progress
      },
      { status: 202 }
    );
  } catch {
    return NextResponse.json({ error: "Unable to create draft job." }, { status: 500 });
  }
}
