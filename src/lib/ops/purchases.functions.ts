import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { actorLabel, writeAudit } from "@/lib/audit.server";
import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import { darToday, PAYMENT_METHODS, PO_OPEN_STATUSES } from "@/lib/ops/business";
import { MIGRATION_0008, recordMovement } from "@/lib/ops/inventory.server";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const missing = () => ({ available: false as const, reason: migrationNeeded(MIGRATION_0008) });
const migrationError = () => new Error(migrationNeeded(MIGRATION_0008));

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function landedCost(po: { total: number | string; transport_cost: number | string; inspection_cost: number | string }) {
  return Number(po.total) + Number(po.transport_cost) + Number(po.inspection_cost);
}

const PO_SELECT =
  "*, suppliers(id,name,phone), orders(id,order_number,customer_name), purchase_items(*), supplier_payments(*), quality_checks(*)";

/** All purchase orders with items, payments and checks. Balance = landed (total + transport + inspection) − payments on the PO. */
export const listPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("purchase_orders").select(PO_SELECT).order("created_at", { ascending: false });
    if (error) {
      if (isMissingSchema(error)) return missing();
      throw new Error(error.message);
    }
    const today = darToday();
    const rows = (data ?? []).map((po) => {
      const items = [...(po.purchase_items ?? [])]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((i) => ({
          ...i,
          quantity: Number(i.quantity),
          unit_cost: Number(i.unit_cost),
          accepted_qty: Number(i.accepted_qty),
          rejected_qty: Number(i.rejected_qty),
        }));
      const payments = [...(po.supplier_payments ?? [])]
        .map((p) => ({ ...p, amount: Number(p.amount) }))
        .sort((a, b) => a.paid_at.localeCompare(b.paid_at));
      const checks = [...(po.quality_checks ?? [])].sort((a, b) => b.checked_at.localeCompare(a.checked_at));
      const itemsTotal = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
      const landed = landedCost(po);
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      return {
        ...po,
        total: Number(po.total),
        transport_cost: Number(po.transport_cost),
        inspection_cost: Number(po.inspection_cost),
        deposit_paid: Number(po.deposit_paid),
        purchase_items: items,
        supplier_payments: payments,
        quality_checks: checks,
        itemsTotal,
        landed,
        paid,
        balance: po.status === "cancelled" ? 0 : Math.max(0, round2(landed - paid)),
        overdue: Boolean(po.expected_date && po.expected_date < today && PO_OPEN_STATUSES.includes(po.status)),
      };
    });
    return { available: true as const, reason: null, rows };
  });

/** Suppliers, stock items and open customer order lines for the PO form. */
export const listPurchaseFormOptions = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [suppliers, items, orders] = await Promise.all([
      supabaseAdmin.from("suppliers").select("id,name,status,payment_terms").order("name"),
      supabaseAdmin.from("inventory_items").select("id,name,unit,unit_cost,kind,sku").is("archived_at", null).order("name"),
      supabaseAdmin
        .from("orders")
        .select("id,order_number,customer_name,status,created_at,order_items(id,product_name,quantity,material,size,color)")
        .not("status", "in", "(completed,cancelled,refunded,delivered)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (suppliers.error) {
      if (isMissingSchema(suppliers.error)) return missing();
      throw new Error(suppliers.error.message);
    }
    return {
      available: true as const,
      reason: null,
      suppliers: suppliers.data ?? [],
      items: (items.data ?? []).map((i) => ({ ...i, unit_cost: Number(i.unit_cost) })),
      orders: orders.data ?? [],
    };
  });

const LineInput = z.object({
  description: z.string().trim().min(1).max(300),
  inventory_item_id: z.string().uuid().nullable().optional(),
  order_item_id: z.string().uuid().nullable().optional(),
  quantity: z.number().positive().max(1_000_000),
  unit_cost: z.number().min(0).max(100_000_000),
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const PoHeader = z.object({
  supplier_id: z.string().uuid({ message: "Choose a supplier" }),
  order_id: z.string().uuid().nullable().optional(),
  order_date: dateString.optional().or(z.literal("")),
  expected_date: dateString.optional().or(z.literal("")),
  transport_cost: z.number().min(0).max(100_000_000).default(0),
  inspection_cost: z.number().min(0).max(100_000_000).default(0),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

function itemRows(poId: string, lines: z.infer<typeof LineInput>[]) {
  return lines.map((l) => ({
    po_id: poId,
    description: l.description,
    inventory_item_id: l.inventory_item_id ?? null,
    order_item_id: l.order_item_id ?? null,
    quantity: round3(l.quantity),
    unit_cost: round2(l.unit_cost),
  }));
}

function linesTotal(lines: { quantity: number; unit_cost: number }[]) {
  return round2(lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0));
}

/** Create a PO. A supplier is required (BR-11); the total is the sum of the item lines. */
export const createPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => PoHeader.extend({ items: z.array(LineInput).min(1).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: po, error } = await supabaseAdmin
      .from("purchase_orders")
      .insert({
        supplier_id: data.supplier_id,
        order_id: data.order_id ?? null,
        ...(data.order_date ? { order_date: data.order_date } : {}),
        expected_date: data.expected_date || null,
        transport_cost: round2(data.transport_cost),
        inspection_cost: round2(data.inspection_cost),
        notes: data.notes || null,
        total: linesTotal(data.items),
      })
      .select("id,po_number,total")
      .single();
    if (error || !po) {
      if (isMissingSchema(error)) throw migrationError();
      throw new Error(error?.message ?? "Could not create the purchase order");
    }
    const { error: itemsError } = await supabaseAdmin.from("purchase_items").insert(itemRows(po.id, data.items));
    if (itemsError) {
      await supabaseAdmin.from("purchase_orders").delete().eq("id", po.id);
      throw new Error(itemsError.message);
    }
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "purchase_order.create",
      entity: "purchase_order",
      entityId: po.id,
      after: { po_number: po.po_number, total: po.total, items: data.items },
    });
    return { id: po.id, po_number: po.po_number };
  });

async function loadPo(supabaseAdmin: SupabaseAdmin, id: string) {
  const { data, error } = await supabaseAdmin
    .from("purchase_orders")
    .select("*, purchase_items(*), supplier_payments(id,amount)")
    .eq("id", id)
    .single();
  if (error || !data) {
    if (isMissingSchema(error)) throw migrationError();
    throw new Error(error?.message ?? "Purchase order not found");
  }
  const nothingReceived = (data.purchase_items ?? []).every((i) => Number(i.accepted_qty) === 0 && Number(i.rejected_qty) === 0);
  const paid = (data.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  return { po: data, nothingReceived, paid };
}

/** Edit a PO. Item lines can only be replaced while it is a draft or sent and nothing has been received. */
export const updatePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    PoHeader.extend({ id: z.string().uuid(), items: z.array(LineInput).min(1).max(50).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { po, nothingReceived, paid } = await loadPo(supabaseAdmin, data.id);
    if (po.status === "cancelled") throw new Error("This purchase order is cancelled");
    if (data.supplier_id !== po.supplier_id && paid > 0) {
      throw new Error("Payments are recorded against this supplier. Remove them before changing the supplier.");
    }
    const replaceItems = Boolean(data.items);
    if (replaceItems && (!["draft", "sent"].includes(po.status) || !nothingReceived)) {
      throw new Error("Items cannot change after goods have been received");
    }
    const total = data.items ? linesTotal(data.items) : Number(po.total);
    const nextLanded = total + data.transport_cost + data.inspection_cost;
    if (paid > nextLanded + 0.5) throw new Error("More has already been paid than the new total");

    const { error } = await supabaseAdmin
      .from("purchase_orders")
      .update({
        supplier_id: data.supplier_id,
        order_id: data.order_id ?? null,
        ...(data.order_date ? { order_date: data.order_date } : {}),
        expected_date: data.expected_date || null,
        transport_cost: round2(data.transport_cost),
        inspection_cost: round2(data.inspection_cost),
        notes: data.notes || null,
        total,
        updated_at: new Date().toISOString(),
      })
      .eq("id", po.id);
    if (error) throw new Error(error.message);
    if (data.items) {
      const { error: delError } = await supabaseAdmin.from("purchase_items").delete().eq("po_id", po.id);
      if (delError) throw new Error(delError.message);
      const { error: insError } = await supabaseAdmin.from("purchase_items").insert(itemRows(po.id, data.items));
      if (insError) throw new Error(insError.message);
    }
    if (total !== Number(po.total) || data.transport_cost !== Number(po.transport_cost) || data.inspection_cost !== Number(po.inspection_cost)) {
      await writeAudit(supabaseAdmin, {
        actor: context.userId,
        action: "purchase_order.price_change",
        entity: "purchase_order",
        entityId: po.id,
        before: { total: Number(po.total), transport_cost: Number(po.transport_cost), inspection_cost: Number(po.inspection_cost) },
        after: { total, transport_cost: data.transport_cost, inspection_cost: data.inspection_cost },
      });
    }
    return { ok: true };
  });

/**
 * Manual status changes: draft ↔ sent, close a partly received PO as received, or cancel
 * (reason required, only before anything is received).
 */
export const setPoStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "sent", "received", "cancelled"]),
        reason: z.string().trim().max(500).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { po, nothingReceived } = await loadPo(supabaseAdmin, data.id);
    if (po.status === data.status) return { ok: true };
    if (po.status === "cancelled") throw new Error("This purchase order is cancelled");
    const update: { status: string; notes?: string | null; updated_at: string; received_at?: string } = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "received") update.received_at = update.updated_at;
    if (data.status === "cancelled") {
      if (!nothingReceived) throw new Error("Goods have been received on this PO, so it cannot be cancelled");
      const reason = (data.reason ?? "").trim();
      if (reason.length < 3) throw new Error("Give a reason for cancelling");
      update.notes = [po.notes, `Cancelled: ${reason}`].filter(Boolean).join("\n");
    } else if (data.status === "received") {
      if (po.status !== "partially_received") throw new Error("Receive the goods first");
    } else if (!nothingReceived || !["draft", "sent"].includes(po.status)) {
      throw new Error("Goods have already been received on this PO");
    }
    const { error } = await supabaseAdmin.from("purchase_orders").update(update).eq("id", po.id);
    if (error) throw new Error(error.message);
    if (data.status === "cancelled" || data.status === "received") {
      await writeAudit(supabaseAdmin, {
        actor: context.userId,
        action: data.status === "cancelled" ? "purchase_order.cancel" : "purchase_order.close",
        entity: "purchase_order",
        entityId: po.id,
        before: { status: po.status },
        after: { status: data.status, reason: data.reason || null },
      });
    }
    return { ok: true };
  });

/**
 * Receive goods. Accepted quantities of lines linked to a stock item come in as purchase_in
 * movements. The PO becomes partly received or received automatically.
 */
export const receiveGoods = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        po_id: z.string().uuid(),
        lines: z
          .array(
            z.object({
              item_id: z.string().uuid(),
              accepted_qty: z.number().min(0).max(1_000_000),
              rejected_qty: z.number().min(0).max(1_000_000),
              defect_notes: z.string().trim().max(1000).optional().or(z.literal("")),
            }),
          )
          .min(1)
          .max(50),
        quality: z
          .object({ result: z.enum(["pass", "fail", "rework"]), notes: z.string().trim().max(1000).optional().or(z.literal("")) })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { po } = await loadPo(supabaseAdmin, data.po_id);
    if (po.status === "cancelled") throw new Error("This purchase order is cancelled");
    if (po.status === "received") throw new Error("This purchase order is already fully received");
    const actor = await actorLabel(supabaseAdmin, context.userId);
    const items = new Map((po.purchase_items ?? []).map((i) => [i.id, i]));
    const lines = data.lines.filter((l) => l.accepted_qty > 0 || l.rejected_qty > 0 || l.defect_notes);
    if (!lines.length) throw new Error("Enter the quantity accepted or rejected for at least one line");

    for (const line of lines) {
      const item = items.get(line.item_id);
      if (!item) throw new Error("A line does not belong to this purchase order");
      const already = Number(item.accepted_qty) + Number(item.rejected_qty);
      if (round3(already + line.accepted_qty + line.rejected_qty) > Number(item.quantity) + 1e-9) {
        throw new Error(`${item.description}: more than the ${Number(item.quantity)} ordered`);
      }
    }

    for (const line of lines) {
      const item = items.get(line.item_id)!;
      const accepted = round3(Number(item.accepted_qty) + line.accepted_qty);
      const rejected = round3(Number(item.rejected_qty) + line.rejected_qty);
      const defects = line.defect_notes ? [item.defect_notes, line.defect_notes].filter(Boolean).join("\n") : item.defect_notes;
      const { error } = await supabaseAdmin
        .from("purchase_items")
        .update({ accepted_qty: accepted, rejected_qty: rejected, defect_notes: defects })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      if (item.inventory_item_id && line.accepted_qty > 0) {
        try {
          await recordMovement(supabaseAdmin, {
            itemId: item.inventory_item_id,
            type: "purchase_in",
            quantityChange: line.accepted_qty,
            unitCost: Number(item.unit_cost),
            refEntity: "purchase_order",
            refId: po.id,
            note: `${po.po_number}: ${item.description}`,
            actor,
          });
        } catch (err) {
          await supabaseAdmin
            .from("purchase_items")
            .update({ accepted_qty: item.accepted_qty, rejected_qty: item.rejected_qty, defect_notes: item.defect_notes })
            .eq("id", item.id);
          throw err;
        }
      }
      item.accepted_qty = accepted;
      item.rejected_qty = rejected;
    }

    const all = [...items.values()];
    const complete = all.every((i) => Number(i.accepted_qty) + Number(i.rejected_qty) >= Number(i.quantity) - 1e-9);
    const status = complete ? "received" : "partially_received";
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("purchase_orders")
      .update({ status, updated_at: now, ...(complete ? { received_at: now } : {}) })
      .eq("id", po.id);

    if (data.quality) {
      await supabaseAdmin.from("quality_checks").insert({
        po_id: po.id,
        result: data.quality.result,
        notes: data.quality.notes || null,
        checked_by: actor,
      });
    }
    return { ok: true, status };
  });

export const addPoQualityCheck = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        po_id: z.string().uuid(),
        result: z.enum(["pass", "fail", "rework"]),
        notes: z.string().trim().max(1000).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("quality_checks").insert({
      po_id: data.po_id,
      result: data.result,
      notes: data.notes || null,
      checked_by: await actorLabel(supabaseAdmin, context.userId),
    });
    if (error) {
      if (isMissingSchema(error)) throw migrationError();
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Keep deposit_paid as what was paid before any goods arrived (informational only). */
async function syncDeposit(supabaseAdmin: SupabaseAdmin, poId: string, depositDelta: number) {
  const { data } = await supabaseAdmin.from("purchase_orders").select("deposit_paid, supplier_payments(amount)").eq("id", poId).single();
  if (!data) return;
  const paid = (data.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const next = Math.min(paid, Math.max(0, round2(Number(data.deposit_paid) + depositDelta)));
  await supabaseAdmin.from("purchase_orders").update({ deposit_paid: next }).eq("id", poId);
}

export const recordSupplierPayment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        po_id: z.string().uuid().nullable().optional(),
        supplier_id: z.string().uuid(),
        amount: z.number().positive().max(100_000_000),
        method: z.enum(PAYMENT_METHODS),
        paid_at: dateString.optional().or(z.literal("")),
        reference: z.string().trim().max(120).optional().or(z.literal("")),
        note: z.string().trim().max(500).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let deposit = false;
    if (data.po_id) {
      const { po, nothingReceived, paid } = await loadPo(supabaseAdmin, data.po_id);
      if (po.status === "cancelled") throw new Error("This purchase order is cancelled");
      if (po.supplier_id !== data.supplier_id) throw new Error("This payment's supplier does not match the purchase order");
      const balance = round2(landedCost(po) - paid);
      if (round2(data.amount) > balance + 0.5) {
        throw new Error(`That is more than the balance of ${Math.max(0, Math.round(balance)).toLocaleString("en-US")} TSh`);
      }
      deposit = nothingReceived;
    }
    const { data: row, error } = await supabaseAdmin
      .from("supplier_payments")
      .insert({
        po_id: data.po_id ?? null,
        supplier_id: data.supplier_id,
        amount: round2(data.amount),
        method: data.method,
        ...(data.paid_at ? { paid_at: data.paid_at } : {}),
        reference: data.reference || null,
        note: data.note || null,
      })
      .select("*")
      .single();
    if (error || !row) {
      if (isMissingSchema(error)) throw migrationError();
      throw new Error(error?.message ?? "Could not record the payment");
    }
    if (data.po_id && deposit) await syncDeposit(supabaseAdmin, data.po_id, data.amount);
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "supplier_payment.create",
      entity: "supplier_payment",
      entityId: row.id,
      after: row,
    });
    return { id: row.id };
  });

export const removeSupplierPayment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("supplier_payments").delete().eq("id", data.id).select("*").maybeSingle();
    if (error) {
      if (isMissingSchema(error)) throw migrationError();
      throw new Error(error.message);
    }
    if (!row) throw new Error("Payment not found");
    if (row.po_id) await syncDeposit(supabaseAdmin, row.po_id, -Number(row.amount));
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "supplier_payment.delete",
      entity: "supplier_payment",
      entityId: row.id,
      before: row,
    });
    return { ok: true };
  });
