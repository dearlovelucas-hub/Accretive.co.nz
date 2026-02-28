"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Stage = "idle" | "processing" | "complete";

type DraftResult = {
  isPaywalled: boolean;
  previewLength: number;
  upgradeUrlOrRoute: string;
  content: string;
  plan: string;
  canDownload: boolean;
};

export default function DraftingWorkspace() {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [transactionDocs, setTransactionDocs] = useState<File[]>([]);
  const [dealInfo, setDealInfo] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const intervalRef = useRef<number | null>(null);

  function clearPollingInterval() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const canGenerate = useMemo(
    () => Boolean(templateFile && transactionDocs.length > 0) && stage !== "processing",
    [templateFile, transactionDocs.length, stage]
  );

  useEffect(() => {
    return () => {
      clearPollingInterval();
    };
  }, []);

  async function fetchDraftResult(nextJobId: string) {
    try {
      setResultLoading(true);
      const response = await fetch(`/api/draft-jobs/${nextJobId}/result`);
      const body = (await response.json().catch(() => null)) as
        | ({ error?: string } & Partial<DraftResult>)
        | null;

      if (!response.ok) {
        setError(body?.error ?? "Unable to fetch generated output.");
        return;
      }

      setDraftResult({
        isPaywalled: Boolean(body?.isPaywalled),
        previewLength: Number(body?.previewLength ?? 600),
        upgradeUrlOrRoute: String(body?.upgradeUrlOrRoute ?? "/pricing"),
        content: String(body?.content ?? ""),
        plan: String(body?.plan ?? "free"),
        canDownload: Boolean(body?.canDownload)
      });
    } catch {
      setError("Unable to fetch generated output.");
    } finally {
      setResultLoading(false);
    }
  }

  async function pollStatus(nextJobId: string) {
    clearPollingInterval();
    intervalRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/draft-jobs/${nextJobId}`);
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Unable to fetch job status.");
        }
        const body = (await response.json()) as { status: string; progress: number; errorMessage?: string };

        setProgress(body.progress);
        if (body.status === "complete") {
          setStage("complete");
          clearPollingInterval();
          await fetchDraftResult(nextJobId);
        }

        if (body.status === "failed") {
          setError(body.errorMessage ?? "Draft generation failed.");
          setStage("idle");
          clearPollingInterval();
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not retrieve job status.");
        setStage("idle");
        clearPollingInterval();
      }
    }, 700);
  }

  async function onGenerateDraft() {
    if (!templateFile) return;

    setError("");
    setDraftResult(null);
    setStage("processing");
    setProgress(0);

    const formData = new FormData();
    formData.append("templateFile", templateFile);
    formData.append("dealInfo", dealInfo);
    transactionDocs.forEach((file) => formData.append("transactionFiles", file));

    try {
      const response = await fetch("/api/draft-jobs", {
        method: "POST",
        body: formData
      });

      const body = (await response.json().catch(() => null)) as { jobId?: string; progress?: number; error?: string } | null;
      if (!response.ok || !body?.jobId) {
        setError(body?.error ?? "Unable to start generation.");
        setStage("idle");
        return;
      }

      setJobId(body.jobId);
      setProgress(body.progress ?? 0);
      void pollStatus(body.jobId);
    } catch {
      setError("Network error. Please retry.");
      setStage("idle");
    }
  }

  async function onDownloadDocx() {
    if (!jobId) {
      setError("No generated draft is available for download yet.");
      return;
    }

    try {
      setError("");
      setDownloadLoading(true);

      const response = await fetch(`/api/draft-jobs/${jobId}/download`, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        const fallback = "Unable to download the draft right now.";
        const maybeJson = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(maybeJson?.error ?? fallback);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "accretive-generated-draft.docx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download the draft right now.");
    } finally {
      setDownloadLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#10243F]">Drafting</h1>
        <p className="mt-2 text-sm text-slate-700">Create transaction drafts from templates and deal context.</p>
      </div>

      {stage === "complete" ? (
        <section className="rounded-xl border border-slate-300 bg-slate-50 p-4">
          <h2 className="text-sm font-semibold text-[#10243F]">Inputs used for this draft</h2>
          <p className="mt-2 text-xs text-slate-700">
            Template: <span className="font-medium">{templateFile?.name ?? "Uploaded template"}</span>
          </p>
          <p className="mt-1 text-xs text-slate-700">
            Transaction Documents / Term Sheet:{" "}
            <span className="font-medium">{transactionDocs.length > 0 ? `${transactionDocs.length} file(s)` : "Uploaded documents"}</span>
          </p>
          {dealInfo.trim() && (
            <p className="mt-1 text-xs text-slate-700">
              Deal information: <span className="font-medium">{dealInfo}</span>
            </p>
          )}
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block rounded-xl border border-slate-300 p-4">
              <span className="text-sm font-medium text-[#10243F]">Template document (DOCX/PDF) *</span>
              <input
                className="mt-3 block w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-200 file:px-3 file:py-1.5 file:text-slate-700"
                type="file"
                accept=".docx,.pdf"
                onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
              />
              {templateFile && <p className="mt-2 text-xs text-slate-600">Selected: {templateFile.name}</p>}
            </label>

            <label className="block rounded-xl border border-slate-300 p-4">
              <span className="text-sm font-medium text-[#10243F]">Transaction Documents / Term Sheet *</span>
              <input
                className="mt-3 block w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-200 file:px-3 file:py-1.5 file:text-slate-700"
                type="file"
                multiple
                onChange={(event) => setTransactionDocs(Array.from(event.target.files ?? []))}
              />
              {transactionDocs.length > 0 && (
                <p className="mt-2 text-xs text-slate-600">{transactionDocs.length} file(s) attached</p>
              )}
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-[#10243F]">Deal information (optional)</span>
            <textarea
              rows={5}
              value={dealInfo}
              onChange={(event) => setDealInfo(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10243F]"
              placeholder="Key commercial details, signing structure, and elections..."
            />
          </label>

          <button
            type="button"
            onClick={onGenerateDraft}
            disabled={!canGenerate}
            className="rounded-full bg-[#10243F] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10243F] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {stage === "processing" ? "Generating..." : "Generate draft"}
          </button>
        </>
      )}

      {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {stage === "processing" && (
        <div className="rounded-lg border border-slate-300 p-4">
          <p className="text-sm text-slate-700">Processing drafting job...</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-[#10243F] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">{progress}%</p>
        </div>
      )}

      {stage === "complete" && (
        <section className="space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium text-[#10243F]">Generated output</h2>
            {resultLoading && <span className="text-xs text-slate-600">Loading output...</span>}
          </div>

          {draftResult && (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#f3f4f6]">
                <div className="flex items-center justify-between border-b border-slate-300 bg-[#e5e7eb] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  </div>
                  <p className="text-xs font-medium text-slate-700">Draft Preview (.docx)</p>
                  <span className="text-xs text-slate-500">Word-style view</span>
                </div>

                <div className="max-h-[540px] overflow-auto p-6">
                  <div className="mx-auto min-h-[680px] w-full max-w-[760px] rounded-sm border border-slate-300 bg-white p-10 shadow-sm">
                    <pre className={`whitespace-pre-wrap text-sm leading-7 text-slate-800 ${draftResult.isPaywalled ? "select-none" : ""}`}>
                      {draftResult.content}
                    </pre>
                  </div>
                </div>
              </div>

              {draftResult.isPaywalled ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-slate-700">Preview only. Unlock full draft output to continue.</p>
                  <button
                    type="button"
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="rounded-full bg-[#10243F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10243F]"
                  >
                    Unlock full draft
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onDownloadDocx}
                  disabled={!jobId || downloadLoading}
                  className="inline-block rounded-full border border-emerald-600 px-4 py-2 text-sm text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloadLoading ? "Downloading..." : "Download DOCX"}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {isUpgradeModalOpen && draftResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-slate-900 shadow-xl">
            <h3 className="text-lg font-semibold text-[#10243F]">Unlock full draft</h3>
            <p className="mt-2 text-sm text-slate-700">Upgrade your workspace subscription to view and download complete generated output.</p>
            <div className="mt-5 flex items-center gap-3">
              <Link
                href={draftResult.upgradeUrlOrRoute}
                className="rounded-full bg-[#10243F] px-4 py-2 text-sm text-white transition hover:bg-[#0d1d33]"
              >
                Go to pricing
              </Link>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
