import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export const MIGRATION_0008 = "0008_business_operations.sql";

export const MOVEMENT_TYPES = [
  "purchase_in",
  "production_use",
  "production_out",
  "sale_out",
  "adjustment",
  "damage",
  "return_in",
  "transfer",
  "opening",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type MovementInput = {
  itemId: string;
  type: MovementType;
  /** Signed: positive adds stock, negative removes it. */
  quantityChange: number;
  unitCost?: number | null | undefined;
  refEntity?: string | null | undefined;
  refId?: string | null | undefined;
  note?: string | null | undefined;
  actor?: string | null | undefined;
  /** BR-10: only an explicit, reasoned override may take stock below zero. */
  authorisedNegative?: boolean | undefined;
};

/**
 * The only way stock changes. The database trigger applies the movement to the item, blocks
 * negative stock unless authorised and keeps linked product stock in step.
 */
export async function recordMovement(supabaseAdmin: SupabaseAdmin, input: MovementInput) {
  const qty = Math.round(input.quantityChange * 1000) / 1000;
  if (!qty) throw new Error("The quantity must not be zero");
  const { data, error } = await supabaseAdmin
    .from("inventory_movements")
    .insert({
      item_id: input.itemId,
      type: input.type,
      quantity_change: qty,
      unit_cost: input.unitCost ?? null,
      ref_entity: input.refEntity ?? null,
      ref_id: input.refId ?? null,
      note: input.note ?? null,
      actor: input.actor ?? null,
      authorised_negative: input.authorisedNegative ?? false,
    })
    .select("id,quantity_after")
    .single();
  if (error) {
    if (isMissingSchema(error)) throw new Error(migrationNeeded(MIGRATION_0008));
    throw new Error(error.message);
  }
  await alertIfLow(supabaseAdmin, input.itemId);
  return data;
}

/** Staff notification when an item falls to or below its reorder level (at most once a day per item). */
export async function alertIfLow(supabaseAdmin: SupabaseAdmin, itemId: string) {
  const { data: item } = await supabaseAdmin
    .from("inventory_items")
    .select("id,name,unit,quantity,reorder_level,archived_at")
    .eq("id", itemId)
    .maybeSingle();
  if (!item || item.archived_at) return;
  const level = Number(item.reorder_level);
  if (level <= 0 || Number(item.quantity) > level) return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("audience", "staff")
    .eq("type", "low_stock")
    .eq("entity_id", item.id)
    .gte("created_at", since);
  if (count) return;
  const { notify } = await import("@/lib/notify.server");
  await notify({
    audience: "staff",
    type: "low_stock",
    title: `Low stock: ${item.name}`,
    body: `${Number(item.quantity)} ${item.unit} left (reorder at ${level}).`,
    link: "/admin/inventory",
    entity: "inventory_item",
    entityId: item.id,
  });
}

/**
 * Finished-goods item linked to a product, if any. When one exists, product stock is driven
 * by inventory movements instead of being edited directly.
 */
export async function finishedItemFor(supabaseAdmin: SupabaseAdmin, productId: string) {
  const { data, error } = await supabaseAdmin
    .from("inventory_items")
    .select("id,quantity,unit_cost")
    .eq("product_id", productId)
    .eq("kind", "finished")
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}
