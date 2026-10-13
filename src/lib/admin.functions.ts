import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || `item-${Date.now()}`;

export const checkAdminSession = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => ({ userId: context.userId, isAdmin: true as const }));

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [orders, products, custom, payments] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select(
          "id,order_number,customer_name,status,payment_status,payment_kind,amount_paid,created_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("products")
        .select("id,stock_quantity,is_available,name")
        .order("stock_quantity", { ascending: true }),
      supabaseAdmin
        .from("custom_orders")
        .select("id,request_number,full_name,furniture_type,status,created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("payments")
        .select("id,status,payment_kind,amount")
        .eq("status", "completed"),
    ]);

    const orderRows = orders.data ?? [];
    const productRows = products.data ?? [];
    const customRows = custom.data ?? [];
    const paidRows = payments.data ?? [];

    const notDone = ["pending", "confirmed"];
    const inProgress = ["in_production", "ready", "out_for_delivery"];
    const paidAdvanceSum = paidRows
      .filter((p) => p.payment_kind === "advance")
      .reduce((s, p) => s + Number(p.amount), 0);
    const paidFullSum = paidRows
      .filter((p) => p.payment_kind === "full")
      .reduce((s, p) => s + Number(p.amount), 0);

    return {
      ordersTotal: orderRows.length,
      ordersNotDone: orderRows.filter((o) => notDone.includes(o.status)).length,
      ordersInProgress: orderRows.filter((o) => inProgress.includes(o.status)).length,
      ordersDone: orderRows.filter((o) => o.status === "completed").length,
      paidAdvance: paidRows.filter((p) => p.payment_kind === "advance").length,
      paidFull: paidRows.filter((p) => p.payment_kind === "full").length,
      paidAdvanceSum,
      paidFullSum,
      revenueTotal: paidAdvanceSum + paidFullSum,
      lowStock: productRows.filter(
        (p) => p.is_available && p.stock_quantity > 0 && p.stock_quantity <= 3,
      ).length,
      outOfStock: productRows.filter((p) => p.stock_quantity <= 0).length,
      customOpen: customRows.filter((c) => c.status !== "completed" && c.status !== "cancelled")
        .length,
      productsTotal: productRows.length,
      recentOrders: orderRows.slice(0, 5).map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        status: o.status,
        payment_status: o.payment_status,
        created_at: o.created_at,
      })),
      lowStockItems: productRows
        .filter((p) => p.stock_quantity <= 3)
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          name: p.name,
          stock_quantity: p.stock_quantity,
          is_available: p.is_available,
        })),
      recentCustom: customRows
        .filter((c) => c.status !== "completed" && c.status !== "cancelled")
        .slice(0, 4)
        .map((c) => ({
          id: c.id,
          request_number: c.request_number,
          full_name: c.full_name,
          furniture_type: c.furniture_type,
          status: c.status,
          created_at: c.created_at,
        })),
    };
  });

export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(
        "*, categories(slug,name), product_images(id,image_url,image_key,alt_text,sort_order)",
      )
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "product_images", ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAdminCategories = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("categories")
      .select("id,name,slug")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ImageUpload = z.object({
  name: z.string().max(200),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().max(7_000_000),
});

const ANGLE_LABELS = ["Product photo", "Extra photo"] as const;

const ProductInput = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  name_sw: z.string().trim().max(200).optional().or(z.literal("")),
  slug: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  description_sw: z.string().trim().max(5000).optional().or(z.literal("")),
  short_description: z.string().trim().max(500).optional().or(z.literal("")),
  price: z.number().min(0),
  material: z.string().trim().max(2000).optional().or(z.literal("")),
  dimensions: z.string().trim().max(2000).optional().or(z.literal("")),
  features: z.array(z.string()).default([]),
  available_colors: z.array(z.string()).default([]),
  stock_quantity: z.number().int().min(0),
  is_available: z.boolean(),
  is_featured: z.boolean(),
  image_key: z.string().trim().max(80).optional().or(z.literal("")),
  /** Product photo (0) and extra photo (1). */
  angle_uploads: z
    .array(
      z.object({
        slot: z.number().int().min(0).max(1),
        file: ImageUpload,
      }),
    )
    .max(2)
    .optional(),
  /** Slots to remove from product_images. */
  clear_angle_slots: z.array(z.number().int().min(0).max(1)).max(2).optional(),
});

async function uploadProductStorage(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  file: z.infer<typeof ImageUpload>,
) {
  const ext = file.type.split("/")[1];
  const path = `${crypto.randomUUID()}.${ext}`;
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const { error: upErr } = await supabaseAdmin.storage
    .from("product-images")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) throw new Error(`Image upload failed: ${upErr.message}`);
  const { data: pub } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);
  return { path, url: pub.publicUrl };
}

function storagePathFromPublicUrl(url: string | null | undefined) {
  if (!url) return null;
  const marker = "/product-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length).split("?")[0] ?? "");
}

async function syncProductAngles(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  productId: string,
  uploads: { slot: number; file: z.infer<typeof ImageUpload> }[] | undefined,
  clearSlots: number[] | undefined,
) {
  const { data: existing, error: listErr } = await supabaseAdmin
    .from("product_images")
    .select("id,image_url,sort_order")
    .eq("product_id", productId);
  if (listErr) throw new Error(listErr.message);

  const bySlot = new Map((existing ?? []).map((row) => [row.sort_order, row]));
  for (const row of existing ?? []) {
    if ((row.sort_order ?? 0) < 2) continue;
    const path = storagePathFromPublicUrl(row.image_url);
    if (path) await supabaseAdmin.storage.from("product-images").remove([path]);
    const { error } = await supabaseAdmin.from("product_images").delete().eq("id", row.id);
    if (error) throw new Error(error.message);
    bySlot.delete(row.sort_order);
  }
  const clearSet = new Set(clearSlots ?? []);
  const uploadBySlot = new Map((uploads ?? []).map((u) => [u.slot, u.file]));

  for (let slot = 0; slot <= 1; slot++) {
    const current = bySlot.get(slot);
    const nextFile = uploadBySlot.get(slot);
    const shouldClear = clearSet.has(slot) && !nextFile;

    if (shouldClear && current) {
      const path = storagePathFromPublicUrl(current.image_url);
      if (path) await supabaseAdmin.storage.from("product-images").remove([path]);
      const { error } = await supabaseAdmin.from("product_images").delete().eq("id", current.id);
      if (error) throw new Error(error.message);
      bySlot.delete(slot);
      continue;
    }

    if (!nextFile) continue;

    const uploaded = await uploadProductStorage(supabaseAdmin, nextFile);
    if (current) {
      const oldPath = storagePathFromPublicUrl(current.image_url);
      if (oldPath && oldPath !== uploaded.path) {
        await supabaseAdmin.storage.from("product-images").remove([oldPath]);
      }
      const alt_text = ANGLE_LABELS[slot as 0 | 1];
      const { error } = await supabaseAdmin
        .from("product_images")
        .update({
          image_url: uploaded.url,
          image_key: null,
          alt_text,
          sort_order: slot,
        })
        .eq("id", current.id);
      if (error) throw new Error(error.message);
      bySlot.set(slot, { ...current, image_url: uploaded.url });
    } else {
      const alt_text = ANGLE_LABELS[slot as 0 | 1];
      const { data: inserted, error } = await supabaseAdmin
        .from("product_images")
        .insert({
          product_id: productId,
          image_url: uploaded.url,
          alt_text,
          sort_order: slot,
        })
        .select("id,image_url,sort_order")
        .single();
      if (error || !inserted) throw new Error(error?.message ?? "Could not save product image");
      bySlot.set(slot, inserted);
    }
  }

  const primary = bySlot.get(0)?.image_url ?? null;
  const { error: syncErr } = await supabaseAdmin
    .from("products")
    .update({ image_url: primary, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (syncErr) throw new Error(syncErr.message);
}

export const upsertAdminProduct = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => ProductInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      category_id: data.category_id,
      name: data.name,
      name_sw: data.name_sw || null,
      slug: data.slug?.trim() || slugify(data.name),
      description: data.description || "",
      description_sw: data.description_sw || null,
      short_description: data.short_description || null,
      price: data.price,
      material: data.material || null,
      dimensions: data.dimensions || null,
      features: data.features,
      available_colors: data.available_colors,
      stock_quantity: data.stock_quantity,
      is_available: data.is_available,
      is_featured: data.is_featured,
      image_key: data.image_key || null,
      is_demo: false,
      updated_at: new Date().toISOString(),
    };

    let productId = data.id;
    let slug = payload.slug;

    if (productId) {
      const { data: row, error } = await supabaseAdmin
        .from("products")
        .update(payload)
        .eq("id", productId)
        .select("id,slug")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Update failed");
      slug = row.slug;
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("products")
        .insert(payload)
        .select("id,slug")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Create failed");
      productId = row.id;
      slug = row.slug;
    }

    await syncProductAngles(supabaseAdmin, productId, data.angle_uploads, data.clear_angle_slots);

    return { id: productId, slug };
  });

export const deleteAdminProduct = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: imgs } = await supabaseAdmin
      .from("product_images")
      .select("image_url")
      .eq("product_id", data.id);
    const paths = (imgs ?? [])
      .map((row) => storagePathFromPublicUrl(row.image_url))
      .filter((p): p is string => Boolean(p));
    if (paths.length) await supabaseAdmin.storage.from("product-images").remove(paths);

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("image_url")
      .eq("id", data.id)
      .maybeSingle();
    const primaryPath = storagePathFromPublicUrl(product?.image_url);
    if (primaryPath && !paths.includes(primaryPath)) {
      await supabaseAdmin.storage.from("product-images").remove([primaryPath]);
    }

    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProductStock = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        stock_quantity: z.number().int().min(0),
        is_available: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updated_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("products")
      .update(
        typeof data.is_available === "boolean"
          ? { stock_quantity: data.stock_quantity, is_available: data.is_available, updated_at }
          : { stock_quantity: data.stock_quantity, updated_at },
      )
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "in_production",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(ORDER_STATUSES),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.note) {
      await supabaseAdmin.from("order_status_history").insert({
        order_id: data.id,
        status: data.status,
        note: data.note,
      });
    }
    return { ok: true };
  });

export const deleteAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AdminOrderInput = z.object({
  customer_name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(/^[+\d\s()-]+$/),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  preferred_color: z.string().trim().min(1).max(80),
  preferred_size: z.string().trim().min(1).max(40),
  delivery_location: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  status: z.enum(ORDER_STATUSES).default("confirmed"),
  payment_kind: z.enum(["advance", "full"]).default("full"),
  payment_status: z.enum(["unpaid", "pending", "paid", "failed"]).default("unpaid"),
  amount_paid: z.number().min(0).optional(),
});

/** Create an order from the admin portal. Reference number is generated by the database. */
export const createAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => AdminOrderInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id,name,price,stock_quantity")
      .eq("id", data.product_id)
      .single();
    if (pErr || !product) throw new Error("Product not found");

    const lineTotal = Number(product.price) * data.quantity;
    const amountPaid = data.amount_paid ?? (data.payment_status === "paid" ? lineTotal : 0);
    const amountDue = Math.max(0, lineTotal - amountPaid);

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
        status: data.status,
        payment_kind: data.payment_kind,
        payment_status: data.payment_status,
        amount_due: amountDue,
        amount_paid: amountPaid,
        payment_phone: data.phone.replace(/\D/g, ""),
      })
      .select("id,order_number")
      .single();
    if (error || !order) throw new Error(error?.message ?? "Could not create order");

    const { error: iErr } = await supabaseAdmin.from("order_items").insert({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      quantity: data.quantity,
      unit_price: product.price,
    });
    if (iErr) throw new Error(iErr.message);

    if (product.stock_quantity > 0) {
      await supabaseAdmin
        .from("products")
        .update({
          stock_quantity: Math.max(0, product.stock_quantity - data.quantity),
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
    }

    await supabaseAdmin.from("order_status_history").insert({
      order_id: order.id,
      status: data.status,
      note: "Created by admin",
    });

    return { id: order.id, orderNumber: order.order_number };
  });

export const listAdminCustomOrders = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("custom_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const withUrls = await Promise.all(
      rows.map(async (row) => {
        let signed_url: string | null = null;
        if (row.reference_image_url) {
          const { data: signed } = await supabaseAdmin.storage
            .from("custom-order-references")
            .createSignedUrl(row.reference_image_url, 60 * 60);
          signed_url = signed?.signedUrl ?? null;
        }
        return { ...row, signed_url };
      }),
    );
    return withUrls;
  });

export const updateCustomOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "quoted", "in_progress", "completed", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("custom_orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdminCustomOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("custom_orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listContactMessages = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
