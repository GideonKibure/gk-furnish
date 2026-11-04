import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { stockState } from "@/lib/product-display";
import { cn } from "@/lib/utils";

type StockProduct = Parameters<typeof stockState>[0];

/** "In stock", "In stock (24)" or "Made to order", per the product's stock display choice. */
export function StockLabel({ product, className }: { product: StockProduct; className?: string }) {
  const { t } = useLang();
  const state = stockState(product);
  if (state.kind === "unavailable") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium text-danger",
          className,
        )}
      >
        <XCircle className="h-4 w-4" />
        {t.pdp.unavailable}
      </span>
    );
  }
  if (state.kind === "in_stock") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium text-success",
          className,
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
        {state.count != null ? fill(t.pdp.inStockCount, { count: state.count }) : t.pdp.inStock}
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-warn", className)}
    >
      <Clock3 className="h-4 w-4" />
      {t.pdp.madeToOrder}
    </span>
  );
}
