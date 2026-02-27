import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthCookieName, parseSessionToken } from "@/lib/server/auth";
import Sidebar from "@/components/dashboard/Sidebar";
import Footer from "@/components/Footer";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAuthCookieName())?.value;
  const session = parseSessionToken(token);

  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <main className="w-screen bg-white px-4 py-4 md:px-6 md:py-6">
        <div className="flex min-h-[calc(100vh-2rem)] w-full flex-col gap-4 lg:flex-row md:min-h-[calc(100vh-3rem)]">
          <Sidebar displayName={session.displayName} />
          <section className="flex-1 rounded-2xl border-2 border-[#10243F] bg-white p-6 text-[#0f172a] md:p-8">{children}</section>
        </div>
      </main>
      <Footer />
    </>
  );
}
