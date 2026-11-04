import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalSupabaseAuth } from "@/integrations/supabase/customer-auth";
import { composeOrderNotes, parseCatalogColor, parseOptionList, selectedOptionPrice } from "@/lib/order-options";
import {
  advanceAmount,
  advanceSettingsFrom,
  advanceTierFor,
  balanceDue,
  MIN_MOBILE_PAYMENT_TZS,
} from "@/lib/payment-policy";

const phone = z.string().trim().min(7).max(20).regex(/^[+\d\s()-]+$/);
const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const CheckoutInput = z
  .object({
    items: z
      .array(
        z.object({
          product_id: z.string().uuid(),
          quantity: z.number().int().min(1).max(100),
          material: z.string().trim().max(120),
          size: z.string().trim().max(120),
          color: z.string().trim().max(120),
        }),
      )
      .min(1)
      .max(30),
    customer_name: z.string().trim().min(1).max(120),
    phone,
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    fulfilment_method: z.enum(["delivery", "collection"]).default("delivery"),
    region: opt(80),
    district: opt(80),
    address_line: opt(200),
    /** Older clients send one free-text location. */
    delivery_location: opt(200),
    save_address: z.boolean().optional(),
    needed_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: opt(1000),
    payment_choice: z.enum(["advance", "full"]),
    payment_phone: phone.optional().or(z.literal("")),
    specs_agreed: z.literal(true),
  })
  .refine(
    (d) => d.fulfilment_method === "collection" || Boolean(d.region && d.address_line) || Boolean(d.delivery_location),
    { message: "Delivery address is required", path: ["address_line"] },
  );

/** Public checkout settings: whether online payment is on, and where to collect from. */
export const getCheckoutConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { snippeConfigured } = await import("@/lib/order-payments.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("site_settings").select("*").eq("id", 1).maybeSingle();
  return {
    onlinePayment: snippeConfigured(),
    collectionAddress: data?.collection_address || data?.location || "Mbeya, Tanzania",
  };
});

/** Amount the customer pays now; never below the mobile money minimum or above what is left. */
function chargeNow(target: number, left: number) {
  if (left <= 0) return 0;
  return Math.min(left, Math.max(MIN_MOBILE_PAYMENT_TZS, Math.round(target)));
}

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((d) => CheckoutInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { snippeConfigured, startMobilePayment } = await import("@/lib/order-payments.server");

    const { isMissingSchema } = await import("@/lib/db-compat");
    const { notify } = await import("@/lib/notify.server");
    const { composeDeliveryLocation, deliveryFeeStatusFor, orderTotal } = await import("@/lib/delivery");

    const ids = [...new Set(data.items.map((i) => i.product_id))];
    const { data: products, error: pErr } = await supabaseAdmin.from("products").select("*").in("id", ids);
    if (pErr) throw new Error("Could not load products");
    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    const lines = data.items.map((item) => {
      const product = byId.get(item.product_id);
      if (!product) throw new Error("A product in your cart is no longer available");
      if (!product.is_available || (product.status ?? "active") !== "active") {
        throw new Error(`${product.name} is not available to order right now. Remove it from your cart to continue.`);
      }
      const materials = parseOptionList(product.material);
      const dimensions = parseOptionList(product.dimensions);
      const colors = product.available_colors.map((c) => parseCatalogColor(c).label);
      if (materials.length && !materials.includes(item.material)) throw new Error(`Choose a material for ${product.name}`);
      if (dimensions.length && !dimensions.includes(item.size)) throw new Error(`Choose a size for ${product.name}`);
      if (colors.length && !colors.includes(item.color)) throw new Error(`Choose a colour for ${product.name}`);
      const unitPrice = selectedOptionPrice(product, item.material, item.size);
      if (unitPrice == null || unitPrice <= 0) throw new Error(`${product.name} has no price for that choice`);
      return { ...item, product, unitPrice };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
    const { data: settingsRow } = await supabaseAdmin.from("site_settings").select("*").eq("id", 1).maybeSingle();
    const { percent } = advanceTierFor({ total: subtotal, itemCount }, advanceSettingsFrom(settingsRow));
    const advanceRequired = advanceAmount(subtotal, percent);
    const first = lines[0];

    // Delivery fee: confirmed by GK Furnish after the order, unless collection or every item ships free.
    const method = data.fulfilment_method;
    const deliveryFeeStatus = deliveryFeeStatusFor(method, lines.map((l) => l.product));
    const deliveryFee = deliveryFeeStatus === "free" ? 0 : null;
    const total = orderTotal(subtotal, deliveryFee);
    const collectionLabel = `Collection from GK Furnish (${settingsRow?.collection_address || settingsRow?.location || "Mbeya"})`;
    const deliveryLocation =
      (method === "delivery" && data.region && data.address_line
        ? composeDeliveryLocation({ method, region: data.region, district: data.district ?? "", area: data.address_line })
        : method === "collection"
          ? collectionLabel
          : data.delivery_location) || collectionLabel;
    const paymentPhone = data.payment_phone || data.phone;

    const baseOrder = {
      user_id: context.userId,
      customer_name: data.customer_name,
      phone: data.phone,
      email: data.email || context.email || null,
      preferred_color: first?.color || null,
      preferred_size: first?.size || null,
      delivery_location: deliveryLocation,
      needed_by: data.needed_by,
      notes: composeOrderNotes({ material: lines.length === 1 ? first?.material : "", neededBy: data.needed_by, notes: data.notes }),
      payment_kind: data.payment_choice,
      payment_status: "unpaid",
      payment_phone: paymentPhone,
      total_amount: total,
      advance_percent: percent,
      advance_required: advanceRequired,
      amount_due: total,
      amount_paid: 0,
    };
    const fullOrder = {
      ...baseOrder,
      fulfilment_method: method,
      region: method === "delivery" ? data.region || null : null,
      district: method === "delivery" ? data.district || null : null,
      address_line: method === "delivery" ? data.address_line || null : null,
      subtotal_amount: subtotal,
      delivery_fee: deliveryFee,
      delivery_fee_status: deliveryFeeStatus,
    };

    let schemaReady = true;
    let inserted = await supabaseAdmin.from("orders").insert(fullOrder).select("id,order_number,tracking_token").single();
    if (inserted.error && isMissingSchema(inserted.error)) {
      // Migration 0007 not run yet: save the order the old way.
      schemaReady = false;
      const legacy = await supabaseAdmin.from("orders").insert(baseOrder).select("id,order_number").single();
      inserted = { ...legacy, data: legacy.data ? { ...legacy.data, tracking_token: "" } : null } as typeof inserted;
    }
    const order = inserted.data;
    if (inserted.error || !order) throw new Error("Could not save order");

    const itemRows = lines.map((l) => ({
      order_id: order.id,
      product_id: l.product.id,
      product_name: l.product.name,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      material: l.material || null,
      size: l.size || null,
      color: l.color || null,
    }));
    let itemsResult = schemaReady
      ? await supabaseAdmin.from("order_items").insert(
          itemRows.map((row, i) => {
            const product = lines[i]!.product;
            return {
              ...row,
              sku: product.sku ?? null,
              snapshot: {
                sku: product.sku ?? null,
                name: product.name,
                unit_price: row.unit_price,
                material: row.material,
                size: row.size,
                color: row.color,
                source_type: product.source_type ?? "in_house",
                finish: product.finish ?? null,
                free_delivery: product.free_delivery ?? false,
              },
            };
          }),
        )
      : await supabaseAdmin.from("order_items").insert(itemRows);
    if (itemsResult.error && isMissingSchema(itemsResult.error)) {
      itemsResult = await supabaseAdmin.from("order_items").insert(itemRows);
    }
    if (itemsResult.error) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error("Could not save order items");
    }

    const deliveryNote =
      deliveryFeeStatus === "free"
        ? method === "collection"
          ? " Collection (free)."
          : " Free delivery."
        : " Delivery fee to be confirmed.";
    await supabaseAdmin.from("order_status_history").insert({
      order_id: order.id,
      status: "pending",
      note: `Customer confirmed the design and specifications at checkout. Advance ${percent}% = ${advanceRequired.toLocaleString("en-US")} TZS.${deliveryNote}`,
    });

    if (context.userId) {
      await supabaseAdmin.from("cart_items").delete().eq("user_id", context.userId);
      if (data.save_address && method === "delivery" && data.region && data.address_line) {
        const { count } = await supabaseAdmin
          .from("customer_addresses")
          .select("id", { count: "exact", head: true })
          .eq("user_id", context.userId);
        await supabaseAdmin.from("customer_addresses").insert({
          user_id: context.userId,
          full_name: data.customer_name,
          phone: data.phone,
          region: data.region,
          district: data.district || null,
          address_line: data.address_line,
          is_default: !count,
        });
      }
    }

    const trackingToken = order.tracking_token || null;
    await Promise.all([
      notify({
        audience: "customer",
        userId: context.userId,
        type: "order_received",
        title: `Order ${order.order_number} received`,
        body:
          deliveryFeeStatus === "pending"
            ? "We will confirm your order and the delivery fee with you shortly."
            : "We will confirm your order with you shortly.",
        link: `/account/orders/${order.order_number}`,
        entity: "order",
        entityId: order.id,
      }),
      notify({
        audience: "staff",
        type: "order_new",
        title: `New order ${order.order_number}`,
        body: `${data.customer_name} · ${subtotal.toLocaleString("en-US")} TZS${deliveryFeeStatus === "pending" ? " · delivery fee to confirm" : ""}`,
        link: "/admin/orders",
        entity: "order",
        entityId: order.id,
      }),
    ]);

    const amount = chargeNow(data.payment_choice === "full" ? total : advanceRequired, total);
    let paymentId: string | null = null;
    let paymentError: string | null = null;
    if (snippeConfigured()) {
      try {
        paymentId = await startMobilePayment(supabaseAdmin, {
          orderId: order.id,
          orderNumber: order.order_number,
          purpose: data.payment_choice === "full" ? "full" : "advance",
          amount,
          phone: paymentPhone,
          customerName: data.customer_name,
          email: data.email || context.email || null,
        });
        await supabaseAdmin.from("orders").update({ payment_status: "pending" }).eq("id", order.id);
      } catch (err) {
        paymentError = err instanceof Error ? err.message : "Payment could not start";
      }
    }

    return {
      orderNumber: order.order_number,
      trackingToken,
      paymentId,
      paymentError,
      onlinePayment: snippeConfigured(),
      subtotal,
      deliveryFeeStatus,
      total,
      advancePercent: percent,
      advanceRequired,
      amount,
      deliveryLocation,
      itemSummary: lines.map((l) => `${l.product.name} × ${l.quantity}`).join(", "),
      quantity: itemCount,
    };
  });

/** Public status of one payment. The payment id is a random uuid, so it works as a private link. */
export const getPaymentStatus = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reconcilePayment } = await import("@/lib/order-payments.server");
    const load = () =>
      supabaseAdmin
        .from("payments")
        .select(
          "id,amount,status,purpose,phone,provider,receipt_number,snippe_reference,created_at,updated_at,order_id,orders(order_number,customer_name,phone,email,delivery_location,total_amount,amount_paid,advance_percent,advance_required,status,created_at,order_items(product_name,quantity,unit_price,material,size,color))",
        )
        .eq("id", data.paymentId)
        .maybeSingle();
    let { data: payment } = await load();
    if (!payment) throw new Error("Payment not found");

    const ageMs = Date.now() - new Date(payment.created_at).getTime();
    if (payment.status === "pending" && payment.snippe_reference && ageMs > 60_000) {
      await reconcilePayment(supabaseAdmin, payment.id, payment.snippe_reference);
      ({ data: payment } = await load());
      if (!payment) throw new Error("Payment not found");
    }

    const order = payment.orders as {
      order_number: string;
      customer_name: string;
      phone: string;
      email: string | null;
      delivery_location: string;
      total_amount: number;
      amount_paid: number;
      advance_percent: number;
      advance_required: number;
      status: string;
      created_at: string;
      order_items: { product_name: string; quantity: number; unit_price: number; material: string | null; size: string | null; color: string | null }[];
    } | null;
    if (!order) throw new Error("Order not found");
    const masked = payment.phone ? `${payment.phone.slice(0, 5)}••••${payment.phone.slice(-3)}` : "";
    return {
      id: payment.id,
      status: payment.status as "pending" | "completed" | "failed" | "expired",
      amount: Number(payment.amount),
      purpose: payment.purpose,
      phone: masked,
      provider: payment.provider,
      receiptNumber: payment.receipt_number,
      paidAt: payment.updated_at,
      order: {
        number: order.order_number,
        customerName: order.customer_name,
        phone: order.phone,
        email: order.email,
        location: order.delivery_location,
        total: Number(order.total_amount),
        paid: Number(order.amount_paid),
        balance: balanceDue(Number(order.total_amount), Number(order.amount_paid)),
        advancePercent: order.advance_percent,
        advanceRequired: Number(order.advance_required),
        status: order.status,
        createdAt: order.created_at,
        items: order.order_items.map((i) => ({ ...i, unit_price: Number(i.unit_price) })),
      },
    };
  });

export const resendPaymentPrompt = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resendPrompt } = await import("@/lib/order-payments.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("status,snippe_reference")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment?.snippe_reference || payment.status !== "pending") throw new Error("This payment cannot be resent");
    await resendPrompt(payment.snippe_reference);
    return { ok: true };
  });

/**
 * Start a new mobile money payment for an order: the rest of the advance, or everything left.
 * Allowed for the order's owner, or for anyone holding one of the order's payment links.
 */
export const startOrderPayment = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        paymentId: z.string().uuid().optional(),
        orderNumber: z.string().trim().max(40).optional(),
        kind: z.enum(["advance", "full"]),
        phone,
      })
      .refine((d) => d.paymentId || d.orderNumber, "Order not found")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { snippeConfigured, startMobilePayment } = await import("@/lib/order-payments.server");
    if (!snippeConfigured()) throw new Error("Online payment is not switched on yet. Please contact us on WhatsApp.");

    let orderId: string | null = null;
    if (data.paymentId) {
      const { data: link } = await supabaseAdmin.from("payments").select("order_id").eq("id", data.paymentId).maybeSingle();
      orderId = link?.order_id ?? null;
    } else if (data.orderNumber && context.userId) {
      const { data: own } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("order_number", data.orderNumber)
        .eq("user_id", context.userId)
        .maybeSingle();
      orderId = own?.id ?? null;
    }
    if (!orderId) throw new Error("Order not found");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,customer_name,email,status,total_amount,amount_paid,advance_required")
      .eq("id", orderId)
      .single();
    if (!order || order.status === "cancelled") throw new Error("This order cannot be paid");
    const { count: pending } = await supabaseAdmin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId)
      .eq("status", "pending")
      .gt("created_at", new Date(Date.now() - 5 * 60_000).toISOString());
    if (pending) throw new Error("A payment prompt is already waiting. Check your phone or try again in a few minutes.");

    const total = Number(order.total_amount);
    const paid = Number(order.amount_paid);
    const left = balanceDue(total, paid);
    if (left <= 0) throw new Error("This order is already paid in full");
    const advanceLeft = Math.max(0, Number(order.advance_required) - paid);
    const wantsFull = data.kind === "full" || advanceLeft <= 0;
    const amount = chargeNow(wantsFull ? left : advanceLeft, left);
    const purpose = paid <= 0 && wantsFull ? "full" : advanceLeft > 0 && !wantsFull ? "advance" : "balance";

    const paymentId = await startMobilePayment(supabaseAdmin, {
      orderId: order.id,
      orderNumber: order.order_number,
      purpose,
      amount,
      phone: data.phone,
      customerName: order.customer_name,
      email: order.email,
    });
    return { paymentId };
  });
