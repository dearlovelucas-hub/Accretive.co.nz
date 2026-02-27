import Container from "@/components/Container";

export default function ContactPage() {
  return (
    <Container className="py-16">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-semibold text-white">Contact</h1>
        <p className="mt-4 text-slate-200">Send us a message and we will get back to you soon.</p>
        <p className="mt-2 text-slate-200">
          Email:{" "}
          <a
            href="mailto:lucas@accretive.co.nz"
            className="text-mist underline decoration-mist/70 underline-offset-2 hover:text-white"
          >
            lucas@accretive.co.nz
          </a>
        </p>
      </header>

      <section className="mt-10 rounded-panel border border-white/10 bg-white/5 p-6 md:p-8">
        <form action="mailto:lucas@accretive.co.nz" method="post" encType="text/plain" className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-200">Full name</span>
              <input
                required
                name="Full name"
                className="w-full rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-200">Email</span>
              <input
                required
                type="email"
                name="Email"
                className="w-full rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Organisation</span>
            <input
              name="Organisation"
              className="w-full rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-200">Message</span>
            <textarea
              required
              name="Message"
              rows={5}
              className="w-full rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist"
            />
          </label>

          <button
            type="submit"
            className="rounded-full border border-mist/70 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist"
          >
            Send message
          </button>
        </form>
      </section>
    </Container>
  );
}
