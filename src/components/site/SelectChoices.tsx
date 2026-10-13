import { colorSwatch } from "@/lib/color-swatches";
import { parseCatalogColor, type CatalogColor } from "@/lib/order-options";
import { cn } from "@/lib/utils";

const HEXAGON = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

export function HexSwatch({
  hex,
  label,
  className,
}: {
  hex?: string | null;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("block h-11 w-11 ring-1 ring-black/10", className)}
      style={{
        clipPath: HEXAGON,
        background: hex ?? undefined,
        backgroundImage: hex ? undefined : `url("${colorSwatch(label ?? "colour")}")`,
        backgroundSize: "cover",
      }}
    />
  );
}

export function ColorImageChoices({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | CatalogColor>;
}) {
  const colors = options.map((option) =>
    typeof option === "string" ? parseCatalogColor(option) : option,
  );
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={value} />
      {colors.map((option) => {
        const selected = value === option.stored;
        return (
          <button
            key={option.stored}
            type="button"
            onClick={() => onChange(option.stored)}
            aria-pressed={selected}
            className={cn(
              "flex w-[4.75rem] flex-col items-center gap-1.5 rounded-xl border p-1.5 text-center transition-all",
              selected
                ? "border-gold bg-gold-soft shadow-sm"
                : "border-border bg-background hover:border-navy/25",
            )}
          >
            <HexSwatch hex={option.hex} label={option.label} />
            <span className="line-clamp-2 text-[0.65rem] font-medium leading-tight text-navy">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TextChoices({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={value} />
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              "rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all",
              selected
                ? "border-gold bg-gold-soft text-navy shadow-sm"
                : "border-border text-navy hover:border-navy/25",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
