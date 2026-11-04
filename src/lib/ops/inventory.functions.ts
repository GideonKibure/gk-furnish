import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { actorLabel, writeAudit } from "@/lib/audit.server";
import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import { INVENTORY_KINDS } from "@/lib/ops/business";
import { MIGRATION_0008, recordMovement } from "@/lib/ops/inventory.server";

const notReady = () => ({ available: false as const, reason: migrationNeeded(MIGRATION_0008) });

function fail(error: { code?: string | null; message: string }): never {
  if (isMissingSchema(error)) throw new Error(migrationNeeded(MIGRATION_0008));
  throw new Error(error.message);
}

/** Inventory items with their linked product, low-stock flag and value. */
export const listInventory = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ includeArchived: z.boolean().default(false) }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin.from("inventory_items").select("*, products(name,slug)").order("name");
    if (!data.includeArchived) query = query.is("archived_at", null);
    const [items, products] = await Promise.all([
      query,
      supabaseAdmin.from("products").select("id,name").order("name"),
    ]);
    if (items.error) {
      if (isMissingSchema(items.error)) return notReady();
      throw new Error(items.error.message);
    }
    return {
      available: true as const,
      reason: null,
      items: (items.data ?? []).map((item) => {
        const quantity = Number(item.quantity);
        const reorder = Number(item.reorder_level);
        return {
          ...item,
          quantity,
          reorder_level: reorder,
          unit_cost: Number(item.unit_cost),
          product_name: (item.products as { name: string } | null)?.name ?? null,
          low: reorder > 0 && quantity <= reorder,
          value: Math.max(0, quantity) * Number(item.unit_cost),
        };
      }),
      products: products.data ?? [],
    };
  });

const ItemInput = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  name: z.string().trim().min(1).max(160),
  kind: z.enum(INVENTORY_KINDS),
  unit: z.string().trim().min(1).max(20),
  product_id: z.string().uuid().nullable().optional(),
  reorder_level: z.number().min(0).max(1_000_000),
  unit_cost: z.number().min(0).max(1_000_000_000),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  opening_quantity: z.number().min(0).max(1_000_000).optional(),
});

export const upsertInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => ItemInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const body = {
      sku: data.sku?.trim() || null,
      name: data.name,
      kind: data.kind,
      unit: data.unit,
      product_id: data.kind === "finished" ? (data.product_id ?? null) : null,
      reorder_level: data.reorder_level,
      unit_cost: data.unit_cost,
      location: data.location || null,
      updated_at: new Date().toISOString(),
    };
    let before: unknown = null;
    if (data.id) {
      const { data: prev } = await supabaseAdmin.from("inventory_items").select("*").eq("id", data.id).maybeSingle();
      before = prev;
    }
    const result = data.id
      ? await supabaseAdmin.from("inventory_items").update(body).eq("id", data.id).select("id").single()
      : await supabaseAdmin.from("inventory_items").insert(body).select("id").single();
    if (result.error?.code === "23505") throw new Error("Another item already uses this SKU");
    if (result.error || !result.data) fail(result.error ?? { message: "Could not save the item" });
    const id = result.data.id;

    if (!data.id && data.opening_quantity && data.opening_quantity > 0) {
      await recordMovement(supabaseAdmin, {
        itemId: id,
        type: "opening",
        quantityChange: data.opening_quantity,
        unitCost: data.unit_cost,
        note: "Opening stock",
        actor: await actorLabel(supabaseAdmin, context.userId),
      });
    }
    if (data.id && before && Number((before as { unit_cost: number }).unit_cost) !== data.unit_cost) {
      await writeAudit(supabaseAdmin, {
        actor: context.userId,
        action: "inventory_cost_change",
        entity: "inventory_item",
        entityId: id,
        before: { unit_cost: (before as { unit_cost: number }).unit_cost },
        after: { unit_cost: data.unit_cost },
      });
    }
    return { id };
  });

export const setInventoryItemArchived = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("inventory_items")
      .update({ archived_at: data.archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) fail(error);
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: data.archived ? "inventory_archive" : "inventory_restore",
      entity: "inventory_item",
      entityId: data.id,
    });
    return { ok: true };
  });

export const listMovements = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z.object({ itemId: z.string().uuid().optional(), limit: z.number().int().min(1).max(500).default(200) }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("inventory_movements")
      .select("*, inventory_items(name,unit)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.itemId) query = query.eq("item_id", data.itemId);
    const { data: rows, error } = await query;
    if (error) {
      if (isMissingSchema(error)) return notReady();
      throw new Error(error.message);
    }
    return {
      available: true as const,
      reason: null,
      rows: (rows ?? []).map((m) => {
        const item = m.inventory_items as { name: string; unit: string } | null;
        return {
          ...m,
          quantity_change: Number(m.quantity_change),
          quantity_after: m.quantity_after == null ? null : Number(m.quantity_after),
          unit_cost: m.unit_cost == null ? null : Number(m.unit_cost),
          item_name: item?.name ?? "Removed item",
          item_unit: item?.unit ?? "",
        };
      }),
    };
  });

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        itemId: z.string().uuid(),
        quantityChange: z.number().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, "Enter a quantity"),
        type: z.enum(["adjustment", "damage", "return_in", "transfer"]),
        reason: z.string().trim().min(3).max(500),
        authoriseNegative: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error } = await supabaseAdmin
      .from("inventory_items")
      .select("id,name,quantity,unit_cost")
      .eq("id", data.itemId)
      .maybeSingle();
    if (error) fail(error);
    if (!item) throw new Error("Item not found");
    const change = data.type === "damage" ? -Math.abs(data.quantityChange) : data.quantityChange;
    const movement = await recordMovement(supabaseAdmin, {
      itemId: item.id,
      type: data.type,
      quantityChange: change,
      unitCost: Number(item.unit_cost),
      note: data.authoriseNegative ? `${data.reason} (negative stock authorised)` : data.reason,
      actor: await actorLabel(supabaseAdmin, context.userId),
      authorisedNegative: data.authoriseNegative,
    });
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "stock_adjustment",
      entity: "inventory_item",
      entityId: item.id,
      before: { quantity: Number(item.quantity) },
      after: {
        quantity: movement.quantity_after == null ? null : Number(movement.quantity_after),
        change,
        type: data.type,
        reason: data.reason,
        authorised_negative: data.authoriseNegative,
      },
    });
    return { ok: true, quantity: movement.quantity_after == null ? null : Number(movement.quantity_after) };
  });

/** Every product with its internal cost row (if any). Never exposed to the storefront. */
export const listProductCosts = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [products, costs] = await Promise.all([
      supabaseAdmin.from("products").select("id,name,price,slug").order("name"),
      supabaseAdmin.from("product_costs").select("*"),
    ]);
    if (costs.error) {
      if (isMissingSchema(costs.error)) return notReady();
      throw new Error(costs.error.message);
    }
    if (products.error) throw new Error(products.error.message);
    const byId = new Map((costs.data ?? []).map((c) => [c.product_id, c]));
    return {
      available: true as const,
      reason: null,
      rows: (products.data ?? []).map((p) => {
        const c = byId.get(p.id);
        return {
          product_id: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          material_cost: Number(c?.material_cost ?? 0),
          labour_cost: Number(c?.labour_cost ?? 0),
          overhead_cost: Number(c?.overhead_cost ?? 0),
          partner_price: c?.partner_price == null ? null : Number(c.partner_price),
          transport_cost: Number(c?.transport_cost ?? 0),
          has_costs: Boolean(c),
          updated_at: c?.updated_at ?? null,
        };
      }),
    };
  });

export const upsertProductCost = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        product_id: z.string().uuid(),
        material_cost: z.number().min(0).max(1_000_000_000),
        labour_cost: z.number().min(0).max(1_000_000_000),
        overhead_cost: z.number().min(0).max(1_000_000_000),
        partner_price: z.number().min(0).max(1_000_000_000).nullable(),
        transport_cost: z.number().min(0).max(1_000_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("product_costs").select("*").eq("product_id", data.product_id).maybeSingle();
    const { error } = await supabaseAdmin
      .from("product_costs")
      .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "product_id" });
    if (error) fail(error);
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "product_cost_change",
      entity: "product",
      entityId: data.product_id,
      before,
      after: data,
    });
    return { ok: true };
  });
