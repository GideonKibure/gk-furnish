import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { composeOrderNotes } from "@/lib/order-options";

const phone = z.string().trim().min(7).max(20).regex(/^[+\d\s()-]+$/);
const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const OrderInput = z.object({
  customer_name: z.string().trim().min(1).max(120),
  phone,
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  preferred_color: z.string().trim().min(1).max(80),
  preferred_size: z.enum(["Small", "Standard", "Large"]),
  delivery_location: z.string().trim().min(1).max(200),
  notes: opt(1000),
});

export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => OrderInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Price comes from the database, never from the browser.
    const { data: product, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id,name,price")
      .eq("id", data.product_id)
      .single();
    if (pErr || !product) throw new Error("Product not found");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        phone: data.phone,
        email: data.email || null,
        preferred_color: data.preferred_color,
        preferred_size: data.preferred_size,
        delivery_location: data.delivery_location,
        notes: data.notes || null,
      })
      .select("id,order_number")
      .single();
    if (error || !order) throw new Error("Could not save order");

    const { error: iErr } = await supabaseAdmin.from("order_items").insert({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      quantity: data.quantity,
      unit_price: product.price,
    });
    if (iErr) throw new Error("Could not save order item");

    return {
      orderNumber: order.order_number,
      productName: product.name,
      quantity: data.quantity,
      total: Number(product.price) * data.quantity,
    };
  });

const CustomInput = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone,
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  furniture_type: z.string().trim().min(1).max(100),
  design_description: z.string().trim().min(1).max(2000),
  preferred_dimensions: opt(200),
  preferred_material: opt(120),
  preferred_color: opt(80),
  needed_by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number().int().min(1).max(100),
  budget_range: opt(80),
  delivery_location: z.string().trim().min(1).max(200),
  additional_requirements: opt(1000),
  reference_image: z
    .object({
      name: z.string().max(200),
      type: z.enum(["image/jpeg", "image/png", "image/webp"]),
      base64: z.string().max(7_000_000), // ~5MB file
    })
    .optional(),
});

export const submitCustomOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => CustomInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reference_image, ...fields } = data;
    let reference_image_url: string | null = null;
    if (reference_image) {
      const ext = reference_image.type.split("/")[1];
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const bytes = Uint8Array.from(atob(reference_image.base64), (c) => c.charCodeAt(0));
      const { error: upErr } = await supabaseAdmin.storage
        .from("custom-order-references")
        .upload(path, bytes, { contentType: reference_image.type });
      if (upErr) throw new Error("Could not upload image");
      reference_image_url = path; // private bucket path
    }
    const n = (v?: string) => (v ? v : null);
    const { data: row, error } = await supabaseAdmin
      .from("custom_orders")
      .insert({
        full_name: fields.full_name,
        phone: fields.phone,
        email: n(fields.email),
        furniture_type: fields.furniture_type,
        design_description: fields.design_description,
        preferred_dimensions: n(fields.preferred_dimensions),
        preferred_material: n(fields.preferred_material),
        preferred_color: n(fields.preferred_color),
        quantity: fields.quantity,
        budget_range: n(fields.budget_range),
        delivery_location: fields.delivery_location,
        additional_requirements: composeOrderNotes({
          neededBy: fields.needed_by,
          notes: fields.additional_requirements,
        }),
        reference_image_url,
      })
      .select("request_number")
      .single();
    if (error || !row) throw new Error("Could not save request");
    return { requestNumber: row.request_number, type: data.furniture_type, quantity: data.quantity };
  });
