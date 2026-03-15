"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type MatterUploadSummary = {
  id: string;
  kind: "PRECEDENT" | "TERMSHEET";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  sourceTemplateId?: string;
  sourceTemplateName?: string;
};

type MatterJobSummary = {
  id: string;
  status: "queued" | "processing" | "complete" | "failed";
  progress: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

type MatterOutputSummary = {
  jobId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type MatterSummary = {
  id: string;
  title: string;
  createdAt: string;
  activePrecedent: MatterUploadSummary | null;
  activeTermSheet: MatterUploadSummary | null;
  latestJob: MatterJobSummary | null;
  latestOutput: MatterOutputSummary | null;
};

type MatterDetail = MatterSummary & {
  jobs: MatterJobSummary[];
  uploads: MatterUploadSummary[];
};

type TemplateItem = {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  updatedAt: string;
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

export default function MatterWorkspace() {
  const searchParams = useSearchParams();
  const templateIdFromQuery = searchParams.get("templateId");
  const [matters, setMatters] = useState<MatterSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [selectedMatterId, setSelectedMatterId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateIdFromQuery ?? "");
  const [matterDetail, setMatterDetail] = useState<MatterDetail | null>(null);
  const [newMatterTitle, setNewMatterTitle] = useState("");
  const [precedentFile, setPrecedentFile] = useState<File | null>(null);
  const [termSheetFile, setTermSheetFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submittingMatter, setSubmittingMatter] = useState(false);
  const [uploading, setUploading] = useState<"precedent" | "termsheet" | "template" | null>(null);
  const [runningJob, setRunningJob] = useState(false);
  const [downloadingOutput, setDownloadingOutput] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pollRef = useRef<number | null>(null);
  const selectedMatterIdRef = useRef<string | null>(null);

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    const response = await fetch("/api/templates", { credentials: "include" });
    const body = (await response.json().catch(() => null)) as { items?: TemplateItem[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error ?? "Unable to load templates.");
    }
    setTemplates(body?.items ?? []);
  }, []);

  const loadMatters = useCallback(async (preferredMatterId?: string) => {
    const response = await fetch("/api/matters", { credentials: "include" });
    const body = (await response.json().catch(() => null)) as { items?: MatterSummary[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error ?? "Unable to load matters.");
    }

    const items = body?.items ?? [];
    setMatters(items);

    const nextSelectedId =
      preferredMatterId && items.some((item) => item.id === preferredMatterId)
        ? preferredMatterId
        : selectedMatterIdRef.current && items.some((item) => item.id === selectedMatterIdRef.current)
          ? selectedMatterIdRef.current
          : items[0]?.id ?? null;

    setSelectedMatterId(nextSelectedId);
    return nextSelectedId;
  }, []);

  const loadMatterDetail = useCallback(async (matterId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/matters/${encodeURIComponent(matterId)}`, {
        credentials: "include"
      });
      const body = (await response.json().catch(() => null)) as { item?: MatterDetail; error?: string } | null;
      if (!response.ok || !body?.item) {
        throw new Error(body?.error ?? "Unable to load matter.");
      }
      setMatterDetail(body.item);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshWorkspace = useCallback(async (preferredMatterId?: string) => {
    setIsLoading(true);
    try {
      await Promise.all([loadTemplates(), loadMatters(preferredMatterId)]);
    } finally {
      setIsLoading(false);
    }
  }, [loadMatters, loadTemplates]);

  useEffect(() => {
    void refreshWorkspace();
    return () => clearPolling();
  }, [clearPolling, refreshWorkspace]);

  useEffect(() => {
    if (templateIdFromQuery) {
      setSelectedTemplateId(templateIdFromQuery);
    }
  }, [templateIdFromQuery]);

  useEffect(() => {
    selectedMatterIdRef.current = selectedMatterId;
  }, [selectedMatterId]);

  useEffect(() => {
    if (!selectedMatterId) {
      setMatterDetail(null);
      clearPolling();
      return;
    }

    void loadMatterDetail(selectedMatterId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Unable to load matter.");
    });
  }, [clearPolling, loadMatterDetail, selectedMatterId]);

  const selectedTemplateName = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId)?.name ?? null,
    [selectedTemplateId, templates]
  );

  async function uploadMatterFile(kind: "PRECEDENT" | "TERMSHEET", file: File) {
    if (!selectedMatterId) {
      throw new Error("Create or select a matter first.");
    }

    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);

    const response = await fetch(`/api/matters/${encodeURIComponent(selectedMatterId)}/uploads`, {
      method: "POST",
      body: form,
      credentials: "include"
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error ?? `Unable to upload ${kind.toLowerCase()}.`);
    }
  }

  async function attachTemplateToMatter(templateId: string, matterId: string) {
    const response = await fetch(`/api/matters/${encodeURIComponent(matterId)}/precedent-from-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ templateId })
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error ?? "Unable to attach template.");
    }
  }

  const beginPolling = useCallback((jobId: string) => {
    clearPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { credentials: "include" });
        const body = (await response.json().catch(() => null)) as { status?: string; error?: string } | null;
        if (!response.ok) {
          throw new Error(body?.error ?? "Unable to fetch job status.");
        }

        if (body?.status === "complete" || body?.status === "failed") {
          clearPolling();
          await refreshWorkspace(selectedMatterId ?? undefined);
          if (selectedMatterId) {
            await loadMatterDetail(selectedMatterId);
          }
          setRunningJob(false);
          if (body.status === "complete") {
            setNotice("Draft generated. Output is ready to download.");
          }
        }
      } catch (pollError) {
        clearPolling();
        setRunningJob(false);
        setError(pollError instanceof Error ? pollError.message : "Unable to track job progress.");
      }
    }, 2000);
  }, [clearPolling, loadMatterDetail, refreshWorkspace, selectedMatterId]);

  useEffect(() => {
    if (matterDetail?.latestJob?.status === "processing") {
      setRunningJob(true);
      beginPolling(matterDetail.latestJob.id);
      return;
    }

    if (matterDetail?.latestJob?.status !== "queued") {
      clearPolling();
      setRunningJob(false);
    }
  }, [beginPolling, clearPolling, matterDetail?.latestJob?.id, matterDetail?.latestJob?.status]);

  async function onCreateMatter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newMatterTitle.trim()) {
      setError("Matter title is required.");
      return;
    }

    try {
      setError("");
      setNotice("");
      setSubmittingMatter(true);

      const response = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newMatterTitle })
      });
      const body = (await response.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!response.ok || !body?.id) {
        throw new Error(body?.error ?? "Unable to create matter.");
      }

      if (selectedTemplateId) {
        await attachTemplateToMatter(selectedTemplateId, body.id);
      }

      setNewMatterTitle("");
      const nextMatterId = await loadMatters(body.id);
      if (nextMatterId) {
        await loadMatterDetail(nextMatterId);
      }
      setNotice(selectedTemplateId ? "Matter created and precedent template attached." : "Matter created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create matter.");
    } finally {
      setSubmittingMatter(false);
    }
  }

  async function onUploadPrecedent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!precedentFile) {
      setError("Choose a precedent file first.");
      return;
    }

    try {
      setError("");
      setNotice("");
      setUploading("precedent");
      await uploadMatterFile("PRECEDENT", precedentFile);
      setPrecedentFile(null);
      await refreshWorkspace(selectedMatterId ?? undefined);
      if (selectedMatterId) {
        await loadMatterDetail(selectedMatterId);
      }
      setNotice("Precedent uploaded to the selected matter.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload precedent.");
    } finally {
      setUploading(null);
    }
  }

  async function onUploadTermSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termSheetFile) {
      setError("Choose a term sheet file first.");
      return;
    }

    try {
      setError("");
      setNotice("");
      setUploading("termsheet");
      await uploadMatterFile("TERMSHEET", termSheetFile);
      setTermSheetFile(null);
      await refreshWorkspace(selectedMatterId ?? undefined);
      if (selectedMatterId) {
        await loadMatterDetail(selectedMatterId);
      }
      setNotice("Term sheet uploaded to the selected matter.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload term sheet.");
    } finally {
      setUploading(null);
    }
  }

  async function onAttachTemplate() {
    if (!selectedMatterId) {
      setError("Create or select a matter first.");
      return;
    }
    if (!selectedTemplateId) {
      setError("Select a saved template first.");
      return;
    }

    try {
      setError("");
      setNotice("");
      setUploading("template");
      await attachTemplateToMatter(selectedTemplateId, selectedMatterId);
      await refreshWorkspace(selectedMatterId);
      await loadMatterDetail(selectedMatterId);
      setNotice("Saved template attached as the active precedent.");
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : "Unable to attach template.");
    } finally {
      setUploading(null);
    }
  }

  async function onRunMatter() {
    if (!selectedMatterId) {
      setError("Create or select a matter first.");
      return;
    }

    try {
      setError("");
      setNotice("");
      setRunningJob(true);
      const response = await fetch(`/api/matters/${encodeURIComponent(selectedMatterId)}/draft`, {
        method: "POST",
        credentials: "include"
      });
      const body = (await response.json().catch(() => null)) as { jobId?: string; error?: string } | null;
      if (!response.ok || !body?.jobId) {
        throw new Error(body?.error ?? "Unable to start drafting.");
      }

      await refreshWorkspace(selectedMatterId);
      await loadMatterDetail(selectedMatterId);
      beginPolling(body.jobId);
      setNotice("Drafting run started.");
    } catch (runError) {
      setRunningJob(false);
      setError(runError instanceof Error ? runError.message : "Unable to start drafting.");
    }
  }

  async function onDownloadOutput() {
    if (!matterDetail?.latestOutput) {
      setError("No generated output is available yet.");
      return;
    }

    try {
      setError("");
      setDownloadingOutput(true);
      const response = await fetch(`/api/jobs/${encodeURIComponent(matterDetail.latestOutput.jobId)}/output`, {
        credentials: "include"
      });
      if (!response.ok) {
        const message = (await response.text().catch(() => "Unable to download output.")) || "Unable to download output.";
        throw new Error(message);
      }

      const blob = await response.blob();
      const filename =
        parseFilenameFromDisposition(response.headers.get("Content-Disposition")) ?? matterDetail.latestOutput.filename;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download output.");
    } finally {
      setDownloadingOutput(false);
    }
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Workspace</p>
          <h1 className="text-2xl font-semibold text-[#10243F]">Matters</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            Manage each deal from one place: attach a precedent, add the term sheet, run generation, and download the output.
          </p>
        </div>
        {selectedTemplateName && (
          <div className="rounded-panel border border-[#c5d8f7] bg-[#f4f8ff] px-4 py-3 text-sm text-slate-700">
            Template ready: <span className="font-medium text-slate-900">{selectedTemplateName}</span>
          </div>
        )}
      </div>

      {error && <p className="rounded-panel border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-panel border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

      {isLoading ? (
        <p className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4 text-sm text-slate-600">Loading matters...</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-5">
            <form
              onSubmit={onCreateMatter}
              className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-4 shadow-[0_10px_24px_rgba(16,36,63,0.08)]"
            >
              <h2 className="text-lg font-semibold text-[#10243F]">New matter</h2>
              <p className="mt-1 text-sm text-slate-600">Create a matter before attaching inputs or running drafting.</p>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm text-slate-700">Matter title</span>
                <input
                  value={newMatterTitle}
                  onChange={(event) => setNewMatterTitle(event.target.value)}
                  className="w-full rounded-lg border border-[#d7e4fb] bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
                  placeholder="e.g. Project Tui acquisition"
                />
              </label>
              <button
                type="submit"
                disabled={submittingMatter}
                className="mt-4 rounded-full border border-[#10243F] bg-[#10243F] px-4 py-2 text-sm text-white transition hover:bg-[#0d1d33] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingMatter ? "Creating..." : "Create matter"}
              </button>
            </form>

            <div className="rounded-panel border border-[#d7e4fb] bg-white shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
              <div className="border-b border-[#e6eefb] px-4 py-3">
                <h2 className="text-lg font-semibold text-[#10243F]">Matter list</h2>
              </div>
              <div className="divide-y divide-[#e6eefb]">
                {matters.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-slate-600">No matters yet. Create the first one to start the MVP flow.</p>
                ) : (
                  matters.map((matter) => (
                    <button
                      key={matter.id}
                      type="button"
                      onClick={() => setSelectedMatterId(matter.id)}
                      className={`block w-full px-4 py-4 text-left transition ${
                        selectedMatterId === matter.id ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{matter.title}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {matter.latestJob ? `Latest run: ${matter.latestJob.status}` : "No runs yet"}
                          </p>
                        </div>
                        {matter.latestOutput && (
                          <span className="rounded-full bg-[#d9eaff] px-2 py-1 text-[11px] font-medium text-[#1f4f83]">
                            Output ready
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {!selectedMatterId ? (
              <div className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-6 text-sm text-slate-600">
                Select a matter to view inputs, runs, and outputs.
              </div>
            ) : detailLoading || !matterDetail ? (
              <div className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-6 text-sm text-slate-600">Loading matter detail...</div>
            ) : (
              <>
                <div className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-6 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Selected matter</p>
                      <h2 className="mt-1 text-2xl font-semibold text-[#10243F]">{matterDetail.title}</h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Created {new Date(matterDetail.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onRunMatter()}
                      disabled={
                        runningJob ||
                        !matterDetail.activePrecedent ||
                        !matterDetail.activeTermSheet ||
                        matterDetail.latestJob?.status === "processing"
                      }
                      className="rounded-full border border-[#10243F] bg-[#10243F] px-4 py-2 text-sm text-white transition hover:bg-[#0d1d33] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {runningJob || matterDetail.latestJob?.status === "processing" ? "Drafting..." : "Run drafting"}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-[#d7e4fb] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Active precedent</p>
                      {matterDetail.activePrecedent ? (
                        <>
                          <p className="mt-2 font-medium text-slate-900">{matterDetail.activePrecedent.filename}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            {matterDetail.activePrecedent.sourceTemplateName
                              ? `From template: ${matterDetail.activePrecedent.sourceTemplateName}`
                              : "Uploaded directly to this matter"}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No precedent attached yet.</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[#d7e4fb] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Active term sheet</p>
                      {matterDetail.activeTermSheet ? (
                        <p className="mt-2 font-medium text-slate-900">{matterDetail.activeTermSheet.filename}</p>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No term sheet attached yet.</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[#d7e4fb] bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Latest run</p>
                      {matterDetail.latestJob ? (
                        <>
                          <p className="mt-2 font-medium capitalize text-slate-900">{matterDetail.latestJob.status}</p>
                          <p className="mt-1 text-xs text-slate-600">Progress {matterDetail.latestJob.progress}%</p>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No run yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <form
                    onSubmit={onUploadPrecedent}
                    className="rounded-panel border border-[#d7e4fb] bg-white p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]"
                  >
                    <h3 className="text-lg font-semibold text-[#10243F]">Upload one-off precedent</h3>
                    <p className="mt-1 text-sm text-slate-600">Use this for a matter-specific base document.</p>
                    <input
                      type="file"
                      accept=".docx,.pdf"
                      onChange={(event) => setPrecedentFile(event.target.files?.[0] ?? null)}
                      className="mt-4 block w-full rounded-lg border border-[#d7e4fb] bg-[#f8fbff] px-3 py-2 text-sm text-slate-800 file:mr-3 file:rounded-md file:border file:border-[#d7e4fb] file:bg-white file:px-3 file:py-1.5"
                    />
                    <button
                      type="submit"
                      disabled={uploading !== null || !precedentFile}
                      className="mt-4 rounded-full border border-[#10243F] px-4 py-2 text-sm text-[#10243F] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploading === "precedent" ? "Uploading..." : "Upload precedent"}
                    </button>
                  </form>

                  <form
                    onSubmit={onUploadTermSheet}
                    className="rounded-panel border border-[#d7e4fb] bg-white p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]"
                  >
                    <h3 className="text-lg font-semibold text-[#10243F]">Upload term sheet</h3>
                    <p className="mt-1 text-sm text-slate-600">Attach the latest commercial terms for this matter.</p>
                    <input
                      type="file"
                      accept=".docx,.pdf,.txt"
                      onChange={(event) => setTermSheetFile(event.target.files?.[0] ?? null)}
                      className="mt-4 block w-full rounded-lg border border-[#d7e4fb] bg-[#f8fbff] px-3 py-2 text-sm text-slate-800 file:mr-3 file:rounded-md file:border file:border-[#d7e4fb] file:bg-white file:px-3 file:py-1.5"
                    />
                    <button
                      type="submit"
                      disabled={uploading !== null || !termSheetFile}
                      className="mt-4 rounded-full border border-[#10243F] px-4 py-2 text-sm text-[#10243F] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploading === "termsheet" ? "Uploading..." : "Upload term sheet"}
                    </button>
                  </form>
                </div>

                <div className="rounded-panel border border-[#d7e4fb] bg-white p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="min-w-[260px] flex-1">
                      <span className="mb-2 block text-sm text-slate-700">Attach saved template as precedent</span>
                      <select
                        value={selectedTemplateId}
                        onChange={(event) => setSelectedTemplateId(event.target.value)}
                        className="w-full rounded-lg border border-[#d7e4fb] bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
                      >
                        <option value="">Select a saved template</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void onAttachTemplate()}
                      disabled={uploading !== null || !selectedTemplateId}
                      className="rounded-full border border-[#10243F] px-4 py-2 text-sm text-[#10243F] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploading === "template" ? "Attaching..." : "Attach template"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-panel border border-[#d7e4fb] bg-white p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-[#10243F]">Matter history</h3>
                      <span className="text-xs text-slate-500">{matterDetail.uploads.length} uploads</span>
                    </div>
                    {matterDetail.uploads.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-600">No precedent or term sheet files have been attached yet.</p>
                    ) : (
                      <ul className="mt-4 space-y-3">
                        {matterDetail.uploads
                          .slice()
                          .reverse()
                          .map((upload) => (
                            <li key={upload.id} className="rounded-2xl border border-[#e6eefb] bg-[#f8fbff] p-4">
                              <p className="font-medium text-slate-900">{upload.filename}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#355f95]">{upload.kind}</p>
                              <p className="mt-1 text-xs text-slate-600">
                                {upload.sourceTemplateName
                                  ? `Template snapshot: ${upload.sourceTemplateName}`
                                  : "Direct matter upload"}
                              </p>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-panel border border-[#d7e4fb] bg-white p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
                      <h3 className="text-lg font-semibold text-[#10243F]">Output</h3>
                      {matterDetail.latestOutput ? (
                        <>
                          <p className="mt-3 text-sm text-slate-700">{matterDetail.latestOutput.filename}</p>
                          <button
                            type="button"
                            onClick={() => void onDownloadOutput()}
                            disabled={downloadingOutput}
                            className="mt-4 rounded-full border border-[#10243F] bg-[#10243F] px-4 py-2 text-sm text-white transition hover:bg-[#0d1d33] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {downloadingOutput ? "Downloading..." : "Download output"}
                          </button>
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-slate-600">No generated output yet.</p>
                      )}
                    </div>

                    <div className="rounded-panel border border-[#d7e4fb] bg-white p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
                      <h3 className="text-lg font-semibold text-[#10243F]">Recent runs</h3>
                      {matterDetail.jobs.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-600">No jobs have been queued for this matter.</p>
                      ) : (
                        <ul className="mt-3 space-y-3">
                          {matterDetail.jobs.map((job) => (
                            <li key={job.id} className="rounded-2xl border border-[#e6eefb] bg-[#f8fbff] p-4">
                              <p className="text-sm font-medium capitalize text-slate-900">{job.status}</p>
                              <p className="mt-1 text-xs text-slate-600">Progress {job.progress}%</p>
                              {job.errorMessage && <p className="mt-2 text-xs text-red-700">{job.errorMessage}</p>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
