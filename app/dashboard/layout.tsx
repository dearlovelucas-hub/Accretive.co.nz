import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthCookieName, parseSessionToken } from "@/lib/server/auth";
import Sidebar from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAuthCookieName())?.value;
  const session = parseSessionToken(token);

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#edf4ff] via-[#f5f9ff] to-white px-4 py-4 md:px-6 md:py-6">
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-[#c7dcff]/45 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-24 h-64 w-64 rounded-full bg-[#b5d0ff]/35 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1480px] flex-col gap-4 lg:flex-row md:min-h-[calc(100vh-3rem)]">
        <Sidebar displayName={session.displayName} />
        <section className="flex-1 rounded-panel border border-[#d7e4fb] bg-white/95 p-6 text-[#0f172a] shadow-[0_16px_40px_rgba(16,36,63,0.12)] md:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
