/**
 * Storefront rules for showing a product. Columns added in migration 0007 may be
 * missing on older databases, so every field is read defensively.
 */

type DisplayProduct = {
  price: number;
  is_available: boolean;
  stock_quantity: number;
  view_count?: number | null;
  like_count?: number | null;
  status?: string | null;
  compare_at_price?: number | null;
  discount_percent?: number | null;
  stock_display?: string | null;
  free_delivery?: boolean | null;
};

/** Listed in the public catalogue (active, not draft or archived). */
export function isListed(product: Pick<DisplayProduct, "status">) {
  return (product.status ?? "active") === "active";
}

/** Can be added to the cart and ordered. */
export function isPurchasable(product: Pick<DisplayProduct, "status" | "is_available">) {
  return isListed(product) && product.is_available;
}

/** The shop hides the price and offers a quote instead. Missing until migration 0022. */
export function quoteOnRequest(product: { quote_on_request?: boolean | null }) {
  return product.quote_on_request === true;
}

/** Old price to strike through, only when it is above the current price. */
export function compareAtPrice(product: Pick<DisplayProduct, "compare_at_price">, price: number) {
  const old = Number(product.compare_at_price ?? 0);
  return old > 0 && old > price ? old : null;
}

/** Discount badge percentage: the admin's value, or worked out from the old price. */
export function discountPercent(
  product: Pick<DisplayProduct, "compare_at_price" | "discount_percent">,
  price: number,
) {
  const set = Number(product.discount_percent ?? 0);
  if (set >= 1 && set <= 90) return Math.round(set);
  const old = compareAtPrice(product, price);
  if (!old || price <= 0) return null;
  const pct = Math.round(((old - price) / old) * 100);
  return pct >= 1 ? Math.min(90, pct) : null;
}

export type StockState =
  { kind: "unavailable" } | { kind: "in_stock"; count: number | null } | { kind: "made_to_order" };

/** Stock label honouring the product's `stock_display` choice ('label' or 'count'). */
export function stockState(
  product: Pick<DisplayProduct, "is_available" | "stock_quantity" | "stock_display" | "status">,
): StockState {
  if (!isPurchasable(product)) return { kind: "unavailable" };
  if (product.stock_quantity > 0) {
    return {
      kind: "in_stock",
      count: product.stock_display === "count" ? product.stock_quantity : null,
    };
  }
  return { kind: "made_to_order" };
}

export function popularity(product: Pick<DisplayProduct, "view_count" | "like_count">) {
  return Number(product.view_count ?? 0) + 3 * Number(product.like_count ?? 0);
}
