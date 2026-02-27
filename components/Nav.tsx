"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/our-product", label: "Our Product" },
  { href: "/request-demo", label: "Request Demo" },
  { href: "/contact", label: "Contact" }
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070d18]/85 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-3 md:px-5">
        <Link
          href="/"
          className="inline-flex items-center text-3xl font-semibold tracking-tight text-white transition hover:text-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist md:text-4xl font-[var(--font-wordmark)]"
        >
          Accretive
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist",
                  "border border-white/35 bg-white/10 text-white hover:border-white hover:bg-white hover:text-[#0B1F4D]",
                  active && "bg-white font-semibold text-[#0B1F4D]"
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
