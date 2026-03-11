import Image from "next/image";
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
      <Image
        src="/Accretive_logo_A.png"
        alt="Accretive logo"
        width={40}
        height={40}
        className={cn("h-8 w-8 object-contain", markClassName)}
      />
      {showWordmark ? (
        <span className={cn("font-[var(--font-wordmark)] text-3xl font-semibold tracking-tight", wordmarkClassName)}>
          accretive
        </span>
      ) : null}
    </span>
  );
}
