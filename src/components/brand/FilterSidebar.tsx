import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterCategory = { key: string; label: string; count: number };

/** Left-hand shop filters: categories, price range slot and availability. */
export function FilterSidebar({
  title,
  categoriesLabel,
  allLabel,
  allCount,
  categories,
  selected,
  onSelect,
  priceLabel,
  price,
  availabilityLabel,
  inStockLabel,
  inStockCount,
  inStockOnly,
  onInStockOnly,
  clearLabel,
  onClear,
  className,
}: {
  title?: string;
  categoriesLabel: string;
  allLabel: string;
  allCount: number;
  categories: FilterCategory[];
  selected: string;
  onSelect: (key: string) => void;
  priceLabel: string;
  price: ReactNode;
  availabilityLabel: string;
  inStockLabel: string;
  inStockCount: number;
  inStockOnly: boolean;
  onInStockOnly: (value: boolean) => void;
  clearLabel?: string;
  onClear?: () => void;
  className?: string;
}) {
  const row = (key: string, label: string, count: number) => {
    const active = selected === key;
    return (
      <li key={key || "all"}>
        <button
          type="button"
          onClick={() => onSelect(key)}
          aria-pressed={active}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
            active
              ? "bg-gold-tint font-semibold text-navy"
              : "text-navy/80 hover:bg-muted hover:text-navy",
          )}
        >
          <span className="min-w-0 truncate">{label}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            {count}
            <ChevronRight className={cn("h-3.5 w-3.5", active && "text-gold-ink")} />
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {(title || onClear) && (
        <div className="flex items-center justify-between">
          {title && <p className="font-display text-base font-bold text-navy">{title}</p>}
          {onClear && clearLabel && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-semibold text-gold-ink hover:underline"
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
      <section className="filter-card">
        <h3 className="mb-2 text-sm font-bold text-navy">{categoriesLabel}</h3>
        <ul className="space-y-0.5">
          {row("", allLabel, allCount)}
          {categories.map((c) => row(c.key, c.label, c.count))}
        </ul>
      </section>
      <section className="filter-card">
        <h3 className="mb-2 text-sm font-bold text-navy">{priceLabel}</h3>
        {price}
      </section>
      <section className="filter-card">
        <h3 className="mb-2 text-sm font-bold text-navy">{availabilityLabel}</h3>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-navy">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => onInStockOnly(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--gold-ink)]"
          />
          {inStockLabel} <span className="text-muted-foreground">({inStockCount})</span>
        </label>
      </section>
    </div>
  );
}
