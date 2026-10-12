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
