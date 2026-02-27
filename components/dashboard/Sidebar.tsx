"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/dashboard/drafting",
    label: "Drafting",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  },
  {
    href: "/dashboard/documents",
    label: "My documents",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 3h8l4 4v14H8z" />
        <path d="M16 3v5h4" />
      </svg>
    )
  },
  {
    href: "/dashboard/templates",
    label: "Templates",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    )
  },
  {
    href: "/dashboard/activity",
    label: "Activity",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 13h4l2-6 4 12 2-6h4" />
      </svg>
    )
  },
  {
    href: "/dashboard/account",
    label: "Account",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M5 20c2-4 12-4 14 0" />
      </svg>
    )
  },
  {
    href: "/pricing",
    label: "Billing",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
      </svg>
    )
  }
];

export default function Sidebar({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <aside className="flex w-full max-w-[260px] flex-col rounded-2xl border border-[#173254] bg-[#10243F] p-4 text-white shadow-panel">
      <div className="border-b border-white/15 pb-4">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-300">Accretive Workspace</p>
        <p className="mt-2 text-sm text-white">Signed in as {displayName}</p>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-2" aria-label="Dashboard">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                active ? "bg-white font-semibold text-[#0B1F4D]" : "text-slate-100 hover:bg-white/10"
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-4 rounded-lg border border-white/30 px-3 py-2 text-sm text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Log out
      </button>
    </aside>
  );
}
