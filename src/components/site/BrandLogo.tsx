import { SITE } from "@/config/site";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  /** Invert / light wordmark for dark surfaces */
  light?: boolean;
};

/** GK furnish brand mark + optional wordmark. */
export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  wordmarkClassName,
  light = false,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src="/brand/gk-furnish-logo.svg"
        alt=""
        width={40}
        height={37}
        className={cn("h-9 w-auto shrink-0 object-contain", markClassName)}
        decoding="async"
      />
      {showWordmark && (
        <span
          className={cn(
            "font-display text-lg font-semibold tracking-tight md:text-xl",
            light ? "text-white" : "text-navy",
            wordmarkClassName,
          )}
        >
          {SITE.name}
        </span>
      )}
    </span>
  );
}
