"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/Container";

type AuthenticatedUser = {
  username: string;
  displayName: string;
  role: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchSession() {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok || !mounted) {
          return;
        }
        const body = (await response.json()) as {
          authenticated: boolean;
          user?: AuthenticatedUser;
        };

        if (body.authenticated && body.user) {
          setCurrentUser(body.user);
        }
      } catch {
        // Intentionally ignore session fetch errors on initial page load.
      }
    }

    void fetchSession();

    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!username.trim() || !password) {
      setErrorMessage("Username and password are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string; user?: AuthenticatedUser }
        | null;

      if (!response.ok || !body?.user) {
        setErrorMessage(body?.error ?? "Unable to sign in.");
        return;
      }

      setCurrentUser(body.user);
      setPassword("");
      setSuccessMessage(`Welcome, ${body.user.displayName}. You are now logged in.`);
      window.setTimeout(() => router.push("/dashboard/drafting"), 900);
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onLogout() {
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setUsername("");
      setPassword("");
      setSuccessMessage("You are now logged out.");
    } catch {
      setErrorMessage("Unable to log out right now.");
    }
  }

  return (
    <Container className="py-16">
      <section className="mx-auto max-w-xl rounded-panel border border-[#d7e4fb] bg-white p-6 shadow-panel md:p-8">
        <h1 className="text-3xl font-semibold text-[#10243F]">Client Login</h1>
        <p className="mt-3 text-sm text-slate-700">Securely access your Accretive workspace using your unique credentials.</p>
        <div className="mt-4 rounded-lg border border-[#d7e4fb] bg-[#f4f8ff] p-3 text-sm text-slate-700">
          <p>
            Demo account: <span className="font-semibold">Lucas</span> / <span className="font-semibold">accretive123</span>
          </p>
          {!currentUser && (
            <button
              type="button"
              onClick={() => {
                setUsername("Lucas");
                setPassword("accretive123");
              }}
              className="mt-2 rounded-full border border-[#10243F] px-4 py-1.5 text-xs font-medium text-[#10243F] transition hover:bg-[#e7f0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            >
              Use demo credentials
            </button>
          )}
        </div>

        {currentUser ? (
          <div className="mt-8 space-y-4">
            <p className="rounded-lg border border-emerald-300/30 bg-emerald-900/30 p-3 text-sm text-emerald-100">
              Signed in as {currentUser.displayName} ({currentUser.username})
            </p>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full border border-[#10243F] px-5 py-2 text-sm text-[#10243F] transition hover:bg-[#e7f0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            >
              Log out
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Username</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
                required
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full border border-[#10243F] bg-[#10243F] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0d1d33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Signing in..." : "Log in"}
            </button>
          </form>
        )}

        {errorMessage && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-300/30 bg-rose-900/40 p-3 text-sm text-rose-100">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p role="status" className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-900/40 p-3 text-sm text-emerald-100">
            {successMessage}
          </p>
        )}
      </section>
    </Container>
  );
}
