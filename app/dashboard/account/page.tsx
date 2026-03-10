export default function AccountPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Workspace</p>
        <h1 className="text-2xl font-semibold text-[#10243F]">Account</h1>
        <p className="mt-2 text-sm text-slate-700">Manage profile and security preferences for your workspace.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <article className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
          <h2 className="font-medium text-slate-900">Profile</h2>
          <p className="mt-1 text-sm text-slate-700">Update your display name, role, and contact details.</p>
        </article>

        <article className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
          <h2 className="font-medium text-slate-900">Security</h2>
          <p className="mt-1 text-sm text-slate-700">Review active sessions and authentication settings.</p>
        </article>
      </div>
    </section>
  );
}
