"use client";

import { useEffect, useState } from "react";

type AuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
};

type BillingStatus = {
  active: boolean;
  plan: string;
  expiresAt?: string;
};

export default function AccountPage() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAccountData() {
      try {
        setError("");
        setIsLoading(true);

        const [authResponse, billingResponse] = await Promise.all([
          fetch("/api/auth/me", { credentials: "include" }),
          fetch("/api/billing/status", { credentials: "include" })
        ]);

        const authBody = (await authResponse.json().catch(() => null)) as
          | { authenticated?: boolean; user?: AuthenticatedUser }
          | null;
        const billingBody = (await billingResponse.json().catch(() => null)) as
          | { active?: boolean; plan?: string; expiresAt?: string; error?: string }
          | null;

        if (!mounted) {
          return;
        }

        if (!authResponse.ok || !authBody?.authenticated || !authBody.user) {
          setError("Unable to load account profile.");
          return;
        }

        setUser(authBody.user);

        if (billingResponse.ok) {
          setBilling({
            active: Boolean(billingBody?.active),
            plan: String(billingBody?.plan ?? "free"),
            expiresAt: billingBody?.expiresAt
          });
        } else {
          setBilling(null);
        }
      } catch {
        if (mounted) {
          setError("Unable to load account data.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAccountData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Workspace</p>
        <h1 className="text-2xl font-semibold text-[#10243F]">Account</h1>
        <p className="mt-2 text-sm text-slate-700">Manage profile and security preferences for your workspace.</p>
      </div>

      {error && <p className="rounded-panel border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <p className="rounded-panel border border-[#d7e4fb] bg-[#f8fbff] p-4 text-sm text-slate-600">Loading account data...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
            <h2 className="font-medium text-slate-900">Profile</h2>
            {user ? (
              <dl className="mt-3 space-y-2 text-sm text-slate-700">
                <div>
                  <dt className="text-slate-500">Display name</dt>
                  <dd>{user.displayName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Username</dt>
                  <dd>{user.username}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Role</dt>
                  <dd className="capitalize">{user.role}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-700">Profile details are not available.</p>
            )}
          </article>

          <article className="rounded-panel border border-[#d7e4fb] bg-gradient-to-b from-white to-[#f8fbff] p-5 shadow-[0_10px_24px_rgba(16,36,63,0.08)]">
            <h2 className="font-medium text-slate-900">Billing and access</h2>
            {billing ? (
              <dl className="mt-3 space-y-2 text-sm text-slate-700">
                <div>
                  <dt className="text-slate-500">Plan</dt>
                  <dd className="uppercase">{billing.plan}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Subscription status</dt>
                  <dd>{billing.active ? "Active" : "Inactive"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Expires</dt>
                  <dd>{billing.expiresAt ? new Date(billing.expiresAt).toLocaleString() : "No expiry date set"}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-700">Billing status is currently unavailable.</p>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
