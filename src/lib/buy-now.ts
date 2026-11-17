const KEY = "gk-buy-now";

export type BuyNowLine = {
  product_id: string;
  quantity: number;
  material: string;
  size: string;
  color: string;
};

export function saveBuyNow(line: BuyNowLine) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(line));
  } catch {
    // Private mode can block storage. Checkout then shows an empty state.
  }
}

export function readBuyNow(): BuyNowLine | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuyNowLine>;
    if (!parsed.product_id || !parsed.quantity || parsed.quantity < 1) return null;
    return {
      product_id: parsed.product_id,
      quantity: parsed.quantity,
      material: parsed.material ?? "",
      size: parsed.size ?? "",
      color: parsed.color ?? "",
    };
  } catch {
    return null;
  }
}

export function clearBuyNow() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Ignore storage failures.
  }
}
