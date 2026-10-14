export const BED_SIZES = ["4ft x 6ft", "5ft x 6ft", "6ft x 6ft"] as const;

export const MATERIAL_OPTIONS = ["Wood", "Fabric", "MDF", "Metal"] as const;

const OPTION_SEP = " | ";
const LOCALE_SEP = "\u001e";

export type LocalizedOption = {
  en: string;
  sw: string;
};

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

function splitOptionItems(stored?: string | null) {
  if (!stored?.trim()) return [];
  return stored
    .split(/\s*\|\s*|\r?\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** English is the stored choice. Swahili is an optional translation after a hidden separator. */
export function parseLocalizedOptions(stored?: string | null): LocalizedOption[] {
  return splitOptionItems(stored)
    .map((item) => {
      const cut = item.indexOf(LOCALE_SEP);
      if (cut < 0) return { en: item, sw: "" };
      return { en: item.slice(0, cut).trim(), sw: item.slice(cut + 1).trim() };
    })
    .filter((item) => item.en);
}

export function parseOptionList(stored?: string | null) {
  return parseLocalizedOptions(stored).map((item) => item.en);
}

export function joinLocalizedOptions(items: LocalizedOption[]) {
  return items
    .map((item) => {
      const en = item.en.trim().replaceAll(LOCALE_SEP, "").replaceAll("|", "");
      const sw = item.sw.trim().replaceAll(LOCALE_SEP, "").replaceAll("|", "");
      if (!en) return "";
      return sw ? `${en}${LOCALE_SEP}${sw}` : en;
    })
    .filter(Boolean)
    .join(OPTION_SEP);
}

export function joinOptionList(items: string[]) {
  return joinLocalizedOptions(items.map((item) => ({ en: item, sw: "" })));
}

export function optionLabel(en: string, stored: string | null | undefined, lang: "en" | "sw") {
  if (lang !== "sw") return en;
  return parseLocalizedOptions(stored).find((item) => item.en === en)?.sw || en;
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

const PREFERENCE_NOTE = "\n— ";
const FINISH_IMAGE_PREFIX = "finish:";

/** Selected names stay pipe-separated. A written preference follows on its own line. */
export function packPreference(selected: string[], note: string) {
  const picks = [...new Set(selected.map((item) => item.trim()).filter(Boolean))].join(OPTION_SEP);
  const written = note.trim().replace(/\s+/g, " ");
  if (picks && written) return `${picks}${PREFERENCE_NOTE}${written}`;
  if (written) return `— ${written}`;
  return picks;
}

export function unpackPreference(stored?: string | null) {
  const text = (stored ?? "").replace(/\s+$/, "");
  if (!text.trim()) return { selected: [] as string[], note: "" };
  const cut = text.indexOf(PREFERENCE_NOTE);
  if (cut >= 0) {
    const head = text.slice(0, cut).trim();
    return {
      selected: head ? head.split("|").map((item) => item.trim()).filter(Boolean) : [],
      note: text.slice(cut + PREFERENCE_NOTE.length).trim(),
    };
  }
  if (text.startsWith("— ")) return { selected: [] as string[], note: text.slice(2).trim() };
  return { selected: text.split("|").map((item) => item.trim()).filter(Boolean), note: "" };
}

export function formatPreference(stored?: string | null) {
  const { selected, note } = unpackPreference(stored);
  return [selected.join(", "), note].filter(Boolean).join(" — ");
}

/** The first path is the design photo. A finish sample is marked so older single photos still open. */
export function packReferenceImages(design?: string | null, finish?: string | null) {
  const lines: string[] = [];
  if (design) lines.push(design);
  if (finish) lines.push(`${FINISH_IMAGE_PREFIX}${finish}`);
  return lines.length ? lines.join("\n") : null;
}

export function unpackReferenceImages(stored?: string | null) {
  let design: string | null = null;
  let finish: string | null = null;
  for (const line of (stored ?? "").split("\n")) {
    const value = line.trim();
    if (!value) continue;
    if (value.startsWith(FINISH_IMAGE_PREFIX)) finish = value.slice(FINISH_IMAGE_PREFIX.length);
    else design = value;
  }
  return { design, finish };
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
