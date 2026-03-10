import Link from "next/link";

export default function Hero({ onWatchDemo }: { onWatchDemo: () => void }) {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-start justify-center pt-32 pb-16 text-center md:pt-36">
      <div className="max-w-3xl">
        <p className="text-3xl font-semibold tracking-tight text-[#10243F] md:text-5xl">
          Spend more time with clients, not buried in legal documents
        </p>
        <p className="mt-6 text-base text-slate-700 md:text-lg">
          Draft with structure. Protect client confidentiality.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onWatchDemo}
            className="rounded-full border border-[#10243F] bg-[#10243F] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10243F]"
          >
            See Workflow Demo
          </button>
          <Link
            href="/request-demo"
            className="rounded-full border border-[#355f95] bg-white px-6 py-3 text-sm font-semibold text-[#10243F] shadow-sm transition hover:bg-[#eef4ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
          >
            Book Demo
          </Link>
        </div>
      </div>
    </section>
  );
}
