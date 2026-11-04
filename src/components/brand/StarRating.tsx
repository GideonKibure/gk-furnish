import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Read-only stars. Partial stars are drawn by clipping a filled star. */
export function StarRating({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const px = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  const rounded = Math.round(value * 10) / 10;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="inline-flex" role="img" aria-label={`${rounded} / 5`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, value - i));
          return (
            <span key={i} className={cn("relative", px)}>
              <Star className={cn("absolute inset-0 text-gold/35", px)} strokeWidth={1.5} />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={cn("fill-gold text-gold", px)} strokeWidth={1.5} />
              </span>
            </span>
          );
        })}
      </span>
      {count != null && (
        <span className="text-xs text-muted-foreground tabular-nums">({count})</span>
      )}
    </span>
  );
}

/** Star picker for review forms. */
export function StarInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} / 5`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          className="rounded p-0.5"
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              n <= shown ? "fill-gold text-gold" : "text-gold/40",
            )}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}
