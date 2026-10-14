export const QUOTE_VALID_DAYS = 3;

export const QUOTE_ADVANCE_NOTE =
  "An advance payment of 50% of this quote must be paid within 3 days for the work to begin.";

export function quoteDateAfter(days: number, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function withQuoteAdvanceNote(notes: string) {
  const trimmed = notes.trim();
  if (/50\s*%/.test(trimmed)) return trimmed;
  return trimmed ? `${QUOTE_ADVANCE_NOTE}\n${trimmed}` : QUOTE_ADVANCE_NOTE;
}

export type QuoteLine = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type SavedQuote = {
  id: string;
  number: string;
  createdAt: string;
  validUntil: string | null;
  notes: string;
  lines: QuoteLine[];
  total: number;
  customerName: string;
  phone: string;
  email: string;
  location: string;
  furnitureType: string;
  quantity: number;
  description: string;
  dimensions: string;
  material: string;
  color: string;
  requirements: string;
};

function text(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

function lineOf(value: unknown): QuoteLine | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const description = text(row, "description").trim();
  const quantity = Number(row["quantity"]);
  const unitPrice = Number(row["unitPrice"]);
  if (!description || !Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  return { description, quantity: Math.round(quantity), unitPrice };
}

function quoteOf(value: unknown): SavedQuote | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = text(row, "id");
  const number = text(row, "number");
  if (!id || !number) return null;
  const rawLines = row["lines"];
  const lines = Array.isArray(rawLines) ? rawLines.map(lineOf).filter((line): line is QuoteLine => line != null) : [];
  if (!lines.length) return null;
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const validUntil = text(row, "validUntil");
  return {
    id,
    number,
    createdAt: text(row, "createdAt") || new Date(0).toISOString(),
    validUntil: validUntil || null,
    notes: text(row, "notes"),
    lines,
    total,
    customerName: text(row, "customerName"),
    phone: text(row, "phone"),
    email: text(row, "email"),
    location: text(row, "location"),
    furnitureType: text(row, "furnitureType"),
    quantity: Number(row["quantity"]) || lines[0]?.quantity || 1,
    description: text(row, "description"),
    dimensions: text(row, "dimensions"),
    material: text(row, "material"),
    color: text(row, "color"),
    requirements: text(row, "requirements"),
  };
}

/** Quotes are kept on the custom order so the portal can open them again. */
export function parseSavedQuotes(stored?: string | null): SavedQuote[] {
  const raw = stored?.trim() ?? "";
  if (!raw.startsWith("[")) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      const quote = quoteOf(item);
      return quote ? [quote] : [];
    });
  } catch {
    return [];
  }
}

export function serializeSavedQuotes(quotes: SavedQuote[]) {
  return JSON.stringify(quotes);
}
