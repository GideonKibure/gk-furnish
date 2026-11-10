import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { QUOTE_VALID_DAYS, quoteDateAfter, withQuoteAdvanceNote, type QuoteLine, type SavedQuote } from "@/lib/custom-quotes";
import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import { orderTotal } from "@/lib/delivery";
import { DATE_RANGES, darDayKey, darMonthKey, inRange, rangeBounds, trendPercent } from "@/lib/ops/date-range";
import { actorLabel, writeAudit } from "@/lib/audit.server";
import { noteOrderHistory, statusRejected, writeOrderStatus } from "@/lib/ops/order-history.server";
import { CUSTOM_NEEDS_QUOTE, CUSTOM_STATUSES, ORDER_STATUSES, orderStatusLabel } from "@/lib/ops/status";
import { formatPreference, unpackReferenceImages } from "@/lib/order-options";
import { advanceAmount, advanceSettingsFrom, advanceTierFor, statusBlockers } from "@/lib/payment-policy";

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

/** Columns that only exist once migration 0007 has run; read them defensively. */
type OrderExtras = {
  archived_at?: string | null;
  fulfilment_method?: string | null;
  delivery_fee?: number | null;
  delivery_fee_status?: string | null;
  subtotal_amount?: number | null;
};

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ range: z.enum(DATE_RANGES).default("30d") }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bounds = rangeBounds(data.range);
    const [orders, products, custom, payments] = await Promise.all([
      supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("products").select("id,stock_quantity,is_available,name").order("stock_quantity", { ascending: true }),
      supabaseAdmin
        .from("custom_orders")
        .select("id,request_number,full_name,furniture_type,status,created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("payments")
        .select("id,amount,updated_at")
        .eq("status", "completed")
        .gte("updated_at", bounds.prevFrom.toISOString()),
    ]);
    if (orders.error) throw new Error(orders.error.message);

    const orderRows = (orders.data ?? []).map((o) => o as typeof o & OrderExtras).filter((o) => !o.archived_at);
    const productRows = products.data ?? [];
    const customRows = custom.data ?? [];
    const paidRows = payments.data ?? [];

    const inCurrent = (iso: string) => inRange(iso, bounds.from, bounds.to);
    const inPrevious = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= bounds.prevFrom.getTime() && t < bounds.prevTo.getTime();
    };

    const closed = ["cancelled", "refunded"];
    const ordersNow = orderRows.filter((o) => inCurrent(o.created_at) && !closed.includes(o.status)).length;
    const ordersPrev = orderRows.filter((o) => inPrevious(o.created_at) && !closed.includes(o.status)).length;
    const salesNow = paidRows.filter((p) => inCurrent(p.updated_at)).reduce((s, p) => s + Number(p.amount), 0);
    const salesPrev = paidRows.filter((p) => inPrevious(p.updated_at)).reduce((s, p) => s + Number(p.amount), 0);

    const open = orderRows.filter((o) => !closed.includes(o.status));
    const owing = open.filter((o) => Number(o.amount_due) > 0 && Number(o.total_amount) > 0);
    const outstanding = owing.reduce((s, o) => s + Number(o.amount_due), 0);

    const series = new Map(bounds.keys.map((k) => [k, 0]));
    for (const p of paidRows) {
      if (!inCurrent(p.updated_at)) continue;
      const key = bounds.bucket === "month" ? darMonthKey(p.updated_at) : darDayKey(p.updated_at);
      if (series.has(key)) series.set(key, (series.get(key) ?? 0) + Number(p.amount));
    }

    const awaitingAdvance = open
      .filter(
        (o) =>
          ["pending", "awaiting_payment", "confirmed", "processing"].includes(o.status) &&
          Number(o.advance_required) > 0 &&
          Math.round(Number(o.amount_paid)) < Math.round(Number(o.advance_required)),
      )
      .slice(0, 6);
    const feeToConfirm = open
      .filter(
        (o) => !["delivered", "completed"].includes(o.status) && o.fulfilment_method === "delivery" && o.delivery_fee_status === "pending",
      )
      .slice(0, 6);
    const customAwaiting = customRows.filter((c) => CUSTOM_NEEDS_QUOTE.includes(c.status));
    const customAccepted = customRows.filter((c) => c.status === "accepted");
    const ops = await dashboardOperations(supabaseAdmin, bounds, productRows);

    return {
      ...ops,
      range: data.range,
      bucket: bounds.bucket,
      kpis: {
        orders: ordersNow,
        ordersTrend: trendPercent(ordersNow, ordersPrev),
        sales: salesNow,
        salesTrend: trendPercent(salesNow, salesPrev),
        outstanding,
        outstandingOrders: owing.length,
      },
      series: bounds.keys.map((key) => ({ key, sales: series.get(key) ?? 0 })),
      recentOrders: orderRows.slice(0, 6).map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        status: o.status,
        payment_status: o.payment_status,
        payment_kind: o.payment_kind,
        total_amount: Number(o.total_amount),
        created_at: o.created_at,
      })),
      awaitingAdvance: awaitingAdvance.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        advance_left: Math.max(0, Math.round(Number(o.advance_required)) - Math.round(Number(o.amount_paid))),
      })),
      feeToConfirm: feeToConfirm.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        delivery_location: o.delivery_location,
      })),
      customAwaiting: customAwaiting.slice(0, 6).map((c) => ({
        id: c.id,
        request_number: c.request_number,
        full_name: c.full_name,
        furniture_type: c.furniture_type,
        status: c.status,
        created_at: c.created_at,
      })),
      customAwaitingCount: customAwaiting.length,
      customAccepted: customAccepted.slice(0, 6).map((c) => ({
        id: c.id,
        request_number: c.request_number,
        full_name: c.full_name,
        furniture_type: c.furniture_type,
        created_at: c.created_at,
      })),
      customAcceptedCount: customAccepted.length,
    };
  });

type SupabaseAdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/**
 * Phase 2 parts of the dashboard: net profit for the range, low stock, overdue production and
 * purchase orders. Before migration 0008 these fall back (low stock from product stock) or report
 * `available: false`. Overdue items notify staff at most once a day each.
 */
async function dashboardOperations(
  supabaseAdmin: SupabaseAdminClient,
  bounds: { from: Date; to: Date; prevFrom: Date; prevTo: Date },
  productRows: { id: string; name: string; stock_quantity: number; is_available: boolean }[],
) {
  const { computeProfitAndLoss, optionalRows } = await import("@/lib/ops/reports.server");
  const { darToday, PO_OPEN_STATUSES } = await import("@/lib/ops/business");
  const today = darToday();
  const [pnl, pnlPrev, items, jobs, pos] = await Promise.all([
    computeProfitAndLoss(supabaseAdmin, { from: bounds.from, to: new Date(bounds.to.getTime() + 1) }),
    computeProfitAndLoss(supabaseAdmin, { from: bounds.prevFrom, to: bounds.prevTo }),
    supabaseAdmin.from("inventory_items").select("id,name,unit,quantity,reorder_level").is("archived_at", null).gt("reorder_level", 0),
    supabaseAdmin
      .from("production_jobs")
      .select("id,job_number,description,target_date,status")
      .neq("status", "completed")
      .lt("target_date", today)
      .order("target_date", { ascending: true }),
    supabaseAdmin
      .from("purchase_orders")
      .select("id,po_number,expected_date,status,suppliers(name)")
      .in("status", [...PO_OPEN_STATUSES])
      .lt("expected_date", today)
      .order("expected_date", { ascending: true }),
  ]);

  const itemRows = optionalRows(items);
  const lowStock =
    itemRows === null
      ? productRows
          .filter((p) => p.is_available && p.stock_quantity <= 3)
          .map((p) => ({ id: p.id, name: p.name, label: p.stock_quantity <= 0 ? "Out" : `${p.stock_quantity} left`, out: p.stock_quantity <= 0 }))
      : itemRows
          .filter((i) => Number(i.quantity) <= Number(i.reorder_level))
          .sort((a, b) => Number(a.quantity) - Number(b.quantity))
          .map((i) => ({
            id: i.id,
            name: i.name,
            label: Number(i.quantity) <= 0 ? "Out" : `${Number(i.quantity)} ${i.unit} left`,
            out: Number(i.quantity) <= 0,
          }));

  const jobRows = optionalRows(jobs) ?? [];
  const poRows = (optionalRows(pos) ?? []).map((p) => ({
    id: p.id,
    po_number: p.po_number,
    expected_date: p.expected_date,
    status: p.status,
    supplier: (p.suppliers as { name: string } | null)?.name ?? null,
  }));

  if (jobRows.length || poRows.length) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: sent } = await supabaseAdmin
      .from("notifications")
      .select("entity_id")
      .eq("audience", "staff")
      .in("type", ["job_overdue", "po_overdue"])
      .gte("created_at", since);
    const done = new Set((sent ?? []).map((n) => n.entity_id));
    const { notifyAll } = await import("@/lib/notify.server");
    await notifyAll([
      ...jobRows
        .filter((j) => !done.has(j.id))
        .slice(0, 10)
        .map((j) => ({
          audience: "staff" as const,
          type: "job_overdue",
          title: `Production overdue: ${j.job_number}`,
          body: `${j.description} was due ${j.target_date}.`,
          link: "/admin/production",
          entity: "production_job",
          entityId: j.id,
        })),
      ...poRows
        .filter((p) => !done.has(p.id))
        .slice(0, 10)
        .map((p) => ({
          audience: "staff" as const,
          type: "po_overdue",
          title: `Purchase order overdue: ${p.po_number}`,
          body: `${p.supplier ?? "Supplier"} goods were expected ${p.expected_date}.`,
          link: "/admin/purchases",
          entity: "purchase_order",
          entityId: p.id,
        })),
    ]);
  }

  return {
    netProfit: {
      available: pnl.available,
      value: pnl.netProfit,
      trend: pnl.available && pnlPrev.available ? trendPercent(pnl.netProfit, pnlPrev.netProfit) : null,
      incomplete: pnl.gaps.length > 0,
    },
    lowStockSource: itemRows === null ? ("products" as const) : ("inventory" as const),
    lowStockItems: lowStock.slice(0, 6),
    lowStockCount: lowStock.length,
    overdueJobs: { available: optionalRows(jobs) !== null, count: jobRows.length, rows: jobRows.slice(0, 6) },
    overduePos: { available: optionalRows(pos) !== null, count: poRows.length, rows: poRows.slice(0, 6) },
  };
}

export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("*, categories(slug,name), product_images(id,image_url,image_key,alt_text,sort_order)")
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "product_images", ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAdminCategories = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("categories").select("id,name,slug").order("sort_order");
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
  /** Public URL of a video already uploaded for this product. */
  video_url: z.string().trim().max(800).optional().or(z.literal("")),
  clear_video: z.boolean().optional(),
  /** Existing photo URLs to copy onto a new product. The files are duplicated so later edits do not affect the original. */
  keep_image_urls: z
    .array(z.object({ slot: z.number().int().min(0).max(1), url: z.string().trim().min(1).max(800) }))
    .max(2)
    .optional(),
  /** Existing video URL to copy onto a new product. */
  clone_video_url: z.string().trim().max(800).optional().or(z.literal("")),
  /** Catalogue fields added by migration 0007. Ignored until it has run. */
  extended: z
    .object({
      sku: z.string().trim().max(60).optional().or(z.literal("")),
      status: z.enum(["active", "draft", "archived"]),
      source_type: z.enum(["in_house", "partner"]),
      is_customisable: z.boolean(),
      finish: z.string().trim().max(300).optional().or(z.literal("")),
      finish_sw: z.string().trim().max(300).optional().or(z.literal("")),
      care_info: z.string().trim().max(2000).optional().or(z.literal("")),
      care_info_sw: z.string().trim().max(2000).optional().or(z.literal("")),
      compare_at_price: z.number().min(0).max(1_000_000_000).nullable(),
      discount_percent: z.number().int().min(1).max(90).nullable(),
      free_delivery: z.boolean(),
      stock_display: z.enum(["label", "count"]),
    })
    .optional(),
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

async function availableSlug(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  base: string,
) {
  const root = base.slice(0, 70) || `item-${Date.now()}`;
  for (let n = 1; n < 40; n++) {
    const slug = (n === 1 ? root : `${root}-${n}`).slice(0, 80);
    const { data } = await supabaseAdmin.from("products").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
  }
  return `${root.slice(0, 60)}-${Date.now()}`.slice(0, 80);
}

/** Copy a catalogue file so the new product does not share the original's storage object. */
async function cloneProductFile(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  url: string,
) {
  const path = storagePathFromPublicUrl(url);
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from("product-images").download(path);
  if (error || !data) return null;
  const ext = path.includes(".") ? path.split(".").pop() || "bin" : "bin";
  const nextPath = `${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await data.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from("product-images")
    .upload(nextPath, bytes, { contentType: data.type || "application/octet-stream", upsert: false });
  if (upErr) return null;
  const { data: pub } = supabaseAdmin.storage.from("product-images").getPublicUrl(nextPath);
  return pub.publicUrl;
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
    if ((row.sort_order ?? 0) < 3) continue;
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

async function syncProductVideo(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  productId: string,
  videoUrl: string | undefined,
  clear: boolean | undefined,
) {
  const { data: existing, error: listErr } = await supabaseAdmin
    .from("product_images")
    .select("id,image_url")
    .eq("product_id", productId)
    .eq("sort_order", 2)
    .maybeSingle();
  if (listErr) throw new Error(listErr.message);

  const nextUrl = videoUrl?.trim() || "";
  if (!nextUrl && !clear) return;

  if (existing && (!nextUrl || nextUrl !== existing.image_url)) {
    const path = storagePathFromPublicUrl(existing.image_url);
    if (path) await supabaseAdmin.storage.from("product-images").remove([path]);
  }

  if (!nextUrl) {
    if (!existing) return;
    const { error } = await supabaseAdmin.from("product_images").delete().eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  if (!nextUrl.includes("/product-images/")) throw new Error("Video upload did not finish");

  if (existing) {
    const { error } = await supabaseAdmin
      .from("product_images")
      .update({ image_url: nextUrl, image_key: null, alt_text: "Video", sort_order: 2 })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabaseAdmin.from("product_images").insert({
    product_id: productId,
    image_url: nextUrl,
    alt_text: "Video",
    sort_order: 2,
  });
  if (error) throw new Error(error.message);
}

export const signProductVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ ext: z.enum(["mp4", "webm"]) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${crypto.randomUUID()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage.from("product-images").createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare video upload");
    const { data: pub } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);
    return { path, token: signed.token, publicUrl: pub.publicUrl };
  });

export const upsertAdminProduct = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => ProductInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: previous } = data.id
      ? await supabaseAdmin.from("products").select("price,stock_quantity").eq("id", data.id).maybeSingle()
      : { data: null };

    const requestedSlug = data.slug?.trim() || slugify(data.name);
    const payload = {
      category_id: data.category_id,
      name: data.name,
      name_sw: data.name_sw || null,
      slug: data.id ? requestedSlug : await availableSlug(supabaseAdmin, requestedSlug),
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
    const ext = data.extended;
    const extended = ext
      ? {
          sku: ext.sku?.trim() || null,
          status: ext.status,
          source_type: ext.source_type,
          is_customisable: ext.is_customisable,
          finish: ext.finish || null,
          finish_sw: ext.finish_sw || null,
          care_info: ext.care_info || null,
          care_info_sw: ext.care_info_sw || null,
          compare_at_price: ext.compare_at_price && ext.compare_at_price > data.price ? ext.compare_at_price : null,
          discount_percent: ext.discount_percent,
          free_delivery: ext.free_delivery,
          stock_display: ext.stock_display,
        }
      : {};

    async function write(withExtended: boolean) {
      const body = withExtended ? { ...payload, ...extended } : payload;
      if (data.id) {
        return supabaseAdmin.from("products").update(body).eq("id", data.id).select("id,slug").single();
      }
      return supabaseAdmin.from("products").insert(body).select("id,slug").single();
    }

    let result = await write(Boolean(ext));
    let extendedSaved = Boolean(ext);
    if (result.error && ext && isMissingSchema(result.error)) {
      result = await write(false);
      extendedSaved = false;
    }
    if (result.error?.code === "23505" && /sku/i.test(result.error.message)) {
      throw new Error("Another product already uses this SKU");
    }
    if (result.error?.code === "23505" && /slug/i.test(result.error.message)) {
      throw new Error("Another product already uses this web address. Change the slug and save again.");
    }
    if (result.error || !result.data) throw new Error(result.error?.message ?? (data.id ? "Update failed" : "Create failed"));
    const productId = result.data.id;
    const slug = result.data.slug;

    if (!data.id && data.keep_image_urls?.length) {
      const replaced = new Set((data.angle_uploads ?? []).map((item) => item.slot));
      for (const item of data.keep_image_urls) {
        if (replaced.has(item.slot)) continue;
        const url = await cloneProductFile(supabaseAdmin, item.url);
        if (!url) continue;
        const { error } = await supabaseAdmin.from("product_images").insert({
          product_id: productId,
          image_url: url,
          alt_text: ANGLE_LABELS[item.slot as 0 | 1],
          sort_order: item.slot,
        });
        if (error) throw new Error(error.message);
      }
      const primary = data.keep_image_urls.find((item) => item.slot === 0 && !replaced.has(0));
      if (primary) {
        const { data: copied } = await supabaseAdmin
          .from("product_images")
          .select("image_url")
          .eq("product_id", productId)
          .eq("sort_order", 0)
          .maybeSingle();
        if (copied?.image_url) {
          await supabaseAdmin.from("products").update({ image_url: copied.image_url }).eq("id", productId);
        }
      }
    }

    let videoUrl = data.video_url;
    if (!data.id && data.clone_video_url?.trim()) {
      videoUrl = (await cloneProductFile(supabaseAdmin, data.clone_video_url)) ?? "";
    }

    if (previous && Number(previous.price) !== data.price) {
      await writeAudit(supabaseAdmin, {
        actor: context.userId,
        action: "price_change",
        entity: "product",
        entityId: productId,
        before: { price: Number(previous.price) },
        after: { price: data.price },
      });
    }

    await syncProductAngles(supabaseAdmin, productId, data.angle_uploads, data.clear_angle_slots);
    await syncProductVideo(supabaseAdmin, productId, videoUrl, data.clear_video);

    return { id: productId, slug, extendedSaved, notice: ext && !extendedSaved ? migrationNeeded("0007_storefront_prd_gaps.sql") : null };
  });

/** Draft, publish or archive a product instead of deleting it (needs migration 0007). */
export const setAdminProductStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["active", "draft", "archived"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("products")
      .update({
        status: data.status,
        ...(data.status === "active" ? {} : { is_featured: false }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) {
      if (isMissingSchema(error)) throw new Error(migrationNeeded("0007_storefront_prd_gaps.sql"));
      throw new Error(error.message);
    }
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: `product_${data.status === "archived" ? "archive" : "status"}`,
      entity: "product",
      entityId: data.id,
      after: { status: data.status },
    });
    return { ok: true };
  });

export const deleteAdminProduct = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: snapshot } = await supabaseAdmin.from("products").select("name,slug,price,stock_quantity").eq("id", data.id).maybeSingle();
    await writeAudit(supabaseAdmin, { actor: context.userId, action: "product_delete", entity: "product", entityId: data.id, before: snapshot });
    const { data: imgs } = await supabaseAdmin
      .from("product_images")
      .select("image_url")
      .eq("product_id", data.id);
    const paths = (imgs ?? [])
      .map((row) => storagePathFromPublicUrl(row.image_url))
      .filter((p): p is string => Boolean(p));
    if (paths.length) await supabaseAdmin.storage.from("product-images").remove(paths);

    const { data: product } = await supabaseAdmin.from("products").select("image_url").eq("id", data.id).maybeSingle();
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
    z.object({ id: z.string().uuid(), stock_quantity: z.number().int().min(0), is_available: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updated_at = new Date().toISOString();
    const { data: product } = await supabaseAdmin.from("products").select("stock_quantity").eq("id", data.id).maybeSingle();
    const before = product?.stock_quantity ?? null;

    // When a finished-goods inventory item tracks this product, stock changes go through it.
    const { finishedItemFor, recordMovement } = await import("@/lib/ops/inventory.server");
    const item = await finishedItemFor(supabaseAdmin, data.id);
    if (item) {
      const diff = data.stock_quantity - Math.floor(Number(item.quantity));
      if (diff) {
        await recordMovement(supabaseAdmin, {
          itemId: item.id,
          type: "adjustment",
          quantityChange: diff,
          refEntity: "product",
          refId: data.id,
          note: "Edited on products page",
          actor: await actorLabel(supabaseAdmin, context.userId),
        });
      }
      if (typeof data.is_available === "boolean") {
        const { error } = await supabaseAdmin.from("products").update({ is_available: data.is_available, updated_at }).eq("id", data.id);
        if (error) throw new Error(error.message);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("products")
        .update(
          typeof data.is_available === "boolean"
            ? { stock_quantity: data.stock_quantity, is_available: data.is_available, updated_at }
            : { stock_quantity: data.stock_quantity, updated_at },
        )
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    if (before !== data.stock_quantity) {
      await writeAudit(supabaseAdmin, {
        actor: context.userId,
        action: "stock_adjustment",
        entity: "product",
        entityId: data.id,
        before: { stock_quantity: before },
        after: { stock_quantity: data.stock_quantity, via: item ? "inventory_movement" : "direct" },
      });
    }
    return { ok: true };
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reconcileOpenPalmPayments } = await import("@/lib/order-payments.server");
    await reconcileOpenPalmPayments(supabaseAdmin);
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*), payments(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((order) => ({
      ...order,
      payments: [...(order.payments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }));
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(ORDER_STATUSES), note: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: loaded, error: loadErr } = await supabaseAdmin.from("orders").select("*").eq("id", data.id).single();
    if (loadErr || !loaded) throw new Error(loadErr?.message ?? "Order not found");
    const order = loaded as typeof loaded & OrderExtras;
    const blockers = statusBlockers(
      {
        total_amount: Number(order.total_amount),
        amount_paid: Number(order.amount_paid),
        advance_required: Number(order.advance_required),
        specs_agreed_at: order.specs_agreed_at,
        fulfilment_method: order.fulfilment_method,
        delivery_fee_status: order.delivery_fee_status,
      },
      data.status,
    );
    if (blockers.length) throw new Error(blockers.join(" "));

    if (order.status === data.status) return { ok: true };
    const note = data.note || `Status changed to ${orderStatusLabel(data.status)}.`;
    await writeOrderStatus(supabaseAdmin, data.id, data.status, { status_reason: note });
    const actor = await actorLabel(supabaseAdmin, context.userId);
    await noteOrderHistory(supabaseAdmin, { orderId: data.id, status: data.status, note, actor, statusChanged: true });
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "order_status_override",
      entity: "order",
      entityId: data.id,
      before: { status: order.status },
      after: { status: data.status, note },
    });
    const { notify } = await import("@/lib/notify.server");
    await notify({
      audience: "customer",
      userId: order.user_id,
      type: "order_status",
      title: `Order ${order.order_number}: ${orderStatusLabel(data.status)}`,
      body: data.note ?? null,
      link: `/account/orders/${order.order_number}`,
      entity: "order",
      entityId: order.id,
    });
    const { sendStageEmail } = await import("@/lib/mailjet.server");
    await sendStageEmail({
      email: order.email,
      name: order.customer_name,
      orderNumber: order.order_number,
      fromStatus: order.status,
      toStatus: data.status,
      note: data.note ?? null,
      trackingToken: order.tracking_token,
    });
    return { ok: true };
  });

/**
 * Confirm the delivery fee for an order. The order total becomes subtotal + fee, and the
 * paid / balance figures are recalculated from the recorded payments.
 */
export const setOrderDeliveryFee = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), fee: z.number().min(0).max(50_000_000), free: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshOrderPayments } = await import("@/lib/order-payments.server");
    const { data: loaded, error: loadErr } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(quantity,unit_price)")
      .eq("id", data.id)
      .single();
    if (loadErr || !loaded) throw new Error(loadErr?.message ?? "Order not found");
    const order = loaded as typeof loaded & OrderExtras;
    if (order.delivery_fee_status === undefined) throw new Error(migrationNeeded("0007_storefront_prd_gaps.sql"));
    if (order.status === "cancelled") throw new Error("This order is cancelled");

    const itemsTotal = (order.order_items ?? []).reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);
    const subtotal = order.subtotal_amount != null ? Number(order.subtotal_amount) : itemsTotal;
    const fee = data.free ? 0 : Math.round(data.fee);
    const feeStatus = data.free ? "free" : "confirmed";
    const total = orderTotal(subtotal, fee);
    const paid = Number(order.amount_paid);
    if (Math.round(paid) > total) {
      throw new Error(`More than ${total.toLocaleString("en-US")} TSh has already been paid; check the fee`);
    }

    // The advance stays as agreed on the goods; the delivery fee is added to the balance.
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        subtotal_amount: subtotal,
        delivery_fee: fee,
        delivery_fee_status: feeStatus,
        total_amount: total,
        amount_due: Math.max(0, total - Math.round(paid)),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const feeText = feeStatus === "free" ? "free delivery" : `${fee.toLocaleString("en-US")} TSh`;
    await refreshOrderPayments(
      supabaseAdmin,
      data.id,
      `Delivery fee confirmed: ${feeText}. Order total is now ${total.toLocaleString("en-US")} TSh.`,
    );
    const { notify } = await import("@/lib/notify.server");
    await notify({
      audience: "customer",
      userId: order.user_id,
      type: "delivery_fee",
      title: `Delivery fee confirmed for ${order.order_number}`,
      body: `Delivery: ${feeText}. New total: ${total.toLocaleString("en-US")} TSh.`,
      link: `/account/orders/${order.order_number}`,
      entity: "order",
      entityId: order.id,
    });
    return { ok: true, total, fee, delivery_fee_status: feeStatus };
  });

/** Hide an order from the default list, or bring it back (needs migration 0007). */
export const setOrderArchived = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("orders")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("id", data.id)
      .select("status")
      .single();
    if (error) {
      if (isMissingSchema(error)) throw new Error(migrationNeeded("0007_storefront_prd_gaps.sql"));
      throw new Error(error.message);
    }
    await noteOrderHistory(supabaseAdmin, {
      orderId: data.id,
      status: row.status,
      note: data.archived ? "Archived by admin." : "Restored from the archive.",
      actor: await actorLabel(supabaseAdmin, context.userId),
      statusChanged: false,
    });
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: data.archived ? "order_archive" : "order_restore",
      entity: "order",
      entityId: data.id,
    });
    return { ok: true };
  });

/** Confirm a payment the customer submitted. Only this adds the money. */
export const confirmSubmittedPayment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { completePayment } = await import("@/lib/order-payments.server");
    await completePayment(supabaseAdmin, data.paymentId, { provider: "Confirmed by GK furnish" });
    return { ok: true };
  });

/** Record a cash, bank or mobile money payment taken outside the website. It gets a receipt number. */
export const recordAdminPayment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        amount: z.number().positive().max(50_000_000),
        method: z.enum(["Cash", "Bank transfer", "Mobile money", "Other"]),
        note: z.string().trim().max(300).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { completePayment } = await import("@/lib/order-payments.server");
    const { assertCashAmount, isRepeatAdminPayment } = await import("@/lib/palmpesa");
    const { data: order, error: loadErr } = await supabaseAdmin
      .from("orders")
      .select("id,total_amount,amount_paid,advance_required")
      .eq("id", data.id)
      .single();
    if (loadErr || !order) throw new Error(loadErr?.message ?? "Order not found");

    const total = Number(order.total_amount);
    const paid = Number(order.amount_paid);
    const left = Math.max(0, Math.round(total) - Math.round(paid));
    const cashProblem = assertCashAmount(data.amount, left);
    if (cashProblem) throw new Error(cashProblem.replace("remaining balance", `balance of ${left.toLocaleString("en-US")} TZS`));
    const since = new Date(Date.now() - 120_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("payments")
      .select("amount,provider,created_at,status")
      .eq("order_id", data.id)
      .eq("status", "completed")
      .gte("created_at", since);
    if (
      isRepeatAdminPayment(
        (recent ?? []).map((row) => ({
          amount: Number(row.amount),
          method: row.provider ?? "",
          createdAtMs: new Date(row.created_at).getTime(),
        })),
        { amount: data.amount, method: data.method, nowMs: Date.now() },
      )
    ) {
      throw new Error("That payment was just recorded. Refresh the order before recording it again.");
    }
    const purpose =
      paid <= 0 && Math.round(data.amount) >= Math.round(total)
        ? "full"
        : paid >= Number(order.advance_required)
          ? "balance"
          : "advance";

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: data.id,
        payment_kind: purpose === "full" ? "full" : "advance",
        purpose,
        amount: data.amount,
        status: "pending",
        metadata: { source: "admin", method: data.method, note: data.note || null, recorded_by: context.userId },
      })
      .select("id")
      .single();
    if (error || !payment) throw new Error(error?.message ?? "Could not record payment");
    await completePayment(supabaseAdmin, payment.id, {
      amount: data.amount,
      provider: data.method,
      metadata: { source: "admin", method: data.method, note: data.note || null, recorded_by: context.userId },
    });
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "payment_record",
      entity: "payment",
      entityId: payment.id,
      after: { order_id: data.id, amount: data.amount, method: data.method, purpose },
    });

    const { data: updated } = await supabaseAdmin
      .from("orders")
      .select("payment_status,payment_kind,amount_paid,amount_due,status")
      .eq("id", data.id)
      .single();
    return { ok: true, ...updated };
  });

/** Remove a payment the admin recorded by mistake. Snippe payments cannot be removed. */
export const removeAdminPayment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshOrderPayments } = await import("@/lib/order-payments.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id,order_id,amount,receipt_number,snippe_reference,status,purpose,provider,metadata")
      .eq("id", data.paymentId)
      .single();
    if (!payment) throw new Error("Payment not found");
    const paymentMeta =
      payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
        ? (payment.metadata as Record<string, unknown>)
        : {};
    if (payment.snippe_reference || payment.provider === "PalmPesa" || paymentMeta["source"] === "palmpesa" || String(payment.provider ?? "").startsWith("PalmPesa")) {
      throw new Error("Online payments cannot be removed");
    }
    const { count: refunded } = await supabaseAdmin
      .from("refunds")
      .select("id", { count: "exact", head: true })
      .eq("payment_id", payment.id);
    if (refunded) throw new Error("This payment has refunds recorded against it and cannot be removed");
    const { error } = await supabaseAdmin.from("payments").delete().eq("id", payment.id);
    if (error) throw new Error(error.message);
    await writeAudit(supabaseAdmin, {
      actor: context.userId,
      action: "payment_remove",
      entity: "payment",
      entityId: payment.id,
      before: payment,
    });
    await refreshOrderPayments(
      supabaseAdmin,
      payment.order_id,
      `Payment ${payment.receipt_number ?? ""} of ${Math.round(Number(payment.amount)).toLocaleString("en-US")} TSh removed by admin.`,
    );
    return { ok: true };
  });

/** Confirm (or undo) that the customer and GK furnish agreed the design and specifications. */
export const setOrderSpecsAgreed = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), agreed: z.boolean(), by: z.string().trim().max(120).optional().or(z.literal("")) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .update({
        specs_agreed_at: data.agreed ? new Date().toISOString() : null,
        specs_agreed_by: data.agreed ? data.by || "Admin" : null,
      })
      .eq("id", data.id)
      .select("status,specs_agreed_at,specs_agreed_by")
      .single();
    if (error || !order) throw new Error(error?.message ?? "Order not found");
    await supabaseAdmin.from("order_status_history").insert({
      order_id: data.id,
      status: order.status,
      note: data.agreed
        ? `Design and specifications agreed${data.by ? ` with ${data.by}` : ""}.`
        : "Specification sign-off removed.",
    });
    return order;
  });

/** Log a design or specification change that was agreed with the customer. */
export const recordOrderChange = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        change: z.string().trim().min(3).max(1000),
        agreedBy: z.string().trim().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin.from("orders").select("status").eq("id", data.id).single();
    if (!order) throw new Error("Order not found");
    const { error } = await supabaseAdmin.from("order_status_history").insert({
      order_id: data.id,
      status: order.status,
      note: `Agreed change (with ${data.agreedBy}): ${data.change}`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Change the advance percentage for one order. */
export const setOrderAdvancePercent = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid(), percent: z.number().int().min(0).max(100), reason: z.string().trim().min(3).max(300) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { refreshOrderPayments } = await import("@/lib/order-payments.server");
    const { data: loaded } = await supabaseAdmin.from("orders").select("*").eq("id", data.id).single();
    if (!loaded) throw new Error("Order not found");
    const order = loaded as typeof loaded & OrderExtras;
    const goods = order.subtotal_amount != null ? Number(order.subtotal_amount) : Number(order.total_amount);
    const required = advanceAmount(goods, data.percent);
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ advance_percent: data.percent, advance_required: required })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await refreshOrderPayments(
      supabaseAdmin,
      data.id,
      `Advance changed from ${order.advance_percent}% to ${data.percent}% (${required.toLocaleString("en-US")} TSh). Reason: ${data.reason}`,
    );
    return { ok: true, advance_percent: data.percent, advance_required: required };
  });

export const deleteAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("orders")
      .select("order_number,customer_name,status,total_amount,amount_paid")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(supabaseAdmin, { actor: context.userId, action: "order_delete", entity: "order", entityId: data.id, before });
    return { ok: true };
  });

const AdminOrderInput = z.object({
  customer_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(20).regex(/^[+\d\s()-]+$/),
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
  fulfilment_method: z.enum(["delivery", "collection"]).default("delivery"),
  /** Empty while the delivery fee is still to be confirmed. */
  delivery_fee: z.number().min(0).max(50_000_000).nullable().optional(),
});

/** Create an order from the admin portal. Reference number is generated by the database. */
export const createAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => AdminOrderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id,name,price,stock_quantity")
      .eq("id", data.product_id)
      .single();
    if (pErr || !product) throw new Error("Product not found");

    const lineTotal = Number(product.price) * data.quantity;
    const amountPaid = Math.min(lineTotal, data.amount_paid ?? (data.payment_status === "paid" ? lineTotal : 0));
    const { data: settingsRow } = await supabaseAdmin.from("site_settings").select("*").eq("id", 1).maybeSingle();
    const { percent } = advanceTierFor({ total: lineTotal, itemCount: data.quantity }, advanceSettingsFrom(settingsRow));
    const advanceRequired = advanceAmount(lineTotal, percent);
    const blockers = statusBlockers(
      { total_amount: lineTotal, amount_paid: amountPaid, advance_required: advanceRequired, specs_agreed_at: "admin" },
      data.status,
    );
    if (blockers.length) throw new Error(blockers.join(" "));

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
        payment_kind: "none",
        payment_status: "unpaid",
        amount_due: lineTotal,
        amount_paid: 0,
        total_amount: lineTotal,
        advance_percent: percent,
        advance_required: advanceRequired,
        specs_agreed_at: new Date().toISOString(),
        specs_agreed_by: "Agreed in person",
        stock_applied: true,
        payment_phone: data.phone.replace(/\D/g, ""),
      })
      .select("id,order_number")
      .single();
    if (error && statusRejected(error)) {
      throw new Error(`“${orderStatusLabel(data.status)}” needs the 0008 database update. ${migrationNeeded("0008_business_operations.sql")}`);
    }
    if (error || !order) throw new Error(error?.message ?? "Could not create order");
    const actor = await actorLabel(supabaseAdmin, context.userId);
    await noteOrderHistory(supabaseAdmin, { orderId: order.id, status: data.status, note: "Created by admin", actor, statusChanged: true });

    const collection = data.fulfilment_method === "collection";
    const fee = collection ? 0 : data.delivery_fee ?? null;
    const withFee = orderTotal(lineTotal, fee);
    const { error: extErr } = await supabaseAdmin
      .from("orders")
      .update({
        fulfilment_method: data.fulfilment_method,
        subtotal_amount: lineTotal,
        delivery_fee: fee,
        delivery_fee_status: collection ? "free" : fee == null ? "pending" : "confirmed",
        total_amount: withFee,
        amount_due: withFee,
      })
      .eq("id", order.id);
    if (extErr && !isMissingSchema(extErr)) throw new Error(extErr.message);

    const { error: iErr } = await supabaseAdmin.from("order_items").insert({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      quantity: data.quantity,
      unit_price: product.price,
      size: data.preferred_size,
      color: data.preferred_color,
    });
    if (iErr) throw new Error(iErr.message);

    if (amountPaid > 0) {
      const { completePayment } = await import("@/lib/order-payments.server");
      const purpose = amountPaid >= lineTotal ? "full" : "advance";
      const { data: payment } = await supabaseAdmin
        .from("payments")
        .insert({
          order_id: order.id,
          payment_kind: purpose,
          purpose,
          amount: amountPaid,
          status: "pending",
          metadata: { source: "admin", method: "Recorded at order" },
        })
        .select("id")
        .single();
      if (payment) await completePayment(supabaseAdmin, payment.id, { amount: amountPaid, provider: "Recorded at order" });
      const { data: now } = await supabaseAdmin.from("orders").select("status").eq("id", order.id).single();
      if (now && now.status !== data.status) {
        await writeOrderStatus(supabaseAdmin, order.id, data.status, { status_reason: "Created by admin" });
        await noteOrderHistory(supabaseAdmin, { orderId: order.id, status: data.status, note: "Status set when the order was created.", actor, statusChanged: true });
      }
    }

    const { deductStockForSale } = await import("@/lib/order-payments.server");
    await deductStockForSale(supabaseAdmin, { productId: product.id, quantity: data.quantity, orderId: order.id, orderNumber: order.order_number });

    const { data: tracked } = await supabaseAdmin.from("orders").select("tracking_token").eq("id", order.id).maybeSingle();
    const { sendCustomerEmail, orderTrackingLink } = await import("@/lib/mailjet.server");
    await sendCustomerEmail({
      email: data.email,
      name: data.customer_name,
      subject: `Order ${order.order_number} received`,
      paragraphs: [
        `Your order ${order.order_number} is placed with GK furnish.`,
        `Amount due now: ${Math.max(0, withFee - amountPaid).toLocaleString("en-US")} TZS.`,
      ],
      link: orderTrackingLink(tracked?.tracking_token),
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
    const { listQuotesFor } = await import("@/lib/quotations.server");
    const quotesById = await listQuotesFor(supabaseAdmin, rows);
    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const { design, finish } = unpackReferenceImages(row.reference_image_url);
        async function sign(path: string | null) {
          if (!path) return null;
          const { data: signed } = await supabaseAdmin.storage
            .from("custom-order-references")
            .createSignedUrl(path, 60 * 60);
          return signed?.signedUrl ?? null;
        }
        const [signed_url, finish_signed_url] = await Promise.all([sign(design), sign(finish)]);
        return { ...row, signed_url, finish_signed_url, quotes: quotesById.get(row.id) ?? [] };
      }),
    );
    return withUrls;
  });

const QuoteLineInput = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(100),
  unitPrice: z.number().min(0).max(50_000_000),
});

export const saveCustomOrderQuote = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        notes: z.string().trim().max(2000).optional().or(z.literal("")),
        valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
        advance_percent: z.number().int().min(10).max(100).optional(),
        lines: z.array(QuoteLineInput).min(1).max(12),
        inclusions: z.string().trim().max(2000).optional().or(z.literal("")),
        exclusions: z.string().trim().max(2000).optional().or(z.literal("")),
        estimated_completion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SavedQuote> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("custom_orders").select("*").eq("id", data.id).single();
    if (error || !row) throw new Error(error?.message ?? "Custom order not found");

    const lines: QuoteLine[] = data.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }));
    const total = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    if (total <= 0) throw new Error("Enter a price for the quote");

    const { data: settingsRow } = await supabaseAdmin.from("site_settings").select("*").eq("id", 1).maybeSingle();
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const tier = advanceTierFor({ total, itemCount, isCustom: true }, advanceSettingsFrom(settingsRow));
    const advancePercent = data.advance_percent ?? row.advance_percent ?? tier.percent;

    const { saveQuoteVersion } = await import("@/lib/quotations.server");
    const { quote } = await saveQuoteVersion(supabaseAdmin, row, {
      validUntil: data.valid_until || quoteDateAfter(QUOTE_VALID_DAYS),
      notes: withQuoteAdvanceNote(data.notes ?? "", advancePercent),
      lines,
      advancePercent,
      inclusions: data.inclusions || undefined,
      exclusions: data.exclusions || undefined,
      estimatedCompletion: data.estimated_completion || null,
      createdBy: context.userId,
      customerName: row.full_name,
      phone: row.phone,
      email: row.email ?? "",
      location: row.delivery_location,
      furnitureType: row.furniture_type,
      quantity: row.quantity,
      description: row.design_description,
      dimensions: row.preferred_dimensions ?? "",
      material: formatPreference(row.preferred_material),
      color: formatPreference(row.preferred_color),
      requirements: row.additional_requirements ?? "",
    });

    const { error: saveErr } = await supabaseAdmin
      .from("custom_orders")
      .update({
        advance_percent: advancePercent,
        status: ["pending", "changes_requested", "rejected"].includes(row.status) ? "quoted" : row.status,
      })
      .eq("id", row.id);
    if (saveErr) throw new Error(saveErr.message);

    const { notify } = await import("@/lib/notify.server");
    await notify({
      audience: "customer",
      userId: row.user_id ?? null,
      type: "quote_sent",
      title: `Your quote ${quote.number} is ready`,
      body: `Total ${Math.round(total).toLocaleString("en-US")} TSh. Advance ${advancePercent}% to start production.`,
      link: "/account",
      entity: "custom_order",
      entityId: row.id,
    });
    return quote;
  });

export const updateCustomOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(CUSTOM_STATUSES),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("custom_orders").update({ status: data.status }).eq("id", data.id);
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

export const deleteContactMessage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contact_messages").delete().eq("id", data.id);
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
