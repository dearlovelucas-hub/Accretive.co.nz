import Link from "next/link";

const previewSteps = [
  "Secure template upload (DOCX/PDF)",
  "Secure transaction upload / term sheet",
  "Deal information and elections",
  "Generated first draft with review trace"
];

export default function UploadDemo() {
  return (
    <section className="space-y-6 rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel">
      <div>
        <h2 className="text-2xl font-semibold text-[#10243F]">Drafting workflow preview</h2>
        <p className="mt-2 text-sm text-slate-700">
          This is a product preview on the marketing site. Live drafting is available inside the authenticated workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-medium text-[#10243F]">Inputs</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {previewSteps.slice(0, 3).map((step) => (
              <li key={step} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                {step}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-medium text-[#10243F]">Output</h3>
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            {previewSteps[3]}
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Includes validation prompts, clause-level decision points, and downloadable DOCX output within your firm account.
          </p>
        </article>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/platform#request-demo"
          className="rounded-full border border-[#10243F] bg-[#10243F] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
        >
          Book a live demo
        </Link>
        <span className="text-xs text-slate-600">Need hands-on access? Ask for a workspace trial and security walkthrough.</span>
      </div>
    </section>
  );
}
