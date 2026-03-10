"use client";

import { useEffect, useState } from "react";

type DocumentItem = {
  id: string;
  name: string;
  templateFileName: string;
  status: string;
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

export default function DocumentsPage() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDocuments() {
      try {
        setError("");
        setIsLoading(true);
        const response = await fetch("/api/documents", { credentials: "include" });
        const body = (await response.json().catch(() => null)) as { items?: DocumentItem[]; error?: string } | null;

        if (!response.ok) {
          if (mounted) setError(body?.error ?? "Unable to load documents.");
          return;
        }

        if (mounted) setItems(body?.items ?? []);
      } catch {
        if (mounted) setError("Unable to load documents.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadDocuments();
    return () => {
      mounted = false;
    };
  }, []);

  async function onDownloadDocument(item: DocumentItem) {
    try {
      setDownloadError("");
      setActiveDownloadId(item.id);

      const response = await fetch(`/api/draft-jobs/${encodeURIComponent(item.id)}/download`, {
        credentials: "include"
      });

      if (!response.ok) {
        const fallback = "Unable to download this document right now.";
        const message = (await response.text().catch(() => fallback)) || fallback;
        throw new Error(message);
      }

      const blob = await response.blob();
      const fileName =
        parseFilenameFromDisposition(response.headers.get("Content-Disposition")) ??
        `${item.name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "document"}.docx`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadFailure) {
      setDownloadError(downloadFailure instanceof Error ? downloadFailure.message : "Unable to download this document right now.");
    } finally {
      setActiveDownloadId(null);
    }
  }

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Workspace</p>
        <h1 className="text-2xl font-semibold text-[#10243F]">My documents</h1>
        <p className="mt-2 text-sm text-slate-700">Generated drafts and work in progress.</p>
      </div>

      {error && <p className="rounded-panel border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {downloadError && <p className="rounded-panel border border-red-300 bg-red-50 p-3 text-sm text-red-700">{downloadError}</p>}

      {isLoading ? (
        <p className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4 text-sm text-slate-600">Loading documents...</p>
      ) : items.length === 0 ? (
        <p className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4 text-sm text-slate-600">
          No documents yet. Generate your first draft in Drafting.
        </p>
      ) : (
        <div className="overflow-hidden rounded-panel border border-[#d7e4fb] bg-white shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
          <table className="min-w-full divide-y divide-[#dfe9fa] text-sm">
            <thead className="bg-[#f4f8ff] text-left text-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium">Document</th>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6eefb] bg-white text-slate-800">
              {items.map((doc) => (
                <tr key={doc.id} className="hover:bg-[#f8fbff]">
                  <td className="px-4 py-3">{doc.name}</td>
                  <td className="px-4 py-3">{doc.templateFileName}</td>
                  <td className="px-4 py-3 capitalize">{doc.status}</td>
                  <td className="px-4 py-3">{new Date(doc.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void onDownloadDocument(doc)}
                      disabled={doc.status !== "complete" || activeDownloadId === doc.id}
                      className="rounded-full border border-[#10243F] px-3 py-1.5 text-xs text-[#10243F] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeDownloadId === doc.id ? "Downloading..." : "Download DOCX"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
