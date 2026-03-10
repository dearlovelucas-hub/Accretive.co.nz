"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Stage = "idle" | "processing" | "complete";
type BillingMethod = "credit_charge" | "internet_banking" | "direct_debit";

type DraftResult = {
  previewLength: number;
  upgradeUrlOrRoute: string;
  content: string;
  plan: string;
  canDownload: boolean;
};

function parseFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) {
    return null;
  }

  const starMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (starMatch?.[1]) {
    try {
      return decodeURIComponent(starMatch[1]);
    } catch {
      return starMatch[1];
    }
  }

  const standardMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  return standardMatch?.[1] ?? null;
}

export default function DraftingWorkspace() {
  const searchParams = useSearchParams();
  const selectedTemplateId = searchParams.get("templateId");
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
  const [comparisonDownloadLoading, setComparisonDownloadLoading] = useState(false);
  const [trackedDownloadLoading, setTrackedDownloadLoading] = useState(false);
  const [trackedUnresolvedCount, setTrackedUnresolvedCount] = useState<number | null>(null);
  const [unresolvedFields, setUnresolvedFields] = useState<Array<{ field: string; question: string; location?: string }>>([]);
  const [resolveAnswers, setResolveAnswers] = useState<Record<string, string>>({});
  const [resolveLoading, setResolveLoading] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [billingMethod, setBillingMethod] = useState<BillingMethod>("credit_charge");
  const [billingConnected, setBillingConnected] = useState(false);
  const [billingActionLoading, setBillingActionLoading] = useState(false);
  const [billingNotice, setBillingNotice] = useState("");
  const [connectedBillingMethod, setConnectedBillingMethod] = useState<BillingMethod | null>(null);
  const [isTemplatePrefillLoading, setIsTemplatePrefillLoading] = useState(false);
  const [prefilledTemplateId, setPrefilledTemplateId] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const billingMethodLabel = useMemo(() => {
    if (!connectedBillingMethod) {
      return null;
    }

    if (connectedBillingMethod === "credit_charge") {
      return "Credit charge";
    }
    if (connectedBillingMethod === "internet_banking") {
      return "Internet banking";
    }
    return "Direct debit";
  }, [connectedBillingMethod]);

  function clearPollingInterval() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const hasRequiredInputs = useMemo(() => Boolean(templateFile && transactionDocs.length > 0), [templateFile, transactionDocs.length]);

  const canGenerate = useMemo(() => hasRequiredInputs && stage !== "processing", [hasRequiredInputs, stage]);

  useEffect(() => {
    return () => {
      clearPollingInterval();
    };
  }, []);

  useEffect(() => {
    const savedMethod = window.localStorage.getItem("accretive_billing_method");
    if (savedMethod === "credit_charge" || savedMethod === "internet_banking" || savedMethod === "direct_debit") {
      setConnectedBillingMethod(savedMethod);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchBillingStatus() {
      try {
        const response = await fetch("/api/billing/status", { credentials: "include" });
        const body = (await response.json().catch(() => null)) as { active?: boolean; error?: string } | null;

        if (!active) {
          return;
        }

        if (response.ok) {
          setBillingConnected(Boolean(body?.active));
          if (body?.active) {
            setBillingNotice("Billing is connected. You can generate documents.");
          }
        }
      } catch {
        if (active) {
          setBillingConnected(false);
        }
      }
    }

    void fetchBillingStatus();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTemplateId || selectedTemplateId === prefilledTemplateId) {
      return;
    }

    let active = true;

    async function loadTemplateFromLibrary(templateId: string) {
      try {
        setError("");
        setIsTemplatePrefillLoading(true);

        const response = await fetch(`/api/templates/${encodeURIComponent(templateId)}/file`, {
          credentials: "include"
        });

        if (!response.ok) {
          const fallback = "Unable to load selected template.";
          const message = (await response.text().catch(() => fallback)) || fallback;
          throw new Error(message);
        }

        const blob = await response.blob();
        const fileName =
          parseFilenameFromDisposition(response.headers.get("Content-Disposition")) ?? `template-${templateId}`;
        const fileType = response.headers.get("Content-Type") || blob.type || "application/octet-stream";

        if (!active) {
          return;
        }

        setTemplateFile(new File([blob], fileName, { type: fileType }));
        setPrefilledTemplateId(templateId);
      } catch (prefillError) {
        if (active) {
          setError(prefillError instanceof Error ? prefillError.message : "Unable to load selected template.");
        }
      } finally {
        if (active) {
          setIsTemplatePrefillLoading(false);
        }
      }
    }

    void loadTemplateFromLibrary(selectedTemplateId);

    return () => {
      active = false;
    };
  }, [prefilledTemplateId, selectedTemplateId]);

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

  async function onConnectBilling() {
    try {
      setError("");
      setBillingActionLoading(true);

      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", paymentMethod: billingMethod })
      });

      const body = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; mode?: string; message?: string; error?: string }
        | null;

      if (!response.ok) {
        setError(body?.error ?? "Unable to connect billing.");
        return;
      }

      if (body?.mode === "provider_stub" && body.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }

      setBillingConnected(true);
      setConnectedBillingMethod(billingMethod);
      window.localStorage.setItem("accretive_billing_method", billingMethod);
      setBillingNotice("Billing connected. You can now generate documents.");
      setIsBillingModalOpen(false);
    } catch {
      setError("Unable to connect billing right now.");
    } finally {
      setBillingActionLoading(false);
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

  async function onDownloadTrackedChanges() {
    if (!jobId) {
      setError("No generated draft is available for download yet.");
      return;
    }

    try {
      setError("");
      setTrackedDownloadLoading(true);

      // Step 1: trigger the patch-plan + tracked-changes pipeline
      const runResponse = await fetch(`/api/drafts/${jobId}/llm-run`, {
        method: "POST",
        credentials: "include"
      });

      if (!runResponse.ok) {
        const body = (await runResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Unable to generate tracked-changes draft.");
      }

      const runBody = (await runResponse.json()) as {
        unresolvedCount?: number;
        unresolved?: Array<{ field: string; question: string; location?: string }>;
      };
      const fields = runBody.unresolved ?? [];
      setTrackedUnresolvedCount(runBody.unresolvedCount ?? 0);

      if (fields.length > 0) {
        setUnresolvedFields(fields);
        setResolveAnswers({});
        setTrackedDownloadLoading(false);
        return;
      }

      // Step 2: download the tracked-changes DOCX
      const downloadResponse = await fetch(`/api/drafts/${jobId}/download?variant=tracked`, {
        method: "GET",
        credentials: "include"
      });

      if (!downloadResponse.ok) {
        const body = (await downloadResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Unable to download tracked-changes DOCX.");
      }

      const blob = await downloadResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "accretive-tracked-changes.docx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download tracked-changes draft.");
    } finally {
      setTrackedDownloadLoading(false);
    }
  }

  async function downloadTrackedDocx() {
    if (!jobId) return;
    const downloadResponse = await fetch(`/api/drafts/${jobId}/download?variant=tracked`, {
      method: "GET",
      credentials: "include"
    });
    if (!downloadResponse.ok) {
      const body = (await downloadResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Unable to download tracked-changes DOCX.");
    }
    const blob = await downloadResponse.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "accretive-tracked-changes.docx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function onResolveAndDownload() {
    if (!jobId) return;
    try {
      setError("");
      setResolveLoading(true);

      const response = await fetch(`/api/drafts/${jobId}/resolve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: resolveAnswers })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Unable to apply answers.");
      }

      const body = (await response.json()) as { unresolvedCount?: number };
      setTrackedUnresolvedCount(body.unresolvedCount ?? 0);
      setUnresolvedFields([]);
      await downloadTrackedDocx();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resolve fields.");
    } finally {
      setResolveLoading(false);
    }
  }

  async function onSkipResolveAndDownload() {
    try {
      setError("");
      setTrackedDownloadLoading(true);
      setUnresolvedFields([]);
      await downloadTrackedDocx();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download tracked-changes draft.");
    } finally {
      setTrackedDownloadLoading(false);
    }
  }

  async function onDownloadComparisonPdf() {
    if (!jobId) {
      setError("No generated draft is available for comparison yet.");
      return;
    }

    try {
      setError("");
      setComparisonDownloadLoading(true);

      const response = await fetch(`/api/draft-jobs/${jobId}/comparison-pdf`, {
        method: "GET",
        credentials: "include"
      });

      if (!response.ok) {
        const fallback = "Unable to generate comparison PDF right now.";
        const text = await response.text().catch(() => fallback);
        throw new Error(text || fallback);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "accretive-comparison.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (comparisonError) {
      setError(comparisonError instanceof Error ? comparisonError.message : "Unable to generate comparison PDF right now.");
    } finally {
      setComparisonDownloadLoading(false);
    }
  }

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Workspace</p>
        <h1 className="text-2xl font-semibold text-[#10243F]">Drafting</h1>
        <p className="mt-2 text-sm text-slate-700">Create transaction drafts from templates and deal context.</p>
      </div>

      {billingNotice && (
        <p className="rounded-panel border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{billingNotice}</p>
      )}

      {stage === "complete" ? (
        <section className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4">
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
            <label className="block rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-4 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
              <span className="text-sm font-medium text-[#10243F]">Template document (DOCX/PDF) *</span>
              <input
                className="mt-3 block w-full rounded-lg border border-[#d7e4fb] bg-[#f8fbff] px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-[#d7e4fb] file:bg-white file:px-3 file:py-1.5 file:text-slate-700"
                type="file"
                accept=".docx,.pdf"
                onChange={(event) => {
                  setTemplateFile(event.target.files?.[0] ?? null);
                  setPrefilledTemplateId(null);
                }}
              />
              {isTemplatePrefillLoading && (
                <p className="mt-2 text-xs text-slate-600">Loading selected template from Templates...</p>
              )}
              {templateFile && <p className="mt-2 text-xs text-slate-600">Selected: {templateFile.name}</p>}
              {prefilledTemplateId && templateFile && !isTemplatePrefillLoading && (
                <p className="mt-1 text-xs text-emerald-700">Template preloaded from Templates page.</p>
              )}
            </label>

            <label className="block rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-4 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
              <span className="text-sm font-medium text-[#10243F]">Transaction Documents / Term Sheet *</span>
              <input
                className="mt-3 block w-full rounded-lg border border-[#d7e4fb] bg-[#f8fbff] px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-[#d7e4fb] file:bg-white file:px-3 file:py-1.5 file:text-slate-700"
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
              className="mt-2 w-full rounded-panel border border-[#d7e4fb] bg-[#f8fbff] px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
              placeholder="Key commercial details, signing structure, and elections..."
            />
          </label>

          <div className="space-y-2">
            <button
              type="button"
              onClick={onGenerateDraft}
              disabled={!canGenerate}
              className="rounded-full border border-[#10243F] bg-[#10243F] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {stage === "processing" ? "Generating..." : "Generate document"}
            </button>
            {billingConnected && (
              <p className="text-xs text-slate-600">Billing connected{billingMethodLabel ? ` via ${billingMethodLabel}` : ""}.</p>
            )}
          </div>
        </>
      )}

      {error && <p className="rounded-panel border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {stage === "processing" && (
        <div className="rounded-panel border border-[#d7e4fb] bg-white p-4">
          <p className="text-sm text-slate-700">Processing drafting job...</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#dce8fb]">
            <div className="h-full rounded-full bg-[#10243F] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-600">{progress}%</p>
        </div>
      )}

      {stage === "complete" && (
        <section className="space-y-4 rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium text-[#10243F]">Generated output</h2>
            {resultLoading && <span className="text-xs text-slate-600">Loading output...</span>}
          </div>

          {draftResult && (
            <>
              <div className="overflow-hidden rounded-panel border border-[#d7e4fb] bg-[#f4f8ff]">
                <div className="flex items-center justify-between border-b border-[#d7e4fb] bg-[#e7f0ff] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  </div>
                  <p className="text-xs font-medium text-slate-700">Draft Preview (.docx)</p>
                  <span className="text-xs text-slate-500">Word-style view</span>
                </div>

                <div className="max-h-[540px] overflow-auto p-6">
                  <div className="mx-auto min-h-[680px] w-full max-w-[760px] rounded-sm border border-[#d7e4fb] bg-white p-10 shadow-sm">
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{draftResult.content}</pre>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onDownloadDocx}
                  disabled={!jobId || downloadLoading}
                  className="inline-block rounded-full border border-emerald-600 px-4 py-2 text-sm text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {downloadLoading ? "Downloading..." : "Download DOCX"}
                </button>
                <button
                  type="button"
                  onClick={onDownloadTrackedChanges}
                  disabled={!jobId || trackedDownloadLoading}
                  className="rounded-full border border-[#10243F] bg-[#10243F] px-4 py-2 text-sm text-white transition hover:bg-[#0d1d33] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {trackedDownloadLoading ? "Generating tracked changes..." : "Download with tracked changes"}
                </button>
                <button
                  type="button"
                  onClick={onDownloadComparisonPdf}
                  disabled={!jobId || comparisonDownloadLoading}
                  className="rounded-full border border-[#10243F] px-4 py-2 text-sm text-[#10243F] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {comparisonDownloadLoading ? "Building comparison..." : "Download comparison PDF"}
                </button>
              </div>
              {unresolvedFields.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-amber-800">
                    {unresolvedFields.length} field{unresolvedFields.length === 1 ? "" : "s"} need your input before downloading
                  </p>
                  <div className="space-y-3">
                    {unresolvedFields.map((f) => (
                      <label key={f.field} className="block">
                        <span className="text-sm text-amber-900">{f.question}</span>
                        {f.location && (
                          <span className="ml-2 text-xs text-amber-700">({f.location})</span>
                        )}
                        <input
                          type="text"
                          value={resolveAnswers[f.field] ?? ""}
                          onChange={(e) => setResolveAnswers((prev) => ({ ...prev, [f.field]: e.target.value }))}
                          className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          placeholder="Enter value..."
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={onResolveAndDownload}
                      disabled={resolveLoading}
                      className="rounded-full bg-amber-700 px-4 py-2 text-sm text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resolveLoading ? "Applying..." : "Apply answers & download"}
                    </button>
                    <button
                      type="button"
                      onClick={onSkipResolveAndDownload}
                      disabled={resolveLoading}
                      className="text-sm text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
                    >
                      Skip — download as-is
                    </button>
                  </div>
                </div>
              )}
              {unresolvedFields.length === 0 && trackedUnresolvedCount !== null && trackedUnresolvedCount > 0 && (
                <p className="text-xs text-amber-700">
                  {trackedUnresolvedCount} field{trackedUnresolvedCount === 1 ? "" : "s"} could not be resolved automatically — review the tracked changes document.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {isBillingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-panel border border-[#d7e4fb] bg-white p-6 text-slate-900 shadow-panel">
            <h3 className="text-lg font-semibold text-[#10243F]">Connect billing</h3>
            <p className="mt-2 text-sm text-slate-700">
              Select a payment method before generating a document.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setBillingMethod("credit_charge")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  billingMethod === "credit_charge"
                    ? "border-[#10243F] bg-[#10243F] text-white"
                    : "border-[#d7e4fb] bg-white text-slate-700 hover:bg-[#eef4ff]"
                }`}
              >
                Credit charge
              </button>
              <button
                type="button"
                onClick={() => setBillingMethod("internet_banking")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  billingMethod === "internet_banking"
                    ? "border-[#10243F] bg-[#10243F] text-white"
                    : "border-[#d7e4fb] bg-white text-slate-700 hover:bg-[#eef4ff]"
                }`}
              >
                Internet banking
              </button>
              <button
                type="button"
                onClick={() => setBillingMethod("direct_debit")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  billingMethod === "direct_debit"
                    ? "border-[#10243F] bg-[#10243F] text-white"
                    : "border-[#d7e4fb] bg-white text-slate-700 hover:bg-[#eef4ff]"
                }`}
              >
                Direct debit
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-[#d7e4fb] bg-[#f8fbff] p-4 text-sm text-slate-700">
              {billingMethod === "credit_charge" && (
                <>
                  <p className="font-medium text-[#10243F]">Credit charge</p>
                  <p className="mt-1">For existing accounts with prepaid balance. Charges are deducted from available credit.</p>
                </>
              )}
              {billingMethod === "internet_banking" && (
                <>
                  <p className="font-medium text-[#10243F]">Internet banking</p>
                  <p className="mt-1">
                    Account2Account flow is planned. Connect this option now and we will route to supported internet banking when
                    enabled.
                  </p>
                </>
              )}
              {billingMethod === "direct_debit" && (
                <>
                  <p className="font-medium text-[#10243F]">Direct debit</p>
                  <p className="mt-1">
                    Authorise monthly organisation billing so usage can be charged at the end of each month.
                  </p>
                </>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={onConnectBilling}
                disabled={billingActionLoading}
                className="rounded-full border border-[#10243F] bg-[#10243F] px-4 py-2 text-sm text-white transition hover:bg-[#0d1d33] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {billingActionLoading ? "Connecting..." : "Connect billing"}
              </button>
              <button
                type="button"
                onClick={() => setIsBillingModalOpen(false)}
                className="rounded-full border border-[#d7e4fb] px-4 py-2 text-sm text-slate-700 transition hover:bg-[#eef4ff]"
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
