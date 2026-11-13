import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { optionalSupabaseAuth } from "@/integrations/supabase/customer-auth";
import { composeOrderNotes, packReferenceImages } from "@/lib/order-options";

const phone = z.string().trim().min(7).max(20).regex(/^[+\d\s()-]+$/);
const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const CustomInput = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone,
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  furniture_type: z.string().trim().min(1).max(100),
  design_description: z.string().trim().min(1).max(2000),
  preferred_dimensions: opt(200),
  preferred_material: opt(500),
  preferred_color: opt(500),
  needed_by: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  quantity: z.number().int().min(1).max(100),
  budget: opt(80),
  finish: opt(120),
  delivery_location: z.string().trim().min(1).max(200),
  additional_requirements: opt(1000),
  reference_image: z
    .object({
      name: z.string().max(200),
      type: z.enum(["image/jpeg", "image/png", "image/webp"]),
      base64: z.string().max(7_000_000), // ~5MB file
    })
    .optional(),
  finish_image: z
    .object({
      name: z.string().max(200),
      type: z.enum(["image/jpeg", "image/png", "image/webp"]),
      base64: z.string().max(7_000_000),
    })
    .optional(),
});

export const submitCustomOrder = createServerFn({ method: "POST" })
  .middleware([optionalSupabaseAuth])
  .inputValidator((d) => CustomInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isMissingSchema } = await import("@/lib/db-compat");
    const { notify } = await import("@/lib/notify.server");
    const { reference_image, finish_image, ...fields } = data;
    async function uploadImage(image: { type: string; base64: string }) {
      const ext = image.type.split("/")[1];
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
      const { error: upErr } = await supabaseAdmin.storage
        .from("custom-order-references")
        .upload(path, bytes, { contentType: image.type });
      if (upErr) throw new Error("Could not upload image");
      return path;
    }
    const reference_image_url = packReferenceImages(
      reference_image ? await uploadImage(reference_image) : null,
      finish_image ? await uploadImage(finish_image) : null,
    );
    const n = (v?: string) => (v ? v : null);
    const base = {
      full_name: fields.full_name,
      phone: fields.phone,
      email: n(fields.email) ?? context.email ?? null,
      furniture_type: fields.furniture_type,
      design_description: fields.design_description,
      preferred_dimensions: n(fields.preferred_dimensions),
      preferred_material: n(fields.preferred_material),
      preferred_color: n(fields.preferred_color),
      quantity: fields.quantity,
      delivery_location: fields.delivery_location,
      reference_image_url,
    };
    let inserted = await supabaseAdmin
      .from("custom_orders")
      .insert({
        ...base,
        user_id: context.userId,
        needed_by: fields.needed_by || null,
        budget: n(fields.budget),
        finish: n(fields.finish),
        additional_requirements: composeOrderNotes({ neededBy: fields.needed_by || undefined, notes: fields.additional_requirements }),
      })
      .select("id,request_number,tracking_token")
      .single();
    if (inserted.error && isMissingSchema(inserted.error)) {
      // Before migration 0007: keep budget and finish in the notes; quotes own budget_range.
      const notes = [
        fields.budget ? `Budget: ${fields.budget}` : "",
        fields.finish ? `Finish: ${fields.finish}` : "",
        composeOrderNotes({ neededBy: fields.needed_by || undefined, notes: fields.additional_requirements }) ?? "",
      ]
        .filter(Boolean)
        .join("\n");
      const legacy = await supabaseAdmin
        .from("custom_orders")
        .insert({ ...base, additional_requirements: notes || null })
        .select("id,request_number")
        .single();
      inserted = { ...legacy, data: legacy.data ? { ...legacy.data, tracking_token: "" } : null } as typeof inserted;
    }
    const row = inserted.data;
    if (inserted.error || !row) throw new Error("Could not save request");

    await Promise.all([
      notify({
        audience: "staff",
        type: "custom_request_new",
        title: `New custom request ${row.request_number}`,
        body: `${fields.full_name}: ${fields.furniture_type} × ${fields.quantity}`,
        link: "/admin/custom-orders",
        entity: "custom_order",
        entityId: row.id,
      }),
      notify({
        audience: "customer",
        userId: context.userId,
        type: "custom_request_received",
        title: `Request ${row.request_number} received`,
        body: "We will review your design and send a quote.",
        link: `/account/requests/${row.request_number}`,
        entity: "custom_order",
        entityId: row.id,
      }),
    ]);
    return {
      requestNumber: row.request_number,
      trackingToken: row.tracking_token || null,
      type: data.furniture_type,
      quantity: data.quantity,
    };
  });
