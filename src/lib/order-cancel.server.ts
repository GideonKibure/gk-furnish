import { writeAudit } from "@/lib/audit.server";
import { PROMPT_TIMEOUT_REASON } from "@/lib/prompt-window";
import { UNPAID_EXPIRED_REASON } from "@/lib/reminders";
import { noteOrderHistory, writeOrderStatus } from "@/lib/ops/order-history.server";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type CancellableOrder = {
  id: string;
  order_number: string;
  status: string;
  amount_paid: number;
  user_id: string | null;
};

/** The same writes as an admin cancel. Refuses when money has already been confirmed. */
export async function cancelOrderRecord(
  supabaseAdmin: SupabaseAdmin,
  order: CancellableOrder,
  reason: string,
  actor: { userId: string | null; label: string },
) {
  if (order.status === "cancelled") return { ok: false as const, reason: "already_cancelled" };
  if (["delivered", "completed"].includes(order.status)) return { ok: false as const, reason: "delivered" };
  if (Math.round(Number(order.amount_paid)) > 0) return { ok: false as const, reason: "paid" };

  const note = `Cancelled: ${reason}`;
  await writeOrderStatus(supabaseAdmin, order.id, "cancelled", { cancel_reason: reason, status_reason: note });
  await noteOrderHistory(supabaseAdmin, {
    orderId: order.id,
    status: "cancelled",
    note,
    actor: actor.label,
    statusChanged: true,
  });
  await writeAudit(supabaseAdmin, {
    actor: actor.userId,
    action: "order_cancel",
    entity: "order",
    entityId: order.id,
    before: { status: order.status },
    after: { status: "cancelled", reason },
  });
  const { notify } = await import("@/lib/notify.server");
  await notify({
    audience: "customer",
    userId: order.user_id,
    type: "order_status",
    title: `Order ${order.order_number} was cancelled`,
    body: reason,
    link: `/account/orders/${order.order_number}`,
    entity: "order",
    entityId: order.id,
  });
  if (reason === UNPAID_EXPIRED_REASON || reason === PROMPT_TIMEOUT_REASON) {
    await notify({
      audience: "staff",
      type: "order_expired",
      title: `Unpaid order cancelled: ${order.order_number}`,
      body: reason,
      link: "/admin/orders",
      entity: "order",
      entityId: order.id,
    });
  }
  return { ok: true as const };
}
