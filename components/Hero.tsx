export default function Hero({ onWatchDemo }: { onWatchDemo: () => void }) {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-start justify-center pt-32 pb-16 text-center md:pt-36">
      <div className="max-w-3xl">
        <p className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
          Spend more time with clients, not buried in legal documents
        </p>
        <p className="mt-6 text-base text-slate-200 md:text-lg">
          Your documents. Your judgment. Our mechanics.
        </p>
        <button
          type="button"
          onClick={onWatchDemo}
          className="mt-10 rounded-full border border-white bg-white px-6 py-3 text-sm font-semibold text-[#0B1F4D] shadow-md transition hover:bg-[#dbe9ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          See Workflow Demo
        </button>
      </div>
    </section>
  );
}
