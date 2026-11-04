import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { actorLabel, writeAudit } from "@/lib/audit.server";
import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import { MIGRATION_0008 } from "@/lib/ops/inventory.server";
import { noteOrderHistory, writeOrderStatus } from "@/lib/ops/order-history.server";

const tsh = (n: number) => `${Math.round(n).toLocaleString("en-US")} TSh`;

type Section<T> = { available: true; rows: T[] } | { available: false; rows: T[] };

function section<T>(result: { data: T[] | null; error: { code?: string | null; message?: string | null } | null }): Section<T> {
  if (result.error) {
    if (isMissingSchema(result.error)) return { available: false, rows: [] };
    throw new Error(result.error.message ?? "Database error");
  }
  return { available: true, rows: result.data ?? [] };
}

/** Refunds, delivery records, linked production jobs / purchase orders and audit entries for one order. */
export const listOrderOps = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: items } = await supabaseAdmin.from("order_items").select("id").eq("order_id", data.orderId);
    const itemIds = (items ?? []).map((i) => i.id);

    const [refunds, deliveries, jobs, posByOrder, poLines, audit] = await Promise.all([
      supabaseAdmin.from("refunds").select("*").eq("order_id", data.orderId).order("created_at", { ascending: false }),
      supabaseAdmin.from("delivery_records").select("*").eq("order_id", data.orderId).order("created_at", { ascending: false }),
      supabaseAdmin
        .from("production_jobs")
        .select("id,job_number,status,order_item_id,description,quantity,target_date,route")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("purchase_orders")
        .select("id,po_number,status,expected_date,suppliers(name)")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: false }),
      itemIds.length
        ? supabaseAdmin
            .from("purchase_items")
            .select("order_item_id,purchase_orders(id,po_number,status,expected_date,suppliers(name))")
            .in("order_item_id", itemIds)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from("audit_logs")
        .select("id,action,actor_email,before,after,created_at")
        .eq("entity", "order")
        .eq("entity_id", data.orderId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const poSection = section(posByOrder);
    const lineSection = section(poLines as { data: { order_item_id: string | null; purchase_orders: unknown }[] | null; error: null });
    type PoRef = { id: string; po_number: string; status: string; expected_date: string | null; supplier: string | null; order_item_ids: string[] };
    const pos = new Map<string, PoRef>();
    for (const po of poSection.rows) {
      const supplier = (po.suppliers as { name: string } | null)?.name ?? null;
      pos.set(po.id, { id: po.id, po_number: po.po_number, status: po.status, expected_date: po.expected_date, supplier, order_item_ids: [] });
    }
    for (const line of lineSection.rows) {
      const po = line.purchase_orders as
        | { id: string; po_number: string; status: string; expected_date: string | null; suppliers: { name: string } | null }
        | null;
      if (!po) continue;
      const ref = pos.get(po.id) ?? {
        id: po.id,
        po_number: po.po_number,
        status: po.status,
        expected_date: po.expected_date,
        supplier: po.suppliers?.name ?? null,
        order_item_ids: [],
      };
      if (line.order_item_id) ref.order_item_ids.push(line.order_item_id);
      pos.set(po.id, ref);
    }

    return {
      refunds: section(refunds),
      deliveries: section(deliveries),
      jobs: section(jobs),
      purchaseOrders: { available: poSection.available, rows: [...pos.values()] },
      audit: section(audit),
    };
  });

/** Refund part or all of a completed payment. A reason is required (BR-12). */
export const recordRefund = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        paymentId: z.string().uuid(),
        amount: z.number().positive().max(50_000_000),
        reason: z.string().trim().min(3).max(500),
        method: z.string().trim().max(60).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshOrderPayments } = await import("@/lib/order-payments.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id,order_id,amount,status,receipt_number,provider")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment || payment.order_id !== data.orderId) throw new Error("Payment not found on this order");
    if (payment.status !== "completed") throw new Error("Only completed payments can be refunded");

    const { data: previous, error: prevErr } = await supabaseAdmin.from("refunds").select("amount").eq("payment_id", payment.id);
    if (prevErr) {
      if (isMissingSchema(prevErr)) throw new Error(migrationNeeded(MIGRATION_0008));
      throw new Error(prevErr.message);
    }
    const already = (previous ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const left = Math.round(Number(payment.amount) - already);
    if (Math.round(data.amount) > left) throw new Error(`Only ${tsh(left)} of this payment can still be refunded`);

    const actor = await actorLabel(supabaseAdmin, context.userId);
    const { data: refund, error } = await supabaseAdmin
      .from("refunds")
      .insert({
        order_id: data.orderId,
        payment_id: payment.id,
        amount: data.amount,
        reason: data.reason,
        method: data.method || payment.provider || null,
        created_by: actor,
      })
      .select("*")
      .single();
    if (error || !refund) throw new Error(error?.message ?? "Could not record the refund");

    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "refund",
      entity: "order",
      entityId: data.orderId,
      before: { payment_id: payment.id, refunded_before: already },
      after: { refund_id: refund.id, amount: data.amount, reason: data.reason },
    });
    const result = await refreshOrderPayments(
      supabaseAdmin,
      data.orderId,
      `Refund of ${tsh(data.amount)} on ${payment.receipt_number ?? "payment"}. Reason: ${data.reason}`,
      actor,
    );

    const { data: order } = await supabaseAdmin.from("orders").select("order_number,user_id").eq("id", data.orderId).maybeSingle();
    if (order) {
      const { notify } = await import("@/lib/notify.server");
      await notify({
        audience: "customer",
        userId: order.user_id,
        type: "refund",
        title: `Refund for order ${order.order_number}`,
        body: `${tsh(data.amount)} has been refunded.`,
        link: `/account/orders/${order.order_number}`,
        entity: "order",
        entityId: data.orderId,
      });
    }
    return { ok: true, status: result?.status ?? null };
  });

const DeliveryInput = z.object({
  id: z.string().uuid().optional(),
  orderId: z.string().uuid(),
  method: z.enum(["delivery", "collection"]),
  scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
  completed_at: z.string().datetime({ offset: true }).nullable().optional(),
  received_by: z.string().trim().max(120).optional().or(z.literal("")),
  handled_by: z.string().trim().max(120).optional().or(z.literal("")),
  cost: z.number().min(0).max(50_000_000),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

/** Create or update the delivery / collection record for an order. */
export const saveDeliveryRecord = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => DeliveryInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const body = {
      order_id: data.orderId,
      method: data.method,
      scheduled_at: data.scheduled_at ?? null,
      completed_at: data.completed_at ?? null,
      received_by: data.received_by || null,
      handled_by: data.handled_by || null,
      cost: data.cost,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
    };
    const result = data.id
      ? await supabaseAdmin.from("delivery_records").update(body).eq("id", data.id).eq("order_id", data.orderId).select("*").single()
      : await supabaseAdmin.from("delivery_records").insert(body).select("*").single();
    if (result.error) {
      if (isMissingSchema(result.error)) throw new Error(migrationNeeded(MIGRATION_0008));
      throw new Error(result.error.message);
    }
    const { data: order } = await supabaseAdmin.from("orders").select("status").eq("id", data.orderId).maybeSingle();
    if (order) {
      const what = data.method === "collection" ? "Collection" : "Delivery";
      const parts = [
        data.completed_at ? `${what} completed` : data.scheduled_at ? `${what} scheduled` : `${what} record saved`,
        data.received_by ? `received by ${data.received_by}` : null,
        data.handled_by ? `handled by ${data.handled_by}` : null,
      ].filter(Boolean);
      await noteOrderHistory(supabaseAdmin, {
        orderId: data.orderId,
        status: order.status,
        note: `${parts.join(", ")}.`,
        actor: await actorLabel(supabaseAdmin, context.userId),
        statusChanged: false,
      });
    }
    return result.data;
  });

/** Cancel an order with a reason. Money already received must be refunded first. */
export const cancelOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), reason: z.string().trim().min(5).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,status,amount_paid,user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled") throw new Error("This order is already cancelled");
    if (["delivered", "completed"].includes(order.status)) throw new Error("A delivered order cannot be cancelled; refund it instead");
    if (Math.round(Number(order.amount_paid)) > 0) {
      throw new Error(`${tsh(Number(order.amount_paid))} has been paid on this order. Refund it first, then cancel.`);
    }

    const note = `Cancelled: ${data.reason}`;
    await writeOrderStatus(supabaseAdmin, order.id, "cancelled", { cancel_reason: data.reason, status_reason: note });
    const actor = await actorLabel(supabaseAdmin, context.userId);
    await noteOrderHistory(supabaseAdmin, { orderId: order.id, status: "cancelled", note, actor, statusChanged: true });
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "order_cancel",
      entity: "order",
      entityId: order.id,
      before: { status: order.status },
      after: { status: "cancelled", reason: data.reason },
    });
    const { notify } = await import("@/lib/notify.server");
    await notify({
      audience: "customer",
      userId: order.user_id,
      type: "order_status",
      title: `Order ${order.order_number} was cancelled`,
      body: data.reason,
      link: `/account/orders/${order.order_number}`,
      entity: "order",
      entityId: order.id,
    });
    return { ok: true };
  });
