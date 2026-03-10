"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TemplateItem = {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  updatedAt: string;
};

type TemplatePreviewResponse = {
  template: {
    id: string;
    name: string;
    fileName: string;
    fileType: string;
  };
  previewText: string | null;
  previewNote: string;
};

function displayTemplateName(template: Pick<TemplateItem, "name" | "fileName">): string {
  return template.name?.trim() || template.fileName;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewNote, setPreviewNote] = useState("");
  const [previewError, setPreviewError] = useState("");

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

  async function onPreviewTemplate(template: TemplateItem) {
    try {
      setPreviewTemplate(template);
      setIsPreviewLoading(true);
      setPreviewError("");
      setPreviewText(null);
      setPreviewNote("");

      const response = await fetch(`/api/templates/${template.id}/preview`);
      const body = (await response.json().catch(() => null)) as
        | (TemplatePreviewResponse & { error?: string })
        | null;

      if (!response.ok || !body) {
        setPreviewError(body?.error ?? "Unable to preview template.");
        return;
      }

      setPreviewText(body.previewText);
      setPreviewNote(body.previewNote);
    } catch {
      setPreviewError("Unable to preview template.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewTemplate(null);
    setIsPreviewLoading(false);
    setPreviewText(null);
    setPreviewNote("");
    setPreviewError("");
  }

  function onUseTemplateForDrafting(templateId: string) {
    closePreview();
    router.push(`/dashboard/drafting?templateId=${encodeURIComponent(templateId)}`);
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Workspace</p>
          <h1 className="text-2xl font-semibold text-[#10243F]">Templates</h1>
          <p className="mt-2 text-sm text-slate-700">Manage approved drafting templates used by your team.</p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[#10243F] bg-[#10243F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
        >
          <span aria-hidden="true">+</span>
          New template
        </button>
      </div>

      {error && <p className="rounded-panel border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <p className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4 text-sm text-slate-600">Loading templates...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.length === 0 ? (
            <p className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4 text-sm text-slate-600">No templates yet. Add your first template.</p>
          ) : (
            items.map((template) => (
              <article
                key={template.id}
                className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-4 shadow-[0_10px_24px_rgba(16,36,63,0.08)]"
              >
                <h2 className="font-medium text-slate-900">{displayTemplateName(template)}</h2>
                <p className="mt-1 text-xs text-slate-600">File: {template.fileName}</p>
                <p className="mt-1 text-xs text-slate-600">Updated: {new Date(template.updatedAt).toLocaleString()}</p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void onPreviewTemplate(template)}
                    className="rounded-full border border-[#d7e4fb] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-[#eef4ff]"
                  >
                    Preview template
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel">
            <h3 className="text-lg font-semibold text-[#10243F]">Add new template</h3>
            <p className="mt-1 text-sm text-slate-700">Upload a DOCX or PDF to use as a base template.</p>

            <form onSubmit={onCreateTemplate} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-700">Template name (optional)</span>
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  className="w-full rounded-lg border border-[#d7e4fb] bg-[#f8fbff] px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-700">Template file *</span>
                <input
                  required
                  type="file"
                  accept=".docx,.pdf"
                  onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-lg border border-[#d7e4fb] bg-[#f8fbff] px-3 py-2 text-sm text-slate-800 file:mr-3 file:rounded-md file:border file:border-[#d7e4fb] file:bg-white file:px-3 file:py-1.5"
                />
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full border border-[#10243F] bg-[#10243F] px-4 py-2 text-sm text-white transition hover:bg-[#0d1d33] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save template"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-[#d7e4fb] px-4 py-2 text-sm text-slate-700 transition hover:bg-[#eef4ff]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#10243F]">{displayTemplateName(previewTemplate)}</h3>
                <p className="mt-1 text-sm text-slate-600">{previewTemplate.fileName}</p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="rounded-full border border-[#d7e4fb] px-3 py-1 text-sm text-slate-700 transition hover:bg-[#eef4ff]"
              >
                Close
              </button>
            </div>

            <div className="mt-4 max-h-[50vh] overflow-auto rounded-lg border border-[#d7e4fb] bg-[#f8fbff] p-4">
              {isPreviewLoading ? (
                <p className="text-sm text-slate-600">Loading preview...</p>
              ) : previewError ? (
                <p className="text-sm text-red-700">{previewError}</p>
              ) : previewText ? (
                <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{previewText}</pre>
              ) : (
                <p className="text-sm text-slate-700">{previewNote || "Preview unavailable."}</p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onUseTemplateForDrafting(previewTemplate.id)}
                className="rounded-full border border-[#10243F] bg-[#10243F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0d1d33]"
              >
                Use this template in Drafting
              </button>
              <p className="text-xs text-slate-600">
                Drafting will open with this template preloaded. You can then upload transaction documents.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
