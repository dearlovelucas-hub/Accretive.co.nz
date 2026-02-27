"use client";

import { FormEvent, useEffect, useState } from "react";

type TemplateItem = {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  updatedAt: string;
};

export default function TemplatesPage() {
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadTemplates() {
    try {
      setError("");
      setIsLoading(true);
      const response = await fetch("/api/templates");
      const body = (await response.json().catch(() => null)) as { items?: TemplateItem[]; error?: string } | null;

      if (!response.ok) {
        setError(body?.error ?? "Unable to load templates.");
        return;
      }

      setItems(body?.items ?? []);
    } catch {
      setError("Unable to load templates.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function onCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!templateFile) {
      setError("Template file is required.");
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);
      const form = new FormData();
      form.append("name", templateName);
      form.append("templateFile", templateFile);

      const response = await fetch("/api/templates", {
        method: "POST",
        body: form
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Unable to create template.");
        return;
      }

      setIsModalOpen(false);
      setTemplateName("");
      setTemplateFile(null);
      await loadTemplates();
    } catch {
      setError("Unable to create template.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#10243F]">Templates</h1>
          <p className="mt-2 text-sm text-slate-700">Manage approved drafting templates used by your team.</p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-[#10243F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0d1d33]"
        >
          <span aria-hidden="true">+</span>
          New template
        </button>
      </div>

      {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-slate-600">Loading templates...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.length === 0 ? (
            <p className="text-sm text-slate-600">No templates yet. Add your first template.</p>
          ) : (
            items.map((template) => (
              <article key={template.id} className="rounded-xl border border-slate-300 p-4">
                <h2 className="font-medium text-slate-900">{template.name}</h2>
                <p className="mt-1 text-xs text-slate-600">File: {template.fileName}</p>
                <p className="mt-1 text-xs text-slate-600">Updated: {new Date(template.updatedAt).toLocaleString()}</p>
              </article>
            ))
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#10243F]">Add new template</h3>
            <p className="mt-1 text-sm text-slate-700">Upload a DOCX or PDF to use as a base template.</p>

            <form onSubmit={onCreateTemplate} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-700">Template name (optional)</span>
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-900"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-700">Template file *</span>
                <input
                  required
                  type="file"
                  accept=".docx,.pdf"
                  onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-200 file:px-3 file:py-1.5"
                />
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-[#10243F] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save template"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
