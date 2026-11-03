import { balanceDue } from "@/lib/payment-policy";
import { toSnippePhone } from "@/config/payments";
import { SITE } from "@/config/site";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type PaymentPurpose = "advance" | "balance" | "full";

export function snippeConfigured() {
  return Boolean(process.env["SNIPPE_API_KEY"]?.trim());
}

async function snippeClient() {
  const apiKey = process.env["SNIPPE_API_KEY"]?.trim();
  if (!apiKey) return null;
  const { Snippe } = await import("@snippe/sdk");
  const webhookUrl = process.env["SNIPPE_WEBHOOK_URL"]?.trim();
  return new Snippe({ apiKey, ...(webhookUrl ? { webhookUrl } : {}) });
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "Customer";
  const last = parts.slice(1).join(" ") || first;
  return { firstName: first, lastName: last };
}

/** Insert a pending payment and send the mobile money prompt. Returns the payment id. */
export async function startMobilePayment(
  supabaseAdmin: SupabaseAdmin,
  input: {
    orderId: string;
    orderNumber: string;
    purpose: PaymentPurpose;
    amount: number;
    phone: string;
    customerName: string;
    email: string | null;
  },
) {
  const amount = Math.round(input.amount);
  const phone = toSnippePhone(input.phone);
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .insert({
      order_id: input.orderId,
      payment_kind: input.purpose === "full" ? "full" : "advance",
      purpose: input.purpose,
      amount,
      phone,
      status: "pending",
      metadata: { source: "snippe" },
    })
    .select("id")
    .single();
  if (error || !payment) throw new Error(error?.message ?? "Could not start payment");

  const snippe = await snippeClient();
  if (!snippe) throw new Error("Online payment is not configured");

  try {
    const { count } = await supabaseAdmin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("order_id", input.orderId);
    const created = await snippe.payments.mobile.create(
      {
        amount,
        phoneNumber: phone,
        customer: { ...splitName(input.customerName), email: input.email || SITE.email },
        metadata: { order_id: input.orderId, order_number: input.orderNumber, payment_id: payment.id },
      },
      { idempotencyKey: `${input.orderNumber}-t${count ?? 1}`.slice(0, 30) },
    );
    await supabaseAdmin
      .from("payments")
      .update({ snippe_reference: created.reference, updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    await supabaseAdmin
      .from("orders")
      .update({ snippe_reference: created.reference, payment_phone: phone })
      .eq("id", input.orderId);
  } catch (err) {
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", metadata: { source: "snippe", error: String(err) }, updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    throw new Error("We could not send the payment prompt. Check the number and try again.");
  }
  return payment.id;
}

async function nextReceiptNumber(supabaseAdmin: SupabaseAdmin, orderId: string, orderNumber: string) {
  const { count } = await supabaseAdmin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .not("receipt_number", "is", null);
  return `RCT-${orderNumber}-${(count ?? 0) + 1}`;
}

/** Reduce stock once per order, when the advance has been paid. */
async function applyStockOnce(supabaseAdmin: SupabaseAdmin, orderId: string) {
  const { data: claimed } = await supabaseAdmin
    .from("orders")
    .update({ stock_applied: true })
    .eq("id", orderId)
    .eq("stock_applied", false)
    .select("id")
    .maybeSingle();
  if (!claimed) return;
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_id,quantity")
    .eq("order_id", orderId);
  for (const item of items ?? []) {
    if (!item.product_id) continue;
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("stock_quantity")
      .eq("id", item.product_id)
      .maybeSingle();
    if (!product || product.stock_quantity <= 0) continue;
    await supabaseAdmin
      .from("products")
      .update({
        stock_quantity: Math.max(0, product.stock_quantity - item.quantity),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.product_id);
  }
}

/** Recalculate the order's payment fields from its completed payments. */
export async function refreshOrderPayments(supabaseAdmin: SupabaseAdmin, orderId: string, note?: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id,status,total_amount,advance_required")
    .eq("id", orderId)
    .single();
  if (!order) return null;
  const { data: rows } = await supabaseAdmin
    .from("payments")
    .select("amount,status")
    .eq("order_id", orderId);
  const paid = (rows ?? []).filter((r) => r.status === "completed").reduce((sum, r) => sum + Number(r.amount), 0);
  const anyPending = (rows ?? []).some((r) => r.status === "pending");
  const total = Number(order.total_amount);
  const fully = total > 0 && paid >= total;
  const advancePaid = paid > 0 && Math.round(paid) >= Math.round(Number(order.advance_required));
  const nextStatus = order.status === "pending" && advancePaid ? "confirmed" : order.status;

  await supabaseAdmin
    .from("orders")
    .update({
      amount_paid: paid,
      amount_due: balanceDue(total, paid),
      payment_kind: paid <= 0 ? "none" : fully ? "full" : "advance",
      payment_status: paid > 0 ? "paid" : anyPending ? "pending" : "unpaid",
      status: nextStatus,
    })
    .eq("id", orderId);

  if (advancePaid) await applyStockOnce(supabaseAdmin, orderId);
  if (note) {
    await supabaseAdmin.from("order_status_history").insert({ order_id: orderId, status: nextStatus, note });
  }
  return { paid, total, balance: balanceDue(total, paid), status: nextStatus };
}

/** Mark a payment completed, give it a receipt number and update the order. Safe to call twice. */
export async function completePayment(
  supabaseAdmin: SupabaseAdmin,
  paymentId: string,
  details: { amount?: number | undefined; provider?: string | null; metadata?: unknown },
) {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id,order_id,amount,status,purpose,receipt_number,orders(order_number)")
    .eq("id", paymentId)
    .single();
  if (!payment || payment.status === "completed") return;
  const orderNumber = (payment.orders as { order_number: string } | null)?.order_number ?? "GK";
  const received = details.amount != null && details.amount > 0 ? details.amount : Number(payment.amount);
  const receipt = payment.receipt_number ?? (await nextReceiptNumber(supabaseAdmin, payment.order_id, orderNumber));

  const { data: updated } = await supabaseAdmin
    .from("payments")
    .update({
      status: "completed",
      amount: received,
      provider: details.provider ?? null,
      receipt_number: receipt,
      ...(details.metadata !== undefined ? { metadata: JSON.parse(JSON.stringify(details.metadata)) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .neq("status", "completed")
    .select("id")
    .maybeSingle();
  if (!updated) return;

  const mismatch = Math.round(received) !== Math.round(Number(payment.amount))
    ? ` (expected ${Math.round(Number(payment.amount)).toLocaleString("en-US")} TSh)`
    : "";
  await refreshOrderPayments(
    supabaseAdmin,
    payment.order_id,
    `Payment received: ${Math.round(received).toLocaleString("en-US")} TSh ${payment.purpose}${
      details.provider ? ` via ${details.provider}` : ""
    }${mismatch}. Receipt ${receipt}.`,
  );
}

export async function failPayment(supabaseAdmin: SupabaseAdmin, paymentId: string, status: "failed" | "expired", metadata?: unknown) {
  const { data: updated } = await supabaseAdmin
    .from("payments")
    .update({
      status,
      ...(metadata !== undefined ? { metadata: JSON.parse(JSON.stringify(metadata)) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("order_id")
    .maybeSingle();
  if (updated) await refreshOrderPayments(supabaseAdmin, updated.order_id);
}

/** Ask Snippe for the latest state of a pending payment (used when no webhook has arrived). */
export async function reconcilePayment(supabaseAdmin: SupabaseAdmin, paymentId: string, reference: string) {
  const snippe = await snippeClient();
  if (!snippe) return;
  try {
    const remote = await snippe.payments.get(reference);
    if (remote.status === "completed") {
      await completePayment(supabaseAdmin, paymentId, { amount: remote.amount?.value, metadata: remote });
    } else if (remote.status === "failed" || remote.status === "voided" || remote.status === "expired") {
      await failPayment(supabaseAdmin, paymentId, remote.status === "expired" ? "expired" : "failed", remote);
    }
  } catch {
    // The webhook will still update the payment; polling just tries again.
  }
}

export async function resendPrompt(reference: string) {
  const snippe = await snippeClient();
  if (!snippe) throw new Error("Online payment is not configured");
  await snippe.payments.retriggerPush(reference);
}
