const events = [
  { text: "Draft generated from Share purchase agreement", when: "10 minutes ago" },
  { text: "Template updated: Loan agreement", when: "1 hour ago" },
  { text: "New user login from approved device", when: "Today" }
];

export default function ActivityPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#10243F]">Activity</h1>
        <p className="mt-2 text-sm text-slate-700">Recent drafting and workspace events.</p>
      </div>

      <ul className="space-y-3">
        {events.map((event) => (
          <li key={event.text} className="rounded-xl border border-slate-300 p-4">
            <p className="text-sm text-slate-900">{event.text}</p>
            <p className="mt-1 text-xs text-slate-600">{event.when}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
