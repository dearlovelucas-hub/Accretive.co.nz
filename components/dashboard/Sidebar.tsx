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
    <aside className="flex w-full flex-col rounded-panel border border-[#d7e4fb] bg-white/80 p-4 text-[#10243F] shadow-[0_14px_36px_rgba(16,36,63,0.12)] backdrop-blur-xl lg:max-w-[280px]">
      <div className="flex items-center justify-between gap-3 border-b border-[#d7e4fb] pb-3 lg:block lg:pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[#355f95]">Accretive Workspace</p>
          <p className="mt-2 text-sm text-slate-700">Signed in as {displayName}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-[#10243F] px-3 py-1.5 text-xs text-[#10243F] transition hover:bg-[#eef4ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95] lg:hidden"
        >
          Log out
        </button>
      </div>

      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:mt-4 lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Dashboard">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]",
                active
                  ? "border border-[#7fa8de] bg-[#d9eaff]/95 font-semibold text-[#10243F]"
                  : "border border-transparent text-[#1f3657] hover:border-[#d7e4fb] hover:bg-[#eef4ff]"
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
        className="mt-4 hidden rounded-full border border-[#10243F] px-3 py-2 text-sm text-[#10243F] transition hover:bg-[#eef4ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95] lg:block"
      >
        Log out
      </button>
    </aside>
  );
}
