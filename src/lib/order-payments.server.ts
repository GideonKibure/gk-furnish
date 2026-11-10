import { isMissingSchema } from "@/lib/db-compat";
import { balanceDue } from "@/lib/payment-policy";
import { decideCallback, type LocalPayment } from "@/lib/palmpesa";
import { fetchPalmPayment, palmpesaConfigured, readPalmMeta, startPalmPayment } from "@/lib/palmpesa.server";
import { toSnippePhone } from "@/config/payments";
import { SITE } from "@/config/site";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type PaymentPurpose = "advance" | "balance" | "full";

export function snippeConfigured() {
  return Boolean(process.env["SNIPPE_API_KEY"]?.trim());
}

/** PalmPesa when its token is set, otherwise the older Snippe integration. */
export function onlinePaymentsConfigured() {
  return palmpesaConfigured() || snippeConfigured();
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
    balance: number;
    wallet: import("@/lib/palmpesa").WalletId;
  },
) {
  if (palmpesaConfigured()) {
    return startPalmPayment(supabaseAdmin, input);
  }
  const amount = Math.round(input.amount);
  if (amount <= 0 || amount > Math.round(input.balance)) throw new Error("That is more than the remaining balance.");
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
      metadata: { source: "snippe", wallet: input.wallet },
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
  const { data: order } = await supabaseAdmin.from("orders").select("order_number").eq("id", orderId).maybeSingle();
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_id,quantity")
    .eq("order_id", orderId);
  for (const item of items ?? []) {
    if (!item.product_id) continue;
    await deductStockForSale(supabaseAdmin, {
      productId: item.product_id,
      quantity: item.quantity,
      orderId,
      orderNumber: order?.order_number ?? null,
    });
  }
}

/**
 * Take sold units out of stock. Products tracked by a finished-goods inventory item get a
 * `sale_out` movement (which also updates product stock); others are decremented directly.
 * Never goes below zero, matching made-to-order products that have no stock.
 */
export async function deductStockForSale(
  supabaseAdmin: SupabaseAdmin,
  input: { productId: string; quantity: number; orderId: string; orderNumber: string | null },
) {
  const { finishedItemFor, recordMovement } = await import("@/lib/ops/inventory.server");
  const item = await finishedItemFor(supabaseAdmin, input.productId);
  if (item) {
    const take = Math.min(input.quantity, Math.max(0, Math.floor(Number(item.quantity))));
    if (take <= 0) return;
    try {
      await recordMovement(supabaseAdmin, {
        itemId: item.id,
        type: "sale_out",
        quantityChange: -take,
        unitCost: Number(item.unit_cost),
        refEntity: "order",
        refId: input.orderId,
        note: input.orderNumber ? `Order ${input.orderNumber}` : "Order",
        actor: "System",
      });
      return;
    } catch (err) {
      console.warn("sale stock movement failed:", err instanceof Error ? err.message : err);
      return;
    }
  }
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("stock_quantity")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product || product.stock_quantity <= 0) return;
  await supabaseAdmin
    .from("products")
    .update({
      stock_quantity: Math.max(0, product.stock_quantity - input.quantity),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.productId);
}

/** Total refunded on an order (0 before migration 0008 creates the refunds table). */
export async function refundedTotal(supabaseAdmin: SupabaseAdmin, orderId: string) {
  const { data, error } = await supabaseAdmin.from("refunds").select("amount").eq("order_id", orderId);
  if (error) {
    if (!isMissingSchema(error)) console.warn("refunds read failed:", error.message);
    return 0;
  }
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

/** Recalculate the order's payment fields from its completed payments, net of refunds. */
export async function refreshOrderPayments(supabaseAdmin: SupabaseAdmin, orderId: string, note?: string, actor?: string | null) {
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
  const received = (rows ?? []).filter((r) => r.status === "completed").reduce((sum, r) => sum + Number(r.amount), 0);
  const refunded = await refundedTotal(supabaseAdmin, orderId);
  const paid = Math.max(0, received - refunded);
  const anyPending = (rows ?? []).some((r) => r.status === "pending");
  const total = Number(order.total_amount);
  const fully = total > 0 && paid >= total;
  const advancePaid = paid > 0 && Math.round(paid) >= Math.round(Number(order.advance_required));
  const fullyRefunded = refunded > 0 && Math.round(paid) <= 0;
  const nextStatus = fullyRefunded
    ? "refunded"
    : (order.status === "pending" || order.status === "awaiting_payment") && advancePaid
      ? "confirmed"
      : order.status;

  const fields = {
    amount_paid: paid,
    amount_due: balanceDue(total, paid),
    payment_kind: paid <= 0 ? "none" : fully ? "full" : "advance",
    payment_status: paid > 0 ? "paid" : anyPending ? "pending" : "unpaid",
  };
  const { error } = await supabaseAdmin
    .from("orders")
    .update({ ...fields, status: nextStatus, ...(nextStatus !== order.status && note ? { status_reason: note } : {}) })
    .eq("id", orderId);
  if (error && nextStatus !== order.status) {
    // Before 0008 neither `refunded` nor `status_reason` exist; keep the payment figures right.
    await supabaseAdmin.from("orders").update({ ...fields, ...(nextStatus === "refunded" ? {} : { status: nextStatus }) }).eq("id", orderId);
  }

  if (advancePaid && !fullyRefunded) await applyStockOnce(supabaseAdmin, orderId);
  if (note) {
    const { noteOrderHistory } = await import("@/lib/ops/order-history.server");
    await noteOrderHistory(supabaseAdmin, {
      orderId,
      status: nextStatus,
      note,
      actor: actor ?? null,
      statusChanged: nextStatus !== order.status,
    });
  }
  return { paid, received, refunded, total, balance: balanceDue(total, paid), status: nextStatus };
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

  const paidAt = new Date().toISOString();
  const patch = {
    status: "completed" as const,
    amount: received,
    provider: details.provider ?? null,
    receipt_number: receipt,
    paid_at: paidAt,
    ...(details.metadata !== undefined ? { metadata: JSON.parse(JSON.stringify(details.metadata)) } : {}),
    updated_at: paidAt,
  };
  let updatedResult = await supabaseAdmin
    .from("payments")
    .update(patch)
    .eq("id", paymentId)
    .neq("status", "completed")
    .select("id")
    .maybeSingle();
  if (updatedResult.error && isMissingSchema(updatedResult.error)) {
    const { paid_at: _paidAt, ...withoutPaidAt } = patch;
    updatedResult = await supabaseAdmin
      .from("payments")
      .update(withoutPaidAt)
      .eq("id", paymentId)
      .neq("status", "completed")
      .select("id")
      .maybeSingle();
  }
  if (updatedResult.error) throw new Error(updatedResult.error.message);
  if (!updatedResult.data) return;

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
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number,customer_name,email,tracking_token")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (order?.email) {
    const { sendCustomerEmail, orderTrackingLink } = await import("@/lib/mailjet.server");
    const purpose = payment.purpose === "full" ? "full payment" : payment.purpose === "balance" ? "balance" : "advance";
    await sendCustomerEmail({
      email: order.email,
      name: order.customer_name,
      subject: `Receipt ${receipt} for order ${order.order_number}`,
      paragraphs: [
        `GK furnish confirmed your ${purpose} of ${Math.round(received).toLocaleString("en-US")} TZS.`,
        `Receipt ${receipt} for order ${order.order_number}.`,
      ],
      link: orderTrackingLink(order.tracking_token),
    });
  }
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

/** Ask PalmPesa whether a payment that is still open (or was expired) has since completed. */
export async function reconcilePalmPayment(supabaseAdmin: SupabaseAdmin, paymentId: string) {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id,amount,currency,status,metadata")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.status === "completed") return;
  const meta = readPalmMeta(payment.metadata);
  const providerOrderId = meta.providerOrderId;
  const transactionId = meta.transactionId;
  if (!providerOrderId || meta.source !== "palmpesa") return;
  let remote;
  try {
    remote = await fetchPalmPayment(providerOrderId);
  } catch {
    return;
  }
  if (!remote) return;
  const local: LocalPayment = {
    amount: Number(payment.amount),
    currency: payment.currency || "TZS",
    status: payment.status as LocalPayment["status"],
    transactionId,
    providerOrderId,
  };
  const decision = decideCallback({
    alreadyProcessed: false,
    payment: local,
    event: {
      event: `payment.${remote.status.toLowerCase()}`,
      event_id: `status-${providerOrderId}-${remote.status}`,
      transaction_id: remote.transaction_id,
      order_id: remote.order_id,
      selcom_reference: remote.reference,
      status: remote.status,
      amount: remote.amount,
      currency: remote.currency,
      channel: remote.channel,
      phone: null,
      failure_reason: remote.failure_reason,
    },
    verifiedStatus: remote.status,
  });
  if (decision.action === "complete") {
    await completePayment(supabaseAdmin, paymentId, {
      amount: remote.amount,
      provider: remote.channel ? `PalmPesa ${remote.channel}` : "PalmPesa",
      metadata: {
        ...metaRecord(payment.metadata),
        source: "palmpesa",
        transaction_id: remote.transaction_id,
        provider_order_id: remote.order_id,
        provider_reference: remote.reference,
        channel: remote.channel,
        method: "Mobile money",
      },
    });
  } else if (decision.action === "fail" && payment.status === "pending") {
    await failPayment(supabaseAdmin, paymentId, decision.status, {
      ...metaRecord(payment.metadata),
      source: "palmpesa",
      failure_reason: decision.reason,
    });
  }
}

/** Check PalmPesa for payments that are still open, and apply COMPLETED without an admin click. */
export async function reconcileOpenPalmPayments(supabaseAdmin: SupabaseAdmin, options?: { orderId?: string; limit?: number }) {
  if (!palmpesaConfigured()) return;
  const limit = options?.limit ?? 8;
  let query = supabaseAdmin
    .from("payments")
    .select("id,status,metadata,created_at")
    .in("status", ["pending", "expired"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options?.orderId) query = query.eq("order_id", options.orderId);
  else query = query.gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
  const { data } = await query;
  for (const row of data ?? []) {
    const meta = readPalmMeta(row.metadata);
    if (meta.source !== "palmpesa" || !meta.providerOrderId) continue;
    if (row.status === "pending" && Date.now() - new Date(row.created_at).getTime() < 3_000) continue;
    await reconcilePalmPayment(supabaseAdmin, row.id);
  }
}

function metaRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...(metadata as Record<string, unknown>) } : {};
}

export async function resendPrompt(reference: string) {
  const snippe = await snippeClient();
  if (!snippe) throw new Error("Online payment is not configured");
  await snippe.payments.retriggerPush(reference);
}
