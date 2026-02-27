"use client";

import { useState } from "react";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onUpgrade() {
    try {
      setError("");
      setIsLoading(true);
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" })
      });

      const body = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; error?: string }
        | null;

      if (!response.ok || !body?.checkoutUrl) {
        setError(body?.error ?? "Unable to start checkout.");
        return;
      }

      window.location.href = body.checkoutUrl;
    } catch {
      setError("Network error while starting checkout.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-14">
      <section className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-semibold text-[#10243F]">Pricing</h1>
        <p className="mt-3 text-slate-700">Upgrade to unlock full generated draft output and downloads.</p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-300 p-6">
            <h2 className="text-xl font-semibold text-slate-900">Free</h2>
            <p className="mt-2 text-sm text-slate-700">Preview-only generated output.</p>
            <p className="mt-4 text-3xl font-semibold text-[#10243F]">$0</p>
          </article>

          <article className="rounded-2xl border-2 border-[#10243F] p-6 shadow-panel">
            <h2 className="text-xl font-semibold text-slate-900">Pro</h2>
            <p className="mt-2 text-sm text-slate-700">Full output access, downloads, and priority processing.</p>
            <p className="mt-4 text-3xl font-semibold text-[#10243F]">$99/mo</p>
            <button
              type="button"
              onClick={onUpgrade}
              disabled={isLoading}
              className="mt-6 rounded-full bg-[#10243F] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#0d1d33] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Starting checkout..." : "Upgrade to Pro"}
            </button>
          </article>
        </div>

        {error && <p className="mt-5 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>
    </main>
  );
}
