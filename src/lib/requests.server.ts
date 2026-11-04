import type { Database } from "@/integrations/supabase/types";
import type { SavedQuote } from "@/lib/custom-quotes";
import { isMissingSchema } from "@/lib/db-compat";
import { formatPreference, unpackReferenceImages } from "@/lib/order-options";
import { listQuotesFor } from "@/lib/quotations.server";

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];
export type CustomRow = Database["public"]["Tables"]["custom_orders"]["Row"];

export type CustomRequestView = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  furnitureType: string;
  description: string;
  quantity: number;
  dimensions: string;
  material: string;
  color: string;
  finish: string;
  budget: string;
  neededBy: string | null;
  location: string;
  hasPhoto: boolean;
  trackingToken: string | null;
  quotes: SavedQuote[];
};

/** Budget text: the new column, or the legacy field when it does not hold quote JSON. */
function budgetOf(row: CustomRow) {
  if (row.budget) return row.budget;
  const legacy = row.budget_range ?? "";
  return legacy.trim().startsWith("[") ? "" : legacy;
}

export async function toRequestViews(
  supabaseAdmin: SupabaseAdmin,
  rows: CustomRow[],
): Promise<CustomRequestView[]> {
  const quotes = await listQuotesFor(supabaseAdmin, rows);
  return rows.map((row) => ({
    id: row.id,
    number: row.request_number,
    status: row.status,
    createdAt: row.created_at,
    furnitureType: row.furniture_type,
    description: row.design_description,
    quantity: row.quantity,
    dimensions: row.preferred_dimensions ?? "",
    material: formatPreference(row.preferred_material),
    color: formatPreference(row.preferred_color),
    finish: row.finish ?? "",
    budget: budgetOf(row),
    neededBy: row.needed_by ?? null,
    location: row.delivery_location,
    hasPhoto: Boolean(unpackReferenceImages(row.reference_image_url).design),
    trackingToken: row.tracking_token ?? null,
    quotes: (quotes.get(row.id) ?? []).filter((quote) => quote.status !== "draft"),
  }));
}

/**
 * Requests owned by the account, or sent from the account's (verified) email before signing up.
 * The email is matched exactly; never with LIKE, so `_` or `%` cannot widen the match.
 */
export async function myRequestRows(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  rawEmail: string,
) {
  const email = /^[^\s"(),]+@[^\s"(),]+$/.test(rawEmail) ? rawEmail : "";
  const byUser = await supabaseAdmin
    .from("custom_orders")
    .select("*")
    .or(email ? `user_id.eq.${userId},email.eq."${email}"` : `user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!byUser.error) return byUser.data ?? [];
  if (!isMissingSchema(byUser.error)) throw new Error(byUser.error.message);
  if (!email) return [];
  const byEmail = await supabaseAdmin
    .from("custom_orders")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(100);
  if (byEmail.error) throw new Error(byEmail.error.message);
  return byEmail.data ?? [];
}

/** Public view of one custom request through its private tracking link. */
export async function requestByToken(supabaseAdmin: SupabaseAdmin, token: string) {
  const { data, error } = await supabaseAdmin
    .from("custom_orders")
    .select("*")
    .eq("tracking_token", token)
    .maybeSingle();
  if (error) {
    if (isMissingSchema(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return (await toRequestViews(supabaseAdmin, [data]))[0] ?? null;
}
