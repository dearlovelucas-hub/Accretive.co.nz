import { after, NextResponse } from "next/server.js";
import { requireCsrfProtection, requireOrgMembership } from "@/lib/server/authorization";
import { createDraftJob } from "@/lib/server/draftJobsStore";
import { validateDraftJobInput } from "@/lib/server/validation";
import { runQueuedJobs } from "@/lib/server/jobRunner";
import { getRepos } from "@/src/server/repos";

export const runtime = "nodejs";

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
      ownerUserId: auth.value.userId,
      templateFileName: templateFile.name,
      transactionFileNames,
      termSheetFileName,
      dealInfo
    });

    const repos = getRepos();
    await repos.uploads.create({
      ownerUserId: auth.value.userId,
      draftId: job.id,
      purpose: "template",
      fileName: templateFile.name,
      fileType: templateFile.type,
      byteSize: templateFile.size,
      content: Buffer.from(await templateFile.arrayBuffer())
    });

    for (const file of transactionFileObjects) {
      await repos.uploads.create({
        ownerUserId: auth.value.userId,
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
        ownerUserId: auth.value.userId,
        draftId: job.id,
        purpose: "term_sheet",
        fileName: termSheet.name,
        fileType: termSheet.type,
        byteSize: termSheet.size,
        content: Buffer.from(await termSheet.arrayBuffer())
      });
    }

    after(async () => {
      try {
        await runQueuedJobs({
          maxJobs: 1,
          source: "draft-jobs-enqueue"
        });
      } catch {
        // Queue fallback is handled by the cron worker; no-op here.
      }
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
