import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { composeOrderNotes, parseOptionList, selectedOptionPrice } from "@/lib/order-options";

const phone = z.string().trim().min(7).max(20).regex(/^[+\d\s()-]+$/);
const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const CheckoutInput = z.object({
  customer_name: z.string().trim().min(1).max(120),
  phone,
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  preferred_color: z.string().trim().max(120).optional().or(z.literal("")),
  preferred_size: z.string().trim().max(120).optional().or(z.literal("")),
  preferred_material: z.string().trim().max(120).optional().or(z.literal("")),
  needed_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delivery_location: z.string().trim().min(1).max(200),
  notes: opt(1000),
  payment_kind: z.enum(["advance", "full"]),
});

export const submitOrderWithPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => CheckoutInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: product, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id,name,price,material,dimensions,features,stock_quantity")
      .eq("id", data.product_id)
      .single();
    if (pErr || !product) throw new Error("Product not found");

    const materials = parseOptionList(product.material);
    const dimensions = parseOptionList(product.dimensions);
    if (materials.length && !materials.includes(data.preferred_material ?? "")) {
      throw new Error("Choose a material");
    }
    if (dimensions.length && !dimensions.includes(data.preferred_size ?? "")) {
      throw new Error("Choose a size");
    }
    const unitPrice = selectedOptionPrice(product, data.preferred_material ?? "", data.preferred_size ?? "");
    if (unitPrice == null) throw new Error("Choose a material and size");

    const lineTotal = unitPrice * data.quantity;
    const notes = composeOrderNotes({
      material: data.preferred_material,
      neededBy: data.needed_by,
      notes: data.notes,
    });

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        phone: data.phone,
        email: data.email || null,
        preferred_color: data.preferred_color || null,
        preferred_size: data.preferred_size || null,
        delivery_location: data.delivery_location,
        notes,
        payment_kind: data.payment_kind,
        payment_status: "unpaid",
        amount_due: 0,
        amount_paid: 0,
        payment_phone: null,
      })
      .select("id,order_number")
      .single();
    if (error || !order) throw new Error("Could not save order");

    const { error: iErr } = await supabaseAdmin.from("order_items").insert({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      quantity: data.quantity,
      unit_price: unitPrice,
    });
    if (iErr) throw new Error("Could not save order item");

    if (product.stock_quantity > 0) {
      await supabaseAdmin
        .from("products")
        .update({
          stock_quantity: Math.max(0, product.stock_quantity - data.quantity),
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
    }

    return {
      orderNumber: order.order_number,
      productName: product.name,
      quantity: data.quantity,
      total: lineTotal,
      amountDue: 0,
      paymentKind: data.payment_kind,
      paymentStatus: "unpaid" as const,
      snippeReady: false as const,
      message: "Order saved. We will confirm payment with you on WhatsApp or by phone. Once placed, your order will be completed within 48 hours.",
      customerName: data.customer_name,
      phone: data.phone,
      email: data.email || "",
      preferredColor: data.preferred_color || "",
      preferredSize: data.preferred_size || "",
      preferredMaterial: data.preferred_material || "",
      neededBy: data.needed_by,
      deliveryLocation: data.delivery_location,
    };
  });

/** Apply a completed/failed Snippe webhook event to local tables. */
export async function applySnippePaymentEvent(event: {
  type: string;
  data: {
    reference?: string;
    status?: string;
    amount?: { value?: number; amount?: number; currency?: string };
    channel?: { provider?: string };
    metadata?: Record<string, unknown>;
  };
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ref = event.data.reference;
  const meta = event.data.metadata ?? {};
  const orderId = typeof meta["order_id"] === "string" ? meta["order_id"] : undefined;
  if (!ref && !orderId) return;

  let orderQuery = supabaseAdmin.from("orders").select("id,amount_due");
  if (orderId) orderQuery = orderQuery.eq("id", orderId);
  else if (ref) orderQuery = orderQuery.eq("snippe_reference", ref);
  const { data: order } = await orderQuery.maybeSingle();
  if (!order) return;

  const completed = event.type === "payment.completed" || event.data.status === "completed";
  const failed =
    event.type === "payment.failed" ||
    event.type === "payment.expired" ||
    event.type === "payment.voided" ||
    event.data.status === "failed";
  const eventJson = JSON.parse(JSON.stringify(event.data));

  if (completed) {
    const paid = event.data.amount?.value ?? event.data.amount?.amount ?? order.amount_due;
    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        amount_paid: paid,
        status: "confirmed",
        snippe_reference: ref ?? null,
      })
      .eq("id", order.id);

    await supabaseAdmin
      .from("payments")
      .update({
        status: "completed",
        provider: event.data.channel?.provider ?? null,
        updated_at: new Date().toISOString(),
        metadata: eventJson,
      })
      .eq("order_id", order.id)
      .eq("status", "pending");
  } else if (failed) {
    await supabaseAdmin.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", updated_at: new Date().toISOString(), metadata: eventJson })
      .eq("order_id", order.id)
      .eq("status", "pending");
  }
}
