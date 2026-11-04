/**
 * Delivery fee rule: GK Furnish confirms the fee after the order is placed.
 * Collection is free, and so is delivery when every item is marked free delivery.
 * Order total = subtotal + delivery fee (0 while the fee is still to be confirmed).
 */

export type FulfilmentMethod = "delivery" | "collection";
export type DeliveryFeeStatus = "pending" | "confirmed" | "free";

export function deliveryFeeStatusFor(
  method: FulfilmentMethod,
  items: { free_delivery?: boolean | null }[],
): Exclude<DeliveryFeeStatus, "confirmed"> {
  if (method === "collection") return "free";
  if (items.length && items.every((item) => item.free_delivery === true)) return "free";
  return "pending";
}

export function orderTotal(subtotal: number, deliveryFee: number | null | undefined) {
  return Math.max(0, Math.round(subtotal)) + Math.max(0, Math.round(deliveryFee ?? 0));
}

/** Tanzania regions for the checkout and address forms. */
export const TZ_REGIONS = [
  "Mbeya",
  "Arusha",
  "Dar es Salaam",
  "Dodoma",
  "Geita",
  "Iringa",
  "Kagera",
  "Katavi",
  "Kigoma",
  "Kilimanjaro",
  "Lindi",
  "Manyara",
  "Mara",
  "Morogoro",
  "Mtwara",
  "Mwanza",
  "Njombe",
  "Pemba North",
  "Pemba South",
  "Pwani",
  "Rukwa",
  "Ruvuma",
  "Shinyanga",
  "Simiyu",
  "Singida",
  "Songwe",
  "Tabora",
  "Tanga",
  "Unguja North",
  "Unguja South",
  "Zanzibar Urban West",
] as const;

export function composeDeliveryLocation(parts: {
  method: FulfilmentMethod;
  region?: string;
  district?: string;
  area?: string;
  collectionLabel?: string;
}) {
  if (parts.method === "collection") return parts.collectionLabel || "Collection from GK Furnish";
  return [parts.area, parts.district, parts.region]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}
