import { colorSwatch } from "@/lib/color-swatches";
import { parseCatalogColor, type CatalogColor } from "@/lib/order-options";
import { cn } from "@/lib/utils";

const HEXAGON = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

export function HexSwatch({ hex, label, className }: { hex?: string | null; label?: string; className?: string }) {
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

type ColorChoicesProps = {
  name: string;
  options: Array<string | CatalogColor>;
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);

export function ColorImageChoices(props: ColorChoicesProps) {
  const { name, options } = props;
  const colors = options.map((option) => (typeof option === "string" ? parseCatalogColor(option) : option));
  const chosen = props.multiple ? props.value : [props.value];
  function pick(stored: string) {
    if (props.multiple) {
      props.onChange(props.value.includes(stored) ? props.value.filter((item) => item !== stored) : [...props.value, stored]);
      return;
    }
    props.onChange(stored);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={chosen.join(" | ")} />
      {colors.map((option) => {
        const selected = chosen.includes(option.stored);
        return (
          <button
            key={option.stored}
            type="button"
            onClick={() => pick(option.stored)}
            aria-pressed={selected}
            className={cn(
              "flex w-[4.75rem] flex-col items-center gap-1.5 rounded-xl border p-1.5 text-center transition-all",
              selected ? "border-gold bg-gold-soft shadow-sm" : "border-border bg-background hover:border-navy/25",
            )}
          >
            <HexSwatch hex={option.hex} label={option.label} />
            <span className="line-clamp-2 text-[0.65rem] font-medium leading-tight text-navy">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type TextChoicesProps = {
  name: string;
  options: { value: string; label: string }[];
  compact?: boolean;
  scroll?: boolean;
} & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);

export function TextChoices(props: TextChoicesProps) {
  const { name, options, compact = false, scroll = false } = props;
  const chosen = props.multiple ? props.value : [props.value];
  function pick(next: string) {
    if (props.multiple) {
      props.onChange(props.value.includes(next) ? props.value.filter((item) => item !== next) : [...props.value, next]);
      return;
    }
    props.onChange(next);
  }
  return (
    <div className={cn(scroll ? "flex h-8 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex flex-wrap gap-2")}>
      <input type="hidden" name={name} value={chosen.join(" | ")} />
      {options.map((option) => {
        const selected = chosen.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => pick(option.value)}
            aria-pressed={selected}
            className={cn(
              "border font-semibold transition-all",
              scroll && "shrink-0 whitespace-nowrap",
              compact ? "h-7 rounded-full px-2.5 text-xs leading-none" : "rounded-xl px-3.5 py-2.5 text-sm",
              selected ? "border-gold bg-gold-soft text-navy shadow-sm" : "border-border bg-background text-navy hover:border-navy/25",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
