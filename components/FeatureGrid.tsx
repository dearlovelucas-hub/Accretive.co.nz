const features = [
  {
    emoji: "🛡️",
    title: "Confidentiality",
    body: "Every matter workspace is isolated. Documents uploaded to one matter are not accessible from another, and client materials are encrypted in transit and at rest."
  },
  {
    emoji: "🎯",
    title: "Consistency",
    body: "Transaction details are applied systematically to your firm's own precedents, reducing the risk of missed fields, stale language, or inconsistent party names across a document suite."
  },
  {
    emoji: "⚡",
    title: "Efficiency",
    body: "From uploaded documents to a populated first draft in minutes. Junior lawyers spend less time on mechanical population and more time on substantive review."
  },
  {
    emoji: "📋",
    title: "Familiar output",
    body: "Every document is returned in Word DOCX format with tracked changes visible. Review and approval stay within your firm's existing workflow."
  }
];

export default function FeatureGrid() {
  return (
    <section className="py-20">
      <h2 className="text-3xl font-semibold text-[#10243F]">Why growing firms use Accretive</h2>
      <p className="mt-3 text-slate-700">
        As transaction volume increases, so do the risks of drafting inconsistency and confidentiality drift. Accretive
        reduces both by applying transaction details systematically within matter-level security boundaries.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f6f9ff] p-6 shadow-[0_10px_24px_rgba(16,36,63,0.08)]"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl leading-none" aria-hidden="true">
                {feature.emoji}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-[#10243F]">{feature.title}</h3>
                <p className="mt-3 text-slate-700">{feature.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
