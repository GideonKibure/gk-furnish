/**
 * Delivery fee rule: GK Furnish confirms the fee after the order is placed.
 * Collection is free, and so is delivery when every item is marked free delivery.
 * Order total = subtotal + delivery fee (0 while the fee is still to be confirmed).
 */

export type FulfilmentMethod = "delivery" | "collection";
export type DeliveryFeeStatus = "pending" | "confirmed" | "free";

export function deliveryFeeStatusFor(
  method: FulfilmentMethod,
  items: FreeDeliveryItem[],
  destinationRegion?: string | null,
): Exclude<DeliveryFeeStatus, "confirmed"> {
  if (method === "collection") return "free";
  const allFree = items.length > 0 && items.every((item) => deliveredFreeIn(item, destinationRegion));
  return allFree ? "free" : "pending";
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

export type FreeDeliveryItem = {
  free_delivery?: boolean | null;
  free_delivery_region?: string | null;
  free_delivery_regions?: string[] | null;
  free_delivery_country?: boolean | null;
};

/** Regions where this product is delivered free. A country covers every Tanzania region. */
export function freeDeliveryPlaces(item: FreeDeliveryItem): { country: boolean; regions: string[] } {
  if (item.free_delivery_country) return { country: true, regions: [] };
  const allowed = new Set<string>(TZ_REGIONS);
  const listed = [...new Set((item.free_delivery_regions ?? []).map((region) => region.trim()).filter((region) => allowed.has(region)))];
  if (listed.length) return { country: false, regions: listed };
  const single = item.free_delivery_region?.trim() ?? "";
  if (single && allowed.has(single)) return { country: false, regions: [single] };
  return { country: false, regions: [] };
}

/** True when this item ships free to the customer's region. A chosen region is required for region-specific free delivery. */
export function deliveredFreeIn(item: FreeDeliveryItem, destinationRegion?: string | null) {
  const places = freeDeliveryPlaces(item);
  const destination = destinationRegion?.trim().toLowerCase() ?? "";
  if (places.country) return TZ_REGIONS.some((region) => region.toLowerCase() === destination);
  if (places.regions.length) return places.regions.some((region) => region.toLowerCase() === destination);
  return item.free_delivery === true;
}

export function joinPlaces(regions: string[], andWord: string) {
  if (regions.length <= 1) return regions[0] ?? "";
  if (regions.length === 2) return `${regions[0]} ${andWord} ${regions[1]}`;
  return `${regions.slice(0, -1).join(", ")} ${andWord} ${regions[regions.length - 1]}`;
}

/** Split a profile location such as "Mbeya, Iyunga" into the checkout address fields. */
export function placeFromProfileLocation(text: string): { region: string; district: string; address_line: string } {
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  const region = TZ_REGIONS.find((item) => parts.some((part) => part.toLowerCase() === item.toLowerCase())) ?? "";
  const rest = parts.filter((part) => part.toLowerCase() !== region.toLowerCase());
  return { region, district: "", address_line: rest.join(", ") || (region ? "" : text.trim()) };
}

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
