import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { isMissingSchema, migrationNeeded, readOptional } from "@/lib/db-compat";
import { categoryImageSlot, SITE_IMAGES_PAGE } from "@/lib/site-images";

const MIGRATION = "0007_storefront_prd_gaps.sql";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

/** Categories with product counts and the uploaded photo (if any) from the site images manager. */
export const listAdminCategoryRows = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [cats, products, images] = await Promise.all([
      supabaseAdmin.from("categories").select("*").order("sort_order").order("name"),
      supabaseAdmin.from("products").select("category_id"),
      supabaseAdmin.from("page_sections").select("section_key,content_en").eq("page_key", SITE_IMAGES_PAGE).like("section_key", "category.%"),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    const counts = new Map<string, number>();
    for (const p of products.data ?? []) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
    const photos = new Map((images.data ?? []).map((r) => [r.section_key, r.content_en.trim()]));
    const rows = cats.data ?? [];
    return {
      activeReady: !rows.length || rows.some((c) => c.is_active !== undefined),
      rows: rows.map((c) => ({
        ...c,
        is_active: c.is_active ?? true,
        product_count: counts.get(c.id) ?? 0,
        photo_url: photos.get(categoryImageSlot(c.slug)) || null,
      })),
    };
  });

const CategoryInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  name_sw: z.string().trim().max(120).optional().or(z.literal("")),
  slug: z.string().trim().max(80).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  description_sw: z.string().trim().max(2000).optional().or(z.literal("")),
  image_key: z.string().trim().max(80).optional().or(z.literal("")),
  sort_order: z.number().int().min(0).max(10_000),
  is_active: z.boolean(),
});

export const upsertAdminCategory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => CategoryInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = slugify(data.slug || data.name) || `category-${Date.now()}`;
    const base = {
      name: data.name,
      name_sw: data.name_sw || null,
      slug,
      description: data.description || null,
      description_sw: data.description_sw || null,
      image_key: data.image_key || null,
      sort_order: data.sort_order,
    };

    let previousSlug: string | null = null;
    if (data.id) {
      const { data: prev } = await supabaseAdmin.from("categories").select("slug").eq("id", data.id).maybeSingle();
      previousSlug = prev?.slug ?? null;
    }

    async function write(withActive: boolean) {
      const body = withActive ? { ...base, is_active: data.is_active } : base;
      return data.id
        ? supabaseAdmin.from("categories").update(body).eq("id", data.id).select("id,slug").single()
        : supabaseAdmin.from("categories").insert(body).select("id,slug").single();
    }
    let result = await write(true);
    let notice: string | null = null;
    if (result.error && isMissingSchema(result.error)) {
      result = await write(false);
      notice = `Active / hidden was not saved. ${migrationNeeded(MIGRATION)}`;
    }
    if (result.error?.code === "23505") throw new Error(`Another category already uses the link name “${slug}”`);
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Could not save the category");

    // Keep an uploaded category photo attached when the link name changes.
    if (previousSlug && previousSlug !== slug) {
      await supabaseAdmin
        .from("page_sections")
        .update({ section_key: categoryImageSlot(slug), updated_at: new Date().toISOString() })
        .eq("page_key", SITE_IMAGES_PAGE)
        .eq("section_key", categoryImageSlot(previousSlug));
    }
    return { id: result.data.id, slug: result.data.slug, notice };
  });

export const deleteAdminCategory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);
    if (count) {
      throw new Error(`${count} product${count === 1 ? " is" : "s are"} in this category. Move them first, or hide the category instead.`);
    }
    const { data: row, error } = await supabaseAdmin.from("categories").delete().eq("id", data.id).select("slug").maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.slug) {
      await supabaseAdmin.from("page_sections").delete().eq("page_key", SITE_IMAGES_PAGE).eq("section_key", categoryImageSlot(row.slug));
    }
    return { ok: true };
  });

/** Product reviews for moderation. `available` is false until migration 0007 creates the table. */
export const listAdminReviews = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("product_reviews")
      .select("*, products(name,slug)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      if (isMissingSchema(error)) return { available: false as const, reason: migrationNeeded(MIGRATION), rows: [] };
      throw new Error(error.message);
    }
    const orderIds = [...new Set((data ?? []).map((r) => r.order_id).filter((id): id is string => Boolean(id)))];
    const { data: orders } = orderIds.length
      ? await supabaseAdmin.from("orders").select("id,order_number").in("id", orderIds)
      : { data: [] as { id: string; order_number: string }[] };
    const numbers = new Map((orders ?? []).map((o) => [o.id, o.order_number]));
    return {
      available: true as const,
      reason: null,
      rows: (data ?? []).map((r) => ({ ...r, order_number: r.order_id ? (numbers.get(r.order_id) ?? null) : null })),
    };
  });

export const setAdminReviewStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["pending", "approved", "rejected"]) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("product_reviews")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("user_id,products(name,slug)")
      .single();
    if (error) throw new Error(error.message);
    if (data.status === "approved" && row.user_id) {
      const product = row.products as { name: string; slug: string } | null;
      const { notify } = await import("@/lib/notify.server");
      await notify({
        audience: "customer",
        userId: row.user_id,
        type: "review_approved",
        title: "Your review is live",
        body: product ? `Thank you for reviewing ${product.name}.` : null,
        link: product ? `/products/${product.slug}` : null,
        entity: "review",
        entityId: data.id,
      });
    }
    return { ok: true };
  });

export const deleteAdminReview = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SERVICES_MIGRATION = "0011_services.sql";
const SERVICE_MEDIA_MIGRATION = "0014_service_price_media.sql";

const ServiceInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  name_sw: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  description_sw: z.string().trim().max(2000).optional().or(z.literal("")),
  sort_order: z.number().int().min(0).max(10_000),
  is_published: z.boolean(),
  price_tzs: z.number().int().min(0).max(1_000_000_000).nullable(),
  media_url: z.string().trim().max(1000).optional().or(z.literal("")),
  media_kind: z.enum(["image", "video"]).nullable(),
  clear_media: z.boolean().optional(),
});

function serviceMediaPath(url: string | null | undefined) {
  if (!url) return null;
  const marker = "/product-images/";
  const at = url.indexOf(marker);
  if (at < 0) return null;
  return url.slice(at + marker.length).split("?")[0] ?? null;
}

/** Signed upload for a service photo or video. Admin only. */
export const signServiceMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ ext: z.enum(["jpg", "png", "webp", "mp4", "webm"]) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `services/${crypto.randomUUID()}.${data.ext}`;
    const { data: signed, error } = await supabaseAdmin.storage.from("product-images").createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the upload");
    const { data: pub } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);
    return { path, token: signed.token, publicUrl: pub.publicUrl };
  });

/** Every service, including hidden ones. */
export const listAdminServices = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return readOptional(SERVICES_MIGRATION, [], () =>
      supabaseAdmin.from("services").select("*").order("sort_order").order("name"),
    );
  });

export const upsertAdminService = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => ServiceInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const previous = data.id
      ? await supabaseAdmin.from("services").select("media_url").eq("id", data.id).maybeSingle()
      : { data: null };
    const mediaUrl = data.clear_media ? null : data.media_url || null;
    const body = {
      name: data.name,
      name_sw: data.name_sw || null,
      description: data.description || null,
      description_sw: data.description_sw || null,
      sort_order: data.sort_order,
      is_published: data.is_published,
      price_tzs: data.price_tzs,
      media_url: mediaUrl,
      media_kind: mediaUrl ? data.media_kind : null,
      updated_at: new Date().toISOString(),
    };
    const result = data.id
      ? await supabaseAdmin.from("services").update(body).eq("id", data.id).select("id").single()
      : await supabaseAdmin.from("services").insert(body).select("id").single();
    if (result.error && isMissingSchema(result.error)) {
      const message = result.error.message ?? "";
      const tableMissing = /relation .*services.* does not exist/i.test(message);
      throw new Error(migrationNeeded(tableMissing ? SERVICES_MIGRATION : SERVICE_MEDIA_MIGRATION));
    }
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Could not save the service");
    const oldPath = serviceMediaPath(previous.data?.media_url);
    const nextPath = serviceMediaPath(mediaUrl);
    if (oldPath && oldPath !== nextPath) await supabaseAdmin.storage.from("product-images").remove([oldPath]);
    return { id: result.data.id };
  });

export const deleteAdminService = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("services").delete().eq("id", data.id);
    if (error && isMissingSchema(error)) throw new Error(migrationNeeded(SERVICES_MIGRATION));
    if (error) throw new Error(error.message);
    return { ok: true };
  });
