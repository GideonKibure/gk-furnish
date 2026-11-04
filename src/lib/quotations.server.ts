import type { Database, Json } from "@/integrations/supabase/types";
import { isMissingSchema } from "@/lib/db-compat";
import {
  parseSavedQuotes,
  serializeSavedQuotes,
  type QuoteLine,
  type QuoteResponse,
  type QuoteStatus,
  type SavedQuote,
} from "@/lib/custom-quotes";

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];
type CustomOrderRow = Database["public"]["Tables"]["custom_orders"]["Row"];
type QuotationRow = Database["public"]["Tables"]["quotations"]["Row"];

/** The customer / request details copied onto every quote so it reads the same later. */
type QuoteDetails = Pick<
  SavedQuote,
  | "customerName"
  | "phone"
  | "email"
  | "location"
  | "furnitureType"
  | "quantity"
  | "description"
  | "dimensions"
  | "material"
  | "color"
  | "requirements"
>;

export type NewQuoteInput = QuoteDetails & {
  lines: QuoteLine[];
  advancePercent: number;
  validUntil: string | null;
  notes: string;
  inclusions?: string | undefined;
  exclusions?: string | undefined;
  estimatedCompletion?: string | null | undefined;
  createdBy?: string | null | undefined;
};

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function linesOf(value: Json): QuoteLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const description = str(row["description"]).trim();
    const quantity = Number(row["quantity"]);
    const unitPrice = Number(row["unitPrice"]);
    if (
      !description ||
      !Number.isFinite(quantity) ||
      quantity < 1 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    )
      return [];
    return [{ description, quantity: Math.round(quantity), unitPrice }];
  });
}

export function quoteFromRow(row: QuotationRow): SavedQuote {
  const details = (
    row.details && typeof row.details === "object" && !Array.isArray(row.details) ? row.details : {}
  ) as Record<string, unknown>;
  const lines = linesOf(row.lines);
  return {
    id: row.id,
    number: row.quote_number,
    createdAt: row.created_at,
    validUntil: row.valid_until,
    notes: row.notes ?? "",
    lines,
    total:
      Number(row.total) || lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    advancePercent: row.advance_percent,
    customerName: str(details["customerName"]),
    phone: str(details["phone"]),
    email: str(details["email"]),
    location: str(details["location"]),
    furnitureType: str(details["furnitureType"]),
    quantity: Number(details["quantity"]) || lines[0]?.quantity || 1,
    description: str(details["description"]),
    dimensions: str(details["dimensions"]),
    material: str(details["material"]),
    color: str(details["color"]),
    requirements: str(details["requirements"]),
    version: row.version,
    status: row.status as QuoteStatus,
    inclusions: row.inclusions ?? undefined,
    exclusions: row.exclusions ?? undefined,
    estimatedCompletion: row.estimated_completion,
    customerResponse: row.customer_response ?? undefined,
    respondedAt: row.responded_at,
  };
}

/** True once migration 0007 has created the quotations table. */
export async function quotationsTableReady(supabaseAdmin: SupabaseAdmin) {
  const { error } = await supabaseAdmin
    .from("quotations")
    .select("id", { head: true, count: "exact" })
    .limit(1);
  return !error || !isMissingSchema(error);
}

/**
 * Quotes for many custom requests at once, oldest version first.
 * Uses the quotations table, falling back to the JSON kept in `budget_range` before 0007.
 */
export async function listQuotesFor(
  supabaseAdmin: SupabaseAdmin,
  rows: Pick<CustomOrderRow, "id" | "budget_range">[],
): Promise<Map<string, SavedQuote[]>> {
  const result = new Map<string, SavedQuote[]>();
  for (const row of rows) result.set(row.id, []);
  if (!rows.length) return result;

  const { data, error } = await supabaseAdmin
    .from("quotations")
    .select("*")
    .in(
      "custom_order_id",
      rows.map((row) => row.id),
    )
    .order("version", { ascending: true });

  if (error && !isMissingSchema(error)) throw new Error(error.message);
  const tableRows = error ? [] : (data ?? []);
  for (const quote of tableRows) result.get(quote.custom_order_id)?.push(quoteFromRow(quote));

  for (const row of rows) {
    if (result.get(row.id)?.length) continue;
    result.set(row.id, parseSavedQuotes(row.budget_range));
  }
  return result;
}

export async function listQuotes(
  supabaseAdmin: SupabaseAdmin,
  row: Pick<CustomOrderRow, "id" | "budget_range">,
) {
  return (await listQuotesFor(supabaseAdmin, [row])).get(row.id) ?? [];
}

/**
 * Save a new quote version for a custom request. Earlier open versions become `superseded`.
 * Before migration 0007 the quote is appended to the legacy JSON in `budget_range`.
 */
export async function saveQuoteVersion(
  supabaseAdmin: SupabaseAdmin,
  row: Pick<CustomOrderRow, "id" | "request_number" | "budget_range">,
  input: NewQuoteInput,
): Promise<{ quote: SavedQuote; storage: "table" | "legacy" }> {
  const existing = await listQuotes(supabaseAdmin, row);
  const version = Math.max(0, ...existing.map((quote) => quote.version ?? 0)) + 1;
  const number = `${row.request_number}-Q${version}`;
  const total = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const details: QuoteDetails = {
    customerName: input.customerName,
    phone: input.phone,
    email: input.email,
    location: input.location,
    furnitureType: input.furnitureType,
    quantity: input.quantity,
    description: input.description,
    dimensions: input.dimensions,
    material: input.material,
    color: input.color,
    requirements: input.requirements,
  };

  if (await quotationsTableReady(supabaseAdmin)) {
    await supabaseAdmin
      .from("quotations")
      .update({ status: "superseded" })
      .eq("custom_order_id", row.id)
      .in("status", ["sent", "draft", "changes_requested"]);
    const { data, error } = await supabaseAdmin
      .from("quotations")
      .insert({
        custom_order_id: row.id,
        version,
        quote_number: number,
        lines: input.lines as unknown as Json,
        total,
        advance_percent: input.advancePercent,
        valid_until: input.validUntil,
        notes: input.notes,
        inclusions: input.inclusions || null,
        exclusions: input.exclusions || null,
        estimated_completion: input.estimatedCompletion || null,
        details: details as unknown as Json,
        status: "sent",
        created_by: input.createdBy ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not save quote");
    return { quote: quoteFromRow(data), storage: "table" };
  }

  const quote: SavedQuote = {
    id: crypto.randomUUID(),
    number,
    createdAt: new Date().toISOString(),
    validUntil: input.validUntil,
    notes: input.notes,
    lines: input.lines,
    total,
    advancePercent: input.advancePercent,
    ...details,
    version,
    status: "sent",
    inclusions: input.inclusions,
    exclusions: input.exclusions,
    estimatedCompletion: input.estimatedCompletion ?? null,
  };
  const legacy = parseSavedQuotes(row.budget_range).map((item) =>
    item.status === "sent" ? { ...item, status: "superseded" as const } : item,
  );
  const { error } = await supabaseAdmin
    .from("custom_orders")
    .update({ budget_range: serializeSavedQuotes([...legacy, quote]) })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  return { quote, storage: "legacy" };
}

/** Record the customer's answer on an open quote. Returns the updated quote. */
export async function recordQuoteResponse(
  supabaseAdmin: SupabaseAdmin,
  row: Pick<CustomOrderRow, "id" | "budget_range">,
  quoteId: string,
  response: QuoteResponse,
  message: string,
): Promise<SavedQuote> {
  const respondedAt = new Date().toISOString();
  if (await quotationsTableReady(supabaseAdmin)) {
    const { data, error } = await supabaseAdmin
      .from("quotations")
      .update({ status: response, customer_response: message || null, responded_at: respondedAt })
      .eq("id", quoteId)
      .eq("custom_order_id", row.id)
      .eq("status", "sent")
      .select("*")
      .maybeSingle();
    if (error && !isMissingSchema(error)) throw new Error(error.message);
    if (data) return quoteFromRow(data);
    if (!error) throw new Error("This quote can no longer be answered");
  }

  const quotes = parseSavedQuotes(row.budget_range);
  const target = quotes.find((quote) => quote.id === quoteId);
  if (!target || target.status !== "sent") throw new Error("This quote can no longer be answered");
  const updated: SavedQuote = {
    ...target,
    status: response,
    customerResponse: message,
    respondedAt,
  };
  const { error } = await supabaseAdmin
    .from("custom_orders")
    .update({
      budget_range: serializeSavedQuotes(
        quotes.map((quote) => (quote.id === quoteId ? updated : quote)),
      ),
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  return updated;
}
