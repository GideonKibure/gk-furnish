import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SITE } from "@/config/site";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { assertChatOrderAdmin, quoteChatOrder } from "@/lib/chat-order";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const lineSchema = z
  .object({
    product_id: z.string().uuid().optional(),
    custom_name: z.string().trim().max(160).optional(),
    quantity: z.number().int().min(1).max(100),
    unit_price: z.number().int().min(0).max(100_000_000).optional(),
  })
  .refine((line) => Boolean(line.product_id || line.custom_name), { message: "Choose a product or describe the piece." });

const ChatOrderInput = z
  .object({
    customer_name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20).regex(/^[+\d\s()-]+$/),
    fulfilment: z.enum(["collection", "delivery"]),
    delivery_location: z.string().trim().max(240).optional(),
    note: z.string().trim().max(1000).optional(),
    lines: z.array(lineSchema).min(1).max(20),
  })
  .refine((input) => input.fulfilment === "collection" || Boolean(input.delivery_location?.trim()), {
    message: "Add the delivery location.",
  });

/** Owner-only order from a chat. Advance, tracking token, and history match checkout. The WhatsApp message is not stored. */
export const createChatOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((data: unknown) => ChatOrderInput.parse(data))
  .handler(async ({ data, context }) => {
    assertChatOrderAdmin(context.isAdmin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isMissingSchema } = await import("@/lib/db-compat");
    const { deliveryFeeStatusFor, orderTotal } = await import("@/lib/delivery");
    const { lowestOptionPrice } = await import("@/lib/order-options");
    const { advanceSettingsFrom } = await import("@/lib/payment-policy");
    const { noteOrderHistory } = await import("@/lib/ops/order-history.server");

    const productIds = [...new Set(data.lines.flatMap((line) => (line.product_id ? [line.product_id] : [])))];
    const products = productIds.length
      ? await supabaseAdmin.from("products").select("*").in("id", productIds)
      : { data: [], error: null };
    if (products.error) throw new Error("Could not load products");
    const byId = new Map((products.data ?? []).map((product) => [product.id, product]));

    const priced = data.lines.map((line) => {
      if (!line.product_id) {
        return { name: line.custom_name ?? "Custom piece", quantity: line.quantity, unitPrice: line.unit_price ?? 0, product: null };
      }
      const product = byId.get(line.product_id);
      if (!product || !product.is_available || (product.status ?? "active") !== "active") {
        throw new Error("That product is not available to order.");
      }
      const unitPrice = lowestOptionPrice(product);
      if (unitPrice == null || unitPrice <= 0) throw new Error(`${product.name} has no price. Use a custom line instead.`);
      return { name: product.name, quantity: line.quantity, unitPrice, product };
    });

    const { data: settingsRow } = await supabaseAdmin.from("site_settings").select("*").eq("id", 1).maybeSingle();
    const quote = quoteChatOrder(
      priced.map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice })),
      advanceSettingsFrom(settingsRow),
    );
    const method = data.fulfilment;
    const deliveryProducts = priced.flatMap((line) => (line.product ? [line.product] : []));
    const deliveryFeeStatus = deliveryFeeStatusFor(method, deliveryProducts);
    const deliveryFee = deliveryFeeStatus === "free" ? 0 : null;
    const total = orderTotal(quote.subtotal, deliveryFee);
    const collectionLabel = `Collection from GK Furnish (${settingsRow?.collection_address || settingsRow?.location || "Mbeya"})`;
    const deliveryLocation = method === "collection" ? collectionLabel : data.delivery_location?.trim() || collectionLabel;

    const baseOrder = {
      customer_name: data.customer_name,
      phone: data.phone,
      preferred_color: null,
      preferred_size: null,
      delivery_location: deliveryLocation,
      notes: data.note || null,
      payment_kind: "advance" as const,
      payment_status: "unpaid" as const,
      payment_phone: data.phone.replace(/\D/g, ""),
      total_amount: total,
      advance_percent: quote.percent,
      advance_required: quote.advanceRequired,
      amount_due: total,
      amount_paid: 0,
    };
    const fullOrder = {
      ...baseOrder,
      fulfilment_method: method,
      subtotal_amount: quote.subtotal,
      delivery_fee: deliveryFee,
      delivery_fee_status: deliveryFeeStatus,
    };

    let inserted = await supabaseAdmin.from("orders").insert(fullOrder).select("id,order_number,tracking_token").single();
    if (inserted.error && isMissingSchema(inserted.error)) {
      const legacy = await supabaseAdmin.from("orders").insert(baseOrder).select("id,order_number").single();
      inserted = {
        ...legacy,
        data: legacy.data ? { ...legacy.data, tracking_token: "" } : null,
      } as typeof inserted;
    }
    const order = inserted.data;
    if (inserted.error || !order) throw new Error(inserted.error?.message ?? "Could not save order");

    const itemRows = priced.map((line) => ({
      order_id: order.id,
      product_id: line.product?.id ?? null,
      product_name: line.name,
      quantity: line.quantity,
      unit_price: line.unitPrice,
    }));
    const itemsResult = await supabaseAdmin.from("order_items").insert(itemRows);
    if (itemsResult.error) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error("Could not save order items");
    }

    const deliveryNote = deliveryFeeStatus === "free" ? " Collection (free)." : " Delivery fee to be confirmed.";
    await noteOrderHistory(supabaseAdmin, {
      orderId: order.id,
      status: "pending",
      note: `Created from a chat. Advance ${quote.percent}% = ${quote.advanceRequired.toLocaleString("en-US")} TZS.${deliveryNote} Specifications are not agreed yet.`,
      actor: "Owner",
      statusChanged: true,
    });

    const { notify } = await import("@/lib/notify.server");
    await notify({
      audience: "staff",
      type: "order_new",
      title: `Chat order ${order.order_number}`,
      body: `${data.customer_name} · ${quote.subtotal.toLocaleString("en-US")} TZS`,
      link: "/admin/orders",
      entity: "order",
      entityId: order.id,
    });

    const trackingUrl = order.tracking_token ? `${SITE.url}/track/${order.tracking_token}` : `${SITE.url}`;
    const whatsappUrl = buildWhatsAppLink({
      number: data.phone,
      text: `Hello, your GK Furnish order ${order.order_number} is saved. Follow it here: ${trackingUrl}`,
    });
    return {
      orderNumber: order.order_number,
      trackingUrl,
      whatsappUrl,
      advancePercent: quote.percent,
      advanceRequired: quote.advanceRequired,
      subtotal: quote.subtotal,
    };
  });
