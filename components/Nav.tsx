"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/platform", label: "Platform" },
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
    <header className="sticky top-3 z-40 px-3 md:px-5">
      <div className="mx-auto max-w-[1220px] space-y-2">
        <div className="rounded-[28px] border border-[#d7e4fb] bg-white/72 shadow-[0_14px_36px_rgba(16,36,63,0.16)] backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 md:px-6">
            <Link
              href="/"
              className="inline-flex items-center text-[#10243F] transition hover:text-[#355f95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#355f95]"
            >
              <BrandLogo
                markClassName="h-9 w-9"
                wordmarkClassName="text-[2rem] leading-none text-current md:text-[2.2rem]"
              />
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
                      "border border-slate-300/85 bg-white/85 text-[#10243F] hover:border-[#355f95] hover:bg-[#eef4ff]/90",
                      active && "border-[#7fa8de] bg-[#d9eaff]/95 font-semibold text-[#10243F]"
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
        </div>

        <div className="overflow-hidden rounded-full border border-[#10243F] bg-[#10243F] shadow-[0_10px_24px_rgba(16,36,63,0.2)]">
          <Link
            href={featuredInsightHref}
            className="block px-3 py-2 text-center text-sm font-semibold text-[#e7f0ff] transition hover:bg-[#163257] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9dbcec] md:px-5"
          >
            New Insight: New Zealand&apos;s Responsible AI Guidance for Businesses
          </Link>
        </div>
      </div>
    </header>
  );
}
