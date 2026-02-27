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
      <h2 className="text-3xl font-semibold text-white">Why Accretive</h2>
      <p className="mt-3 text-slate-200">Security is paramount.</p>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-panel border border-white/10 bg-white/5 p-6">
            <div className="flex items-center gap-4">
              <span className="text-2xl leading-none" aria-hidden="true">
                {feature.emoji}
              </span>
              <div>
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-slate-200">{feature.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
