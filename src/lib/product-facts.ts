/** Shop facts that stay out of the cart total. Missing columns are treated as "no data". */

export type DeliveryZone = { region: string; fee_tzs: number | null };

export type AvailabilityFact = { kind: "ready" } | { kind: "made"; days: number };

export function availabilityFact(product: {
  availability_type?: string | null;
  lead_time_days?: number | null;
}): AvailabilityFact | null {
  if (product.availability_type === "ready") return { kind: "ready" };
  if (product.availability_type !== "made_to_order") return null;
  const days = Number(product.lead_time_days);
  if (!Number.isInteger(days) || days < 1) return null;
  return { kind: "made", days };
}

/** A real low stock count. Zero, blanks, and larger counts are not shown as "only N left". */
export function lowStockLeft(quantity: number | null | undefined): number | null {
  const count = Number(quantity);
  if (!Number.isInteger(count) || count < 1 || count > 5) return null;
  return count;
}

export function priceHintAmount(
  product: { price_hint_tzs_from?: number | null },
  unpriced: boolean,
): number | null {
  if (!unpriced) return null;
  const hint = Number(product.price_hint_tzs_from);
  if (!Number.isFinite(hint) || hint <= 0) return null;
  return Math.round(hint);
}

/** A hint is not a price. Unpriced products stay out of the cart. */
export function canAddPricedProduct(unpriced: boolean, purchasable: boolean) {
  return !unpriced && purchasable;
}

export function measureCm(value: number | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

export function parseDeliveryZones(raw: unknown): DeliveryZone[] {
  if (!Array.isArray(raw)) return [];
  const zones: DeliveryZone[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const region = typeof row["region"] === "string" ? row["region"].trim() : "";
    if (!region) continue;
    const fee = Number(row["fee_tzs"]);
    zones.push({ region, fee_tzs: Number.isFinite(fee) && fee > 0 ? Math.round(fee) : null });
  }
  return zones;
}

export type DeliveryFact =
  | { kind: "free"; region: string }
  | { kind: "estimate"; region: string; fee: number }
  | { kind: "confirm" };

/** Informational only. The fee here is never added to an order total. */
export function deliveryFact(input: {
  region: string;
  freeForRegion: boolean;
  zones: DeliveryZone[];
}): DeliveryFact {
  const region = input.region.trim();
  if (!region) return { kind: "confirm" };
  if (input.freeForRegion) return { kind: "free", region };
  const zone = input.zones.find((item) => item.region === region);
  if (zone?.fee_tzs != null && zone.fee_tzs > 0) return { kind: "estimate", region, fee: zone.fee_tzs };
  return { kind: "confirm" };
}
