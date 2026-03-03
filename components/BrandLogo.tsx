import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
};

export default function BrandLogo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-white/10",
          markClassName
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" className="h-[78%] w-[78%]" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M15.8 8.6a7.3 7.3 0 1 0 0 14.6H22"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M22 12.4V24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      {showWordmark ? (
        <span className={cn("font-[var(--font-wordmark)] text-3xl font-semibold tracking-tight", wordmarkClassName)}>
          accretive
        </span>
      ) : null}
    </span>
  );
}
