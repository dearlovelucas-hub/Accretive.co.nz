import { ReactNode } from "react";
import Sidebar from "@/components/dashboard/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen w-screen bg-white px-4 py-4 md:px-6 md:py-6">
      <div className="flex min-h-[calc(100vh-2rem)] w-full flex-col gap-4 lg:flex-row md:min-h-[calc(100vh-3rem)]">
        <Sidebar displayName="Demo User" />
        <section className="flex-1 rounded-2xl border-2 border-[#10243F] bg-white p-6 text-[#0f172a] md:p-8">{children}</section>
      </div>
    </main>
  );
}
