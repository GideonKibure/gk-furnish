import { isMissingSchema } from "@/lib/db-compat";
import { balanceDue } from "@/lib/payment-policy";
import { completionAudit, shouldReduceStock, snippeReconcileEnabled, stockReductionForSale } from "@/lib/snippe-decision";
import { processSnippeEvent } from "@/lib/snippe-flow";
import { decideCallback, type LocalPayment } from "@/lib/palmpesa";
import { fetchPalmPayment, palmpesaConfigured, readPalmMeta, startPalmPayment } from "@/lib/palmpesa.server";
import { toSnippePhone } from "@/config/payments";
import { loadSnippeSdk } from "@/lib/snippe-sdk.server";
import { formatAmount, SITE } from "@/config/site";
import { customerCancelDecision, type CustomerCancelDecision } from "@/lib/customer-cancel";
import { PROMPT_TIMEOUT_REASON, promptWindowClosed } from "@/lib/prompt-window";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export type PaymentPurpose = "advance" | "balance" | "full";

export function snippeConfigured() {
  return Boolean(process.env["SNIPPE_API_KEY"]?.trim());
}

/** PalmPesa only when the server is explicitly set to it. Otherwise Snippe, when its key is set. */
export function palmPaymentsSelected() {
  return process.env["PAYMENT_MODE"] === "palmpesa" && palmpesaConfigured();
}

export function onlinePaymentsConfigured() {
  return palmPaymentsSelected() || snippeConfigured();
}

async function snippeClient() {
  const apiKey = process.env["SNIPPE_API_KEY"]?.trim();
  if (!apiKey) return null;
  const { Snippe } = loadSnippeSdk();
  const site = (process.env["SITE_URL"]?.trim() || SITE.url).replace(/\/$/, "");
  const webhookUrl = process.env["SNIPPE_WEBHOOK_URL"]?.trim() || `${site}/api/webhooks/snippe`;
  return new Snippe({ apiKey, webhookUrl });
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
  if (palmPaymentsSelected()) {
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
    const plan = stockReductionForSale(Number(item.quantity), input.quantity);
    if (plan.insufficient) {
      await flagOrderNeedsAttention(supabaseAdmin, input.orderId, "stock insufficient");
      return;
    }
    if (plan.deduct <= 0) return;
    try {
      await recordMovement(supabaseAdmin, {
        itemId: item.id,
        type: "sale_out",
        quantityChange: -plan.deduct,
        unitCost: Number(item.unit_cost),
        refEntity: "order",
        refId: input.orderId,
        note: input.orderNumber ? `Order ${input.orderNumber}` : "Order",
        actor: "System",
      });
    } catch (err) {
      console.warn("sale stock movement failed:", err instanceof Error ? err.message : err);
    }
    return;
  }
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("stock_quantity")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product) return;
  const plan = stockReductionForSale(product.stock_quantity, input.quantity);
  if (plan.insufficient) {
    await flagOrderNeedsAttention(supabaseAdmin, input.orderId, "stock insufficient");
    return;
  }
  if (plan.deduct <= 0) return;
  await supabaseAdmin
    .from("products")
    .update({
      stock_quantity: product.stock_quantity - plan.deduct,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.productId);
}

/** Put back stock that was reserved for an order, once. Unpaid orders usually have none. */
export async function releaseReservedStock(supabaseAdmin: SupabaseAdmin, orderId: string) {
  let claimed = await supabaseAdmin
    .from("orders")
    .update({ stock_applied: false })
    .eq("id", orderId)
    .eq("stock_applied", true)
    .select("id,order_number")
    .maybeSingle();
  if (claimed.error && isMissingSchema(claimed.error)) return;
  if (claimed.error || !claimed.data) return;
  const { data: items } = await supabaseAdmin.from("order_items").select("product_id,quantity").eq("order_id", orderId);
  for (const item of items ?? []) {
    if (!item.product_id || item.quantity <= 0) continue;
    const { finishedItemFor, recordMovement } = await import("@/lib/ops/inventory.server");
    const inventory = await finishedItemFor(supabaseAdmin, item.product_id);
    if (inventory) {
      try {
        await recordMovement(supabaseAdmin, {
          itemId: inventory.id,
          type: "return_in",
          quantityChange: item.quantity,
          unitCost: Number(inventory.unit_cost),
          refEntity: "order",
          refId: orderId,
          note: claimed.data.order_number ? `Released ${claimed.data.order_number}` : "Released unpaid order",
          actor: "System",
        });
      } catch (err) {
        console.warn("stock release failed:", err instanceof Error ? err.message : err);
      }
      continue;
    }
    const { data: product } = await supabaseAdmin.from("products").select("stock_quantity").eq("id", item.product_id).maybeSingle();
    if (!product) continue;
    await supabaseAdmin
      .from("products")
      .update({ stock_quantity: product.stock_quantity + item.quantity, updated_at: new Date().toISOString() })
      .eq("id", item.product_id);
  }
}

/** A confirmed payment on an order cancelled for non-payment reopens it, or flags the owner. */
async function reopenUnpaidExpiry(supabaseAdmin: SupabaseAdmin, orderId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id,status,cancel_reason,amount_paid,order_number")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;
  const { data: items } = await supabaseAdmin.from("order_items").select("product_id,quantity").eq("order_id", orderId);
  let stockOk = true;
  for (const item of items ?? []) {
    if (!item.product_id) continue;
    const { data: product } = await supabaseAdmin.from("products").select("stock_quantity").eq("id", item.product_id).maybeSingle();
    if (!product || Number(product.stock_quantity) < item.quantity) {
      stockOk = false;
      break;
    }
  }
  const { reopenDecision } = await import("@/lib/reminders");
  const decision = reopenDecision({
    status: order.status,
    cancelReason: order.cancel_reason,
    paid: Number(order.amount_paid),
    stockOk,
  });
  if (decision === "ignore") return;
  if (decision === "flag") {
    await flagOrderNeedsAttention(
      supabaseAdmin,
      orderId,
      "A confirmed payment arrived after this unpaid order was cancelled, and stock cannot cover it.",
    );
    return;
  }
  const { noteOrderHistory, writeOrderStatus } = await import("@/lib/ops/order-history.server");
  const note = "Reopened: a confirmed payment arrived after the unpaid expiry.";
  await writeOrderStatus(supabaseAdmin, orderId, "pending", { cancel_reason: null, status_reason: note });
  await noteOrderHistory(supabaseAdmin, { orderId, status: "pending", note, actor: "System", statusChanged: true });
  await refreshOrderPayments(supabaseAdmin, orderId, note, "System");
  const { notify } = await import("@/lib/notify.server");
  await notify({
    audience: "staff",
    type: "order_reopened",
    title: `Payment reopened order ${order.order_number}`,
    body: note,
    link: "/admin/orders",
    entity: "order",
    entityId: orderId,
  });
}

/** Flag an order when a confirmed sale cannot be covered. The payment itself still stands. */
export async function flagOrderNeedsAttention(supabaseAdmin: SupabaseAdmin, orderId: string, reason: string) {
  let result = await supabaseAdmin
    .from("orders")
    .update({ needs_attention: true, needs_attention_reason: reason })
    .eq("id", orderId);
  if (result.error && isMissingSchema(result.error)) {
    const message = result.error.message ?? "";
    if (message.includes("needs_attention_reason")) {
      result = await supabaseAdmin.from("orders").update({ needs_attention: true }).eq("id", orderId);
    } else if (message.includes("needs_attention")) {
      result = await supabaseAdmin.from("orders").update({ needs_attention_reason: reason }).eq("id", orderId);
    }
  }
  if (result.error && !isMissingSchema(result.error)) console.warn("[stock] could not flag order");
  const { notify } = await import("@/lib/notify.server");
  await notify({
    audience: "staff",
    type: "needs_attention",
    title: "Order needs attention",
    body: reason,
    link: "/admin/orders",
    entity: "order",
    entityId: orderId,
  });
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
  let loaded = await supabaseAdmin
    .from("orders")
    .select("id,status,total_amount,advance_required,stock_applied")
    .eq("id", orderId)
    .single();
  if (loaded.error && isMissingSchema(loaded.error)) {
    loaded = await supabaseAdmin
      .from("orders")
      .select("id,status,total_amount,advance_required")
      .eq("id", orderId)
      .single();
  }
  const order = loaded.data;
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

  const stockApplied = "stock_applied" in order && order.stock_applied === true;
  const stopped = order.status === "cancelled" || order.status === "refunded";
  if (!stopped && shouldReduceStock({ stockApplied, advanceCovered: advancePaid && !fullyRefunded })) {
    await applyStockOnce(supabaseAdmin, orderId);
  }
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
  details: {
    amount?: number | undefined;
    provider?: string | null;
    metadata?: unknown;
    providerReference?: string;
    confirmedVia?: "webhook" | "reconcile";
  },
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
  const audit = completionAudit(details);
  const patch = {
    status: "completed" as const,
    amount: received,
    provider: details.provider ?? null,
    receipt_number: receipt,
    paid_at: paidAt,
    ...audit,
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
    const { paid_at: _paidAt, confirmed_via: _via, provider_reference: _reference, ...withoutNewColumns } = patch;
    updatedResult = await supabaseAdmin
      .from("payments")
      .update(withoutNewColumns)
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
  await reopenUnpaidExpiry(supabaseAdmin, payment.order_id);
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("order_number,customer_name,email,tracking_token,amount_due,total_amount")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (order?.email) {
    const { sendCustomerEmail, orderTrackingLink } = await import("@/lib/mailjet.server");
    const purpose = payment.purpose === "full" ? "full payment" : payment.purpose === "balance" ? "balance" : "advance";
    const remaining = Math.max(0, Math.round(Number(order.amount_due ?? order.total_amount ?? 0)));
    await sendCustomerEmail({
      email: order.email,
      name: order.customer_name,
      subject: `Receipt ${receipt} for order ${order.order_number}`,
      preview: remaining > 0 ? `${formatAmount(remaining)} remains before handover.` : "This order is paid in full.",
      headline: remaining > 0 ? "Payment received" : "You're paid in full",
      paragraphs: [
        `This confirms your ${purpose} for order ${order.order_number}. Keep the receipt number with your records.`,
        remaining > 0
          ? `${formatAmount(remaining)} is still due. Clear it before handover so the piece can leave with you.`
          : "Nothing else is due on this order. We'll tell you when it is ready to deliver or collect.",
      ],
      highlight: { label: `Receipt ${receipt}`, value: formatAmount(received) },
      link: orderTrackingLink(order.tracking_token),
      linkLabel: "View your order",
    });
  }
}

export type CustomerCancelOutcome = CustomerCancelDecision | "wait" | "cancelled";

/**
 * Stop a payment the customer has not confirmed.
 * Asks the provider first. Confirmed money and a payment waiting for the owner are left as they are.
 * The order stays open.
 */
export async function cancelUnconfirmedPayment(
  supabaseAdmin: SupabaseAdmin,
  paymentId: string,
): Promise<CustomerCancelOutcome> {
  const load = async () => {
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id,status,snippe_reference,metadata")
      .eq("id", paymentId)
      .maybeSingle();
    return data;
  };
  let payment = await load();
  if (!payment) throw new Error("Payment not found");
  if (customerCancelDecision(payment.status) !== "cancel") return customerCancelDecision(payment.status);

  const palm = readPalmMeta(payment.metadata);
  if (payment.snippe_reference) {
    try {
      await getSnippePaymentStatus(payment.snippe_reference);
    } catch {
      return "wait";
    }
    await reconcilePayment(supabaseAdmin, payment.id, payment.snippe_reference);
  } else if (palm.source === "palmpesa" && palm.providerOrderId) {
    try {
      await fetchPalmPayment(palm.providerOrderId);
    } catch {
      return "wait";
    }
    await reconcilePalmPayment(supabaseAdmin, payment.id);
  }

  payment = await load();
  if (!payment) throw new Error("Payment not found");
  const decision = customerCancelDecision(payment.status);
  if (decision !== "cancel") return decision;

  await failPayment(supabaseAdmin, payment.id, "failed", {
    ...metaRecord(payment.metadata),
    source: "customer_cancel",
    failure_reason: "CANCELLED",
  });
  const after = await load();
  if (!after) throw new Error("Payment not found");
  if (after.status === "completed") return "paid";
  if (after.status === "needs_review") return "review";
  if (after.status === "pending") return "wait";
  return "cancelled";
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

/** Ask Snippe for one payment. Throws when the provider cannot be reached. */
export async function getSnippePaymentStatus(reference: string) {
  const snippe = await snippeClient();
  if (!snippe) throw new Error("Snippe is not configured");
  const remote = await snippe.payments.get(reference);
  return { status: remote.status, amount: remote.amount.value, currency: remote.amount.currency };
}

/** Hold a payment for the owner when Snippe's amount or currency does not match. */
export async function markPaymentNeedsReview(supabaseAdmin: SupabaseAdmin, paymentId: string, reason: string) {
  const { data: payment } = await supabaseAdmin.from("payments").select("id,order_id,status,metadata").eq("id", paymentId).maybeSingle();
  if (!payment || payment.status === "completed" || payment.status === "needs_review") return;
  const metadata =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? { ...payment.metadata, needs_review: true, review_reason: reason }
      : { needs_review: true, review_reason: reason };
  const updated = await supabaseAdmin
    .from("payments")
    .update({ status: "needs_review", metadata, updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .neq("status", "completed");
  if (updated.error) {
    const fallback = await supabaseAdmin
      .from("payments")
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq("id", paymentId)
      .neq("status", "completed");
    if (fallback.error && !isMissingSchema(fallback.error)) console.warn("[snippe] review save failed");
  }
  const { notify } = await import("@/lib/notify.server");
  await notify({
    audience: "staff",
    type: "payment_review",
    title: "Payment needs review",
    body: reason,
    link: "/admin/payments",
    entity: "payment",
    entityId: paymentId,
  });
}

/** Ask Snippe for the latest state of a pending payment and apply the same rules as the webhook. */
export async function reconcilePayment(supabaseAdmin: SupabaseAdmin, paymentId: string, reference: string) {
  if (!snippeReconcileEnabled(process.env)) return;
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id,amount,currency,status,metadata")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.status === "completed" || payment.status === "needs_review") return;
  const meta = payment.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta) && meta["needs_review"] === true) return;
  try {
    await processSnippeEvent(
      { id: `reconcile-${reference}`, type: null, reference, amount: null, currency: null },
      "reconcile",
      {
        claim: async () => "untracked",
        findByReference: async () => ({
          id: payment.id,
          amount: Number(payment.amount),
          currency: payment.currency,
          status: payment.status,
          reference,
          needsReview: false,
        }),
        getStatus: getSnippePaymentStatus,
        complete: async (id, via, providerReference) => {
          await completePayment(supabaseAdmin, id, { provider: "snippe", confirmedVia: via, providerReference });
        },
        fail: async (id, status) => {
          await failPayment(supabaseAdmin, id, status);
        },
        review: async (id) => {
          await markPaymentNeedsReview(supabaseAdmin, id, "Snippe amount or currency did not match this payment.");
        },
      },
    );
  } catch (err) {
    console.warn("[snippe reconcile]", err instanceof Error ? err.message : "error");
  }
}

/** Ask Snippe about payments that are still open, including ones whose webhook was missed. */
export async function reconcileOpenSnippePayments(
  supabaseAdmin: SupabaseAdmin,
  options?: { orderId?: string; limit?: number; minAgeMs?: number; maxAgeMs?: number },
) {
  if (!snippeReconcileEnabled(process.env)) return;
  const limit = options?.limit ?? 8;
  let query = supabaseAdmin
    .from("payments")
    .select("id,status,snippe_reference,created_at,metadata")
    .eq("status", "pending")
    .not("snippe_reference", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options?.orderId) query = query.eq("order_id", options.orderId);
  else query = query.gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
  const { data } = await query;
  for (const row of data ?? []) {
    if (!row.snippe_reference) continue;
    const meta = row.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta) && meta["needs_review"] === true) continue;
    const age = Date.now() - new Date(row.created_at).getTime();
    const minAge = options?.minAgeMs ?? 3_000;
    if (age < minAge) continue;
    if (options?.maxAgeMs != null && age > options.maxAgeMs) continue;
    await reconcilePayment(supabaseAdmin, row.id, row.snippe_reference);
    await expireUnconfirmedPrompt(supabaseAdmin, row.id);
  }
}

/**
 * After five minutes a phone prompt that is still unconfirmed is expired.
 * The order is cancelled only when nothing has been paid and no other payment is still open.
 */
export async function expireUnconfirmedPrompt(supabaseAdmin: SupabaseAdmin, paymentId: string) {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id,status,order_id,created_at,snippe_reference,metadata")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.status !== "pending") return;
  const palm = readPalmMeta(payment.metadata);
  const prompted = Boolean(payment.snippe_reference) || palm.source === "palmpesa";
  if (!prompted || !promptWindowClosed(payment.created_at, Date.now())) return;
  await failPayment(supabaseAdmin, payment.id, "expired", {
    ...metaRecord(payment.metadata),
    source: "prompt_timeout",
    reason: PROMPT_TIMEOUT_REASON,
  });
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id,order_number,status,amount_paid,user_id")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (!order) return;
  if (!["pending", "awaiting_payment"].includes(order.status)) return;
  if (Math.round(Number(order.amount_paid)) > 0) return;
  const { data: payments } = await supabaseAdmin
    .from("payments")
    .select("status")
    .eq("order_id", order.id);
  const stillOpen = (payments ?? []).some(
    (row) => row.status === "pending" || row.status === "needs_review",
  );
  if (stillOpen) return;
  await releaseReservedStock(supabaseAdmin, order.id);
  const { cancelOrderRecord } = await import("@/lib/order-cancel.server");
  await cancelOrderRecord(supabaseAdmin, order, PROMPT_TIMEOUT_REASON, {
    userId: null,
    label: "System",
  });
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
    if (row.status === "pending") await expireUnconfirmedPrompt(supabaseAdmin, row.id);
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
