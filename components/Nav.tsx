"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/our-product", label: "Platform" },
  { href: "/security-policy", label: "Security" },
  { href: "/news-and-releases", label: "News" }
];

const featuredInsightHref =
  "/news-and-releases/new-zealands-responsible-ai-guidance-for-businesses-what-legal-and-tech-leaders-need-to-know";

export default function Nav() {
  const pathname = usePathname();

  function isActiveLink(href: string): boolean {
    const route = href.split("#")[0] || "/";
    if (route === "/") {
      return pathname === "/";
    }
    return pathname === route || pathname.startsWith(`${route}/`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-3 md:px-5">
        <Link
          href="/"
          className="inline-flex items-center text-3xl font-semibold tracking-tight text-[#10243F] transition hover:text-[#355f95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95] md:text-4xl font-[var(--font-wordmark)]"
        >
          Accretive
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2 overflow-x-auto">
          {links.map((link) => {
            const active = isActiveLink(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]",
                  "border border-slate-300 bg-white text-[#10243F] hover:border-[#355f95] hover:bg-[#eef4ff]",
                  active && "border-[#7fa8de] bg-[#d9eaff] font-semibold text-[#10243F]"
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/login"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]",
              "border border-[#10243F] bg-[#10243F] text-white hover:bg-[#0d1d33]"
            )}
            aria-current={pathname === "/login" ? "page" : undefined}
          >
            Sign In
          </Link>
        </nav>
      </div>
      <div className="border-t border-[#1d3f6e] bg-[#10243F]">
        <Link
          href={featuredInsightHref}
          className="block px-3 py-2 text-center text-sm font-semibold text-[#e7f0ff] transition hover:bg-[#163257] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9dbcec] md:px-5"
        >
          New Insight: New Zealand&apos;s Responsible AI Guidance for Businesses
        </Link>
      </div>
    </header>
  );
}
