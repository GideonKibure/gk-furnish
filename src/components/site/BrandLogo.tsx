import { SITE } from "@/config/site";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  /** Small line under the wordmark, e.g. "Live · Study · Work in comfort". */
  tagline?: string | undefined;
  /** White wordmark for dark surfaces */
  light?: boolean;
};

/** GK Furnish brand mark + optional uppercase wordmark. */
export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  wordmarkClassName,
  tagline,
  light = false,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <span className="logo-slot">
        <img
          src="/brand/gk-furnish-logo.png"
          alt=""
          width={812}
          height={908}
          className={cn("logo-mark h-10 w-auto shrink-0 object-contain", markClassName)}
          decoding="async"
        />
      </span>
      {(showWordmark || tagline) && (
        <span className="flex min-w-0 flex-col leading-none">
          {showWordmark && (
            <span
              className={cn(
                "truncate font-display text-lg font-extrabold uppercase tracking-tight md:text-xl",
                light ? "text-white" : "text-navy",
                wordmarkClassName,
              )}
            >
              {SITE.name}
            </span>
          )}
          {tagline && (
            <span className={cn("mt-1 truncate text-[0.68rem] font-medium", light ? "text-white/70" : "text-muted-foreground")}>
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
