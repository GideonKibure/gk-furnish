import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ value, className }: { value: number | null | undefined; className?: string }) {
  if (!value) return <span className={cn("text-xs text-[#9CA3AF]", className)}>Not rated</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("h-3.5 w-3.5", n <= value ? "fill-gold text-gold" : "text-[#D1D5DB]")} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(value === n ? null : n)}
          className="grid h-8 w-8 place-items-center rounded-md hover:bg-[#F5F6F8]"
        >
          <Star className={cn("h-5 w-5", value && n <= value ? "fill-gold text-gold" : "text-[#D1D5DB]")} />
        </button>
      ))}
      {value != null && (
        <button type="button" className="ml-1 text-xs font-semibold text-[#6B7280] hover:underline" onClick={() => onChange(null)}>
          Clear
        </button>
      )}
    </div>
  );
}
