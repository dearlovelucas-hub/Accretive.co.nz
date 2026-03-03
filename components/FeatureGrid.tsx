const features = [
  {
    emoji: "🛡️",
    title: "Security",
    body: "Firm data is logically isolated at the organisation and matter level, with encrypted storage and strict access controls."
  },
  {
    emoji: "🎯",
    title: "Accuracy",
    body: "Accretive maps transaction context to your template logic to reduce drafting errors and rework cycles."
  },
  {
    emoji: "⚡",
    title: "Speed",
    body: "Move from source documents to first draft quickly so lawyers can spend more time on judgment calls."
  },
  {
    emoji: "💸",
    title: "Cost",
    body: "No per-seat licences. No firm-wide lock-in. Only pay for the documents you generate."
  }
];

export default function FeatureGrid() {
  return (
    <section className="py-20">
      <h2 className="text-3xl font-semibold text-[#10243F]">Why Accretive</h2>
      <p className="mt-3 text-slate-700">
        Security is built into every stage of drafting, with matter-level isolation, role-based access, auditable activity, and
        encryption for sensitive client documents in transit and at rest.
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
