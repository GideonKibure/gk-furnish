export const QUOTE_VALID_DAYS = 3;

export function quoteAdvanceNote(percent: number) {
  return `An advance payment of ${percent}% of this quote must be paid within ${QUOTE_VALID_DAYS} days for the work to begin.`;
}

export const QUOTE_POLICY_NOTES = [
  "Production starts only after the advance payment is received.",
  "Any change to the design or specifications must be agreed before production.",
  "The remaining balance must be cleared before delivery.",
  "A receipt is issued for every payment.",
];

export function quoteDateAfter(days: number, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function withQuoteAdvanceNote(notes: string, percent: number) {
  const trimmed = notes.trim();
  if (/advance payment of \d+\s*%/i.test(trimmed)) return trimmed;
  const note = quoteAdvanceNote(percent);
  return trimmed ? `${note}\n${trimmed}` : note;
}

export type QuoteLine = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "changes_requested" | "expired" | "superseded";

export const QUOTE_RESPONSES = ["accepted", "rejected", "changes_requested"] as const;
export type QuoteResponse = (typeof QUOTE_RESPONSES)[number];

export type SavedQuote = {
  id: string;
  number: string;
  createdAt: string;
  validUntil: string | null;
  notes: string;
  lines: QuoteLine[];
  total: number;
  advancePercent: number;
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
  /** 1-based version. Older saved quotes get their position in the list. */
  version?: number | undefined;
  status?: QuoteStatus | undefined;
  inclusions?: string | undefined;
  exclusions?: string | undefined;
  estimatedCompletion?: string | null | undefined;
  customerResponse?: string | undefined;
  respondedAt?: string | null | undefined;
};

/** A quote the customer can still accept, reject or ask to change. */
export function quoteIsOpen(quote: SavedQuote, today = new Date()) {
  const status = quote.status ?? "sent";
  if (status !== "sent") return false;
  if (!quote.validUntil) return true;
  return new Date(`${quote.validUntil}T23:59:59`).getTime() >= today.getTime();
}

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
    advancePercent: Number(row["advancePercent"]) || 50,
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
    status: (text(row, "status") as QuoteStatus) || undefined,
    inclusions: text(row, "inclusions") || undefined,
    exclusions: text(row, "exclusions") || undefined,
    estimatedCompletion: text(row, "estimatedCompletion") || null,
    customerResponse: text(row, "customerResponse") || undefined,
    respondedAt: text(row, "respondedAt") || null,
  };
}

/** Quotes are kept on the custom order so the portal can open them again. */
export function parseSavedQuotes(stored?: string | null): SavedQuote[] {
  const raw = stored?.trim() ?? "";
  if (!raw.startsWith("[")) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    const quotes = value.flatMap((item) => {
      const quote = quoteOf(item);
      return quote ? [quote] : [];
    });
    return quotes.map((quote, index) => ({
      ...quote,
      version: index + 1,
      status: quote.status ?? (index < quotes.length - 1 ? "superseded" : "sent"),
    }));
  } catch {
    return [];
  }
}

export function serializeSavedQuotes(quotes: SavedQuote[]) {
  return JSON.stringify(quotes);
}
