import Link from "next/link";

const previewSteps = [
  "Template document (DOCX/PDF)",
  "Transaction Documents / Term Sheet",
  "Deal information and elections",
  "Generated first draft with review trace"
];

export default function UploadDemo() {
  return (
    <section className="space-y-6 rounded-panel border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Drafting workflow preview</h2>
        <p className="mt-2 text-sm text-slate-200">
          This is a product preview on the marketing site. Live drafting is available inside the workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-white/15 bg-slate-950/50 p-4">
          <h3 className="text-sm font-medium text-white">Inputs</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-200">
            {previewSteps.slice(0, 3).map((step) => (
              <li key={step} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                {step}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-white/15 bg-slate-950/50 p-4">
          <h3 className="text-sm font-medium text-white">Output</h3>
          <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-900/20 px-3 py-3 text-sm text-emerald-100">
            {previewSteps[3]}
          </div>
          <p className="mt-3 text-xs text-slate-300">
            Includes validation prompts, clause-level decision points, and downloadable DOCX output.
          </p>
        </article>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/request-demo"
          className="rounded-full border border-mist/70 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist"
        >
          Book a live demo
        </Link>
        <span className="text-xs text-slate-300">Need hands-on access? Ask for a workspace trial.</span>
      </div>
    </section>
  );
}
