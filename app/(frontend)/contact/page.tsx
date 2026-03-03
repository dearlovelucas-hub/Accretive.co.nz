import Container from "@/components/Container";

export default function ContactPage() {
  return (
    <Container className="py-16">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-semibold text-[#10243F]">Contact</h1>
        <p className="mt-4 text-slate-700">Send us a message and we will get back to you soon.</p>
        <p className="mt-2 text-slate-700">
          Email:{" "}
          <a
            href="mailto:lucas@accretive.co.nz"
            className="text-[#355f95] underline decoration-[#355f95]/70 underline-offset-2 hover:text-[#10243F]"
          >
            lucas@accretive.co.nz
          </a>
        </p>
      </header>

      <section className="mt-10 rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <form action="mailto:lucas@accretive.co.nz" method="post" encType="text/plain" className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Full name</span>
              <input
                required
                name="Full name"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Email</span>
              <input
                required
                type="email"
                name="Email"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">Organisation</span>
            <input
              name="Organisation"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">Message</span>
            <textarea
              required
              name="Message"
              rows={5}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            />
          </label>

          <button
            type="submit"
            className="rounded-full border border-[#10243F] bg-[#10243F] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
          >
            Send message
          </button>
        </form>
      </section>
    </Container>
  );
}
