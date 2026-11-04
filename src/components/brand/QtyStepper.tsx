import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 100,
  size = "md",
  label = "Quantity",
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const box = size === "sm" ? "h-8 w-8" : "h-11 w-11";
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n) || min));
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex items-center rounded-lg border border-input bg-white", className)}
    >
      <button
        type="button"
        aria-label="−"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={cn(
          box,
          "grid place-items-center rounded-l-lg text-navy transition-colors hover:bg-muted disabled:opacity-40",
        )}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className={cn(
          "w-10 border-x border-input bg-transparent text-center font-semibold tabular-nums text-navy outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          size === "sm" ? "h-8 text-sm" : "h-11",
        )}
      />
      <button
        type="button"
        aria-label="+"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={cn(
          box,
          "grid place-items-center rounded-r-lg text-navy transition-colors hover:bg-muted disabled:opacity-40",
        )}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
