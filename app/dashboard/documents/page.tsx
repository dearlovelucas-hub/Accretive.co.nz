"use client";

import { useEffect, useState } from "react";

type DocumentItem = {
  id: string;
  name: string;
  templateFileName: string;
  status: string;
  updatedAt: string;
};

export default function DocumentsPage() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDocuments() {
      try {
        setError("");
        setIsLoading(true);
        const response = await fetch("/api/documents");
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

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Workspace</p>
        <h1 className="text-2xl font-semibold text-[#10243F]">My documents</h1>
        <p className="mt-2 text-sm text-slate-700">Generated drafts and work in progress.</p>
      </div>

      {error && <p className="rounded-panel border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

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
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6eefb] bg-white text-slate-800">
              {items.map((doc) => (
                <tr key={doc.id} className="hover:bg-[#f8fbff]">
                  <td className="px-4 py-3">{doc.name}</td>
                  <td className="px-4 py-3">{doc.templateFileName}</td>
                  <td className="px-4 py-3 capitalize">{doc.status}</td>
                  <td className="px-4 py-3">{new Date(doc.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
