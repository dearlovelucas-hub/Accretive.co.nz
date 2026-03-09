import Link from "next/link";

export default function Hero({ onWatchDemo }: { onWatchDemo: () => void }) {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-start justify-center pt-32 pb-16 text-center md:pt-36">
      <div className="max-w-3xl">
        <p className="text-3xl font-semibold tracking-tight text-[#10243F] md:text-5xl">
          Transaction drafting, done properly.
        </p>
        <p className="mt-6 text-base text-slate-700 md:text-lg">
          Accretive reads your precedent templates and transaction documents, then returns a populated Word file — ready for your review.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Used by growing New Zealand law firms handling commercial transactions.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/request-demo"
            className="rounded-full border border-[#10243F] bg-[#10243F] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10243F]"
          >
            Book a walkthrough
          </Link>
          <button
            type="button"
            onClick={onWatchDemo}
            className="rounded-full border border-[#355f95] bg-white px-6 py-3 text-sm font-semibold text-[#10243F] shadow-sm transition hover:bg-[#eef4ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
          >
            See a workflow demo
          </button>
        </div>
      </div>
    </section>
  );
}
