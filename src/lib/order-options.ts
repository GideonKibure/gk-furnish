export const BED_SIZES = ["4ft x 6ft", "5ft x 6ft", "6ft x 6ft"] as const;

export const MATERIAL_OPTIONS = ["Wood", "Fabric", "MDF", "Metal"] as const;

const OPTION_SEP = " | ";

export type CatalogColor = {
  stored: string;
  label: string;
  hex: string | null;
};

export function normalizeHex(raw: string) {
  const match = raw.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!match?.[1]) return null;
  return `#${match[1].toUpperCase()}`;
}

/** Stored as `#RRGGBB` or `Name|#RRGGBB`. Plain names stay valid for older products. */
export function parseCatalogColor(stored: string): CatalogColor {
  const value = stored.trim();
  const parts = value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const hexPart = parts.find((part) => part.startsWith("#"));
  const namePart = parts.find((part) => !part.startsWith("#"));
  const hex = normalizeHex(hexPart ?? (parts.length === 1 ? value : ""));
  const label = namePart || hex || value;
  return { stored: value, label, hex };
}

export function serializeCatalogColor(hex: string, name: string) {
  const clean = normalizeHex(hex);
  if (!clean) return null;
  const label = name.trim();
  return label ? `${label}|${clean}` : clean;
}

export function parseOptionList(stored?: string | null) {
  if (!stored?.trim()) return [];
  return stored
    .split(/\s*\|\s*|\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinOptionList(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .join(OPTION_SEP);
}

export const OPTION_PRICE_PREFIX = "[[optprice]]";

export type OptionPrice = {
  material: string;
  dimension: string;
  price: number;
};

export type PricedProduct = {
  price: number;
  material?: string | null;
  dimensions?: string | null;
  features?: string[] | null;
};

export function optionPriceKey(material: string, dimension: string) {
  return `${material}\u001f${dimension}`;
}

export function isOptionPriceFeature(value: string) {
  return value.startsWith(OPTION_PRICE_PREFIX);
}

export function publicFeatures(features: string[] | null | undefined) {
  return (features ?? []).filter((item) => !isOptionPriceFeature(item));
}

export function parseOptionPrices(features: string[] | null | undefined): OptionPrice[] {
  const rows: OptionPrice[] = [];
  for (const item of features ?? []) {
    if (!isOptionPriceFeature(item)) continue;
    const [material = "", dimension = "", amount = ""] = item.slice(OPTION_PRICE_PREFIX.length).split("\t");
    const price = Number(amount);
    if (!material && !dimension) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    rows.push({ material, dimension, price });
  }
  return rows;
}

export function encodeOptionPrices(rows: OptionPrice[]) {
  return rows
    .filter((row) => (row.material || row.dimension) && Number.isFinite(row.price) && row.price >= 0)
    .map((row) => `${OPTION_PRICE_PREFIX}${row.material}\t${row.dimension}\t${Math.round(row.price)}`);
}

function storedOptionPrice(rows: OptionPrice[], material: string, dimension: string, fallback: number) {
  const hit = rows.find((row) => row.material === material && row.dimension === dimension);
  return hit ? hit.price : fallback;
}

/** Every material × dimension price the customer can choose. */
export function optionPriceRows(product: PricedProduct): OptionPrice[] {
  const materials = parseOptionList(product.material);
  const dimensions = parseOptionList(product.dimensions);
  const stored = parseOptionPrices(product.features);
  if (materials.length && dimensions.length) {
    return materials.flatMap((material) =>
      dimensions.map((dimension) => ({
        material,
        dimension,
        price: storedOptionPrice(stored, material, dimension, product.price),
      })),
    );
  }
  if (materials.length) {
    return materials.map((material) => ({
      material,
      dimension: "",
      price: storedOptionPrice(stored, material, "", product.price),
    }));
  }
  if (dimensions.length) {
    return dimensions.map((dimension) => ({
      material: "",
      dimension,
      price: storedOptionPrice(stored, "", dimension, product.price),
    }));
  }
  return [];
}

/** Price for the buttons the customer has selected. Null until the required choices are made. */
export function selectedOptionPrice(product: PricedProduct, material: string, dimension: string) {
  const materials = parseOptionList(product.material);
  const dimensions = parseOptionList(product.dimensions);
  if (!materials.length && !dimensions.length) return product.price;
  const materialOk = materials.includes(material);
  const dimensionOk = dimensions.includes(dimension);
  if (materials.length && dimensions.length) {
    if (!materialOk || !dimensionOk) return null;
  } else if (materials.length) {
    if (!materialOk) return null;
  } else if (!dimensionOk) {
    return null;
  }
  const row = optionPriceRows(product).find(
    (item) => item.material === (materials.length ? material : "") && item.dimension === (dimensions.length ? dimension : ""),
  );
  return row ? row.price : product.price;
}

export function lowestOptionPrice(product: PricedProduct) {
  const rows = optionPriceRows(product);
  if (!rows.length) return product.price;
  return Math.min(...rows.map((row) => row.price));
}

export function highestOptionPrice(product: PricedProduct) {
  const rows = optionPriceRows(product);
  if (!rows.length) return product.price;
  return Math.max(...rows.map((row) => row.price));
}

export function composeOrderNotes(parts: {
  material?: string | undefined;
  neededBy?: string | undefined;
  notes?: string | undefined;
}) {
  const lines: string[] = [];
  if (parts.material?.trim()) lines.push(`Material: ${parts.material.trim()}`);
  if (parts.neededBy?.trim()) lines.push(`Needed by: ${parts.neededBy.trim()}`);
  if (parts.notes?.trim()) lines.push(parts.notes.trim());
  return lines.length ? lines.join("\n") : null;
}
