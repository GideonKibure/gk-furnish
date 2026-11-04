import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { isMissingSchema } from "@/lib/db-compat";
import {
  BUILTIN_PREFIX,
  DEFAULT_GALLERY,
  GALLERY_GROUPS,
  GALLERY_SLOT,
  parseGallery,
  REMOVED_IMAGE,
  serializeGallery,
  SITE_IMAGE_FOLDER,
  SITE_IMAGES_PAGE,
  siteImageStoragePath,
  type GalleryItem,
} from "@/lib/site-images";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export const getAdminSiteSettings = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const SettingsInput = z.object({
  phone_display: z.string().trim().max(40).optional().or(z.literal("")),
  phone_dial: z.string().trim().max(40).optional().or(z.literal("")),
  whatsapp_number: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().max(200).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  tagline: z.string().trim().max(300).optional().or(z.literal("")),
  instagram_url: z.string().trim().max(500).optional().or(z.literal("")),
  facebook_url: z.string().trim().max(500).optional().or(z.literal("")),
  tiktok_url: z.string().trim().max(500).optional().or(z.literal("")),
  /** Where customers collect orders (migration 0007). */
  collection_address: z.string().trim().max(300).optional(),
});

export const updateAdminSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => SettingsInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = {
      id: 1,
      phone_display: data.phone_display || null,
      phone_dial: data.phone_dial || null,
      whatsapp_number: data.whatsapp_number || null,
      email: data.email || null,
      location: data.location || null,
      tagline: data.tagline || null,
      instagram_url: data.instagram_url || null,
      facebook_url: data.facebook_url || null,
      tiktok_url: data.tiktok_url || null,
      updated_at: new Date().toISOString(),
    };
    const write = (body: typeof base & { collection_address?: string | null }) =>
      supabaseAdmin.from("site_settings").upsert(body).select("*").single();
    let result =
      data.collection_address === undefined ? await write(base) : await write({ ...base, collection_address: data.collection_address || null });
    if (result.error && isMissingSchema(result.error)) result = await write(base);
    if (result.error || !result.data) throw new Error(result.error?.message ?? "Save failed");
    return result.data;
  });

export const updateAdvanceTiers = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        advance_standard_percent: z.number().int().min(10).max(100),
        advance_custom_percent: z.number().int().min(10).max(100),
        advance_large_percent: z.number().int().min(10).max(100),
        advance_expensive_from: z.number().min(0).max(1_000_000_000),
        advance_large_from: z.number().min(0).max(1_000_000_000),
        advance_large_items: z.number().int().min(1).max(10_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ id: 1, ...data, updated_at: new Date().toISOString() })
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Save failed");
    return row;
  });

export const listAdminPageSections = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("page_sections")
      .select("*")
      .order("page_key")
      .order("section_key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertAdminPageSection = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        page_key: z.string().trim().min(1).max(60),
        section_key: z.string().trim().min(1).max(60),
        content_en: z.string().max(8000),
        content_sw: z.string().max(8000).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      page_key: data.page_key,
      section_key: data.section_key,
      content_en: data.content_en,
      content_sw: data.content_sw || "",
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("page_sections")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Update failed");
      return row;
    }
    const { data: row, error } = await supabaseAdmin
      .from("page_sections")
      .upsert(payload, { onConflict: "page_key,section_key" })
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Save failed");
    return row;
  });

const SiteImageFile = z.object({
  name: z.string().max(200),
  type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1).max(7_000_000),
});

async function uploadSiteFile(supabaseAdmin: SupabaseAdmin, file: z.infer<typeof SiteImageFile>) {
  const ext = file.type.split("/")[1];
  const path = `${SITE_IMAGE_FOLDER}/${crypto.randomUUID()}.${ext}`;
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const { error } = await supabaseAdmin.storage
    .from("product-images")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return supabaseAdmin.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

async function removeSiteFiles(supabaseAdmin: SupabaseAdmin, urls: (string | null | undefined)[]) {
  const paths = urls.map(siteImageStoragePath).filter((p): p is string => Boolean(p));
  if (paths.length) await supabaseAdmin.storage.from("product-images").remove(paths);
}

async function readSiteImageRow(supabaseAdmin: SupabaseAdmin, slot: string) {
  const { data, error } = await supabaseAdmin
    .from("page_sections")
    .select("content_en")
    .eq("page_key", SITE_IMAGES_PAGE)
    .eq("section_key", slot)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.content_en?.trim() || null;
}

async function writeSiteImageRow(supabaseAdmin: SupabaseAdmin, slot: string, value: string) {
  const { error } = await supabaseAdmin.from("page_sections").upsert(
    {
      page_key: SITE_IMAGES_PAGE,
      section_key: slot,
      content_en: value,
      content_sw: "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "page_key,section_key" },
  );
  if (error) throw new Error(error.message);
}

export const setAdminSiteImage = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        slot: z
          .string()
          .regex(/^[a-z0-9][a-z0-9._-]{0,79}$/)
          .refine((s) => s !== GALLERY_SLOT, "Use the gallery editor for gallery photos"),
        action: z.enum(["upload", "remove", "reset"]),
        file: SiteImageFile.optional(),
      })
      .refine((d) => d.action !== "upload" || d.file, { message: "Choose an image to upload", path: ["file"] })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const previous = await readSiteImageRow(supabaseAdmin, data.slot);

    if (data.action === "reset") {
      const { error } = await supabaseAdmin
        .from("page_sections")
        .delete()
        .eq("page_key", SITE_IMAGES_PAGE)
        .eq("section_key", data.slot);
      if (error) throw new Error(error.message);
      await removeSiteFiles(supabaseAdmin, [previous]);
      return { slot: data.slot, value: null };
    }

    const value = data.action === "upload" && data.file ? await uploadSiteFile(supabaseAdmin, data.file) : REMOVED_IMAGE;
    await writeSiteImageRow(supabaseAdmin, data.slot, value);
    if (previous && previous !== value) await removeSiteFiles(supabaseAdmin, [previous]);
    return { slot: data.slot, value };
  });

const GalleryItemInput = z.object({
  id: z.string().trim().min(1).max(80),
  src: z.string().trim().max(800).optional().or(z.literal("")),
  group: z.enum(GALLERY_GROUPS),
  caption: z.string().trim().max(200),
  caption_sw: z.string().trim().max(200).optional().or(z.literal("")),
  file: SiteImageFile.optional(),
});

export const saveAdminGallery = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        reset: z.boolean().optional(),
        items: z.array(GalleryItemInput).max(60),
      })
      .refine((d) => d.items.filter((i) => i.file).length <= 1, "Upload one photo at a time")
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const previous = parseGallery(await readSiteImageRow(supabaseAdmin, GALLERY_SLOT)) ?? DEFAULT_GALLERY;

    if (data.reset) {
      const { error } = await supabaseAdmin
        .from("page_sections")
        .delete()
        .eq("page_key", SITE_IMAGES_PAGE)
        .eq("section_key", GALLERY_SLOT);
      if (error) throw new Error(error.message);
      await removeSiteFiles(supabaseAdmin, previous.map((i) => i.src));
      return DEFAULT_GALLERY;
    }

    const next: GalleryItem[] = [];
    for (const item of data.items) {
      const src = item.file ? await uploadSiteFile(supabaseAdmin, item.file) : item.src?.trim() || "";
      if (!src.startsWith(BUILTIN_PREFIX) && !siteImageStoragePath(src)) {
        throw new Error("Each gallery photo needs an uploaded image");
      }
      next.push({ id: item.id, src, group: item.group, caption: item.caption, caption_sw: item.caption_sw || "" });
    }

    await writeSiteImageRow(supabaseAdmin, GALLERY_SLOT, serializeGallery(next));
    const kept = new Set(next.map((i) => i.src));
    await removeSiteFiles(
      supabaseAdmin,
      previous.map((i) => i.src).filter((src) => !kept.has(src)),
    );
    return next;
  });

export const listAdminOfferPopups = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("offer_popups")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const PopupInput = z.object({
  id: z.string().uuid().optional(),
  message_en: z.string().trim().min(1).max(500),
  message_sw: z.string().trim().max(500).optional().or(z.literal("")),
  delay_seconds: z.number().int().min(0).max(600),
  duration_seconds: z.number().int().min(1).max(600),
  is_active: z.boolean(),
});

export const upsertAdminOfferPopup = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => PopupInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.is_active) {
      await supabaseAdmin.from("offer_popups").update({ is_active: false }).neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const payload = {
      message_en: data.message_en,
      message_sw: data.message_sw || null,
      delay_seconds: data.delay_seconds,
      duration_seconds: data.duration_seconds,
      is_active: data.is_active,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("offer_popups")
        .update(payload)
        .eq("id", data.id)
        .select("*")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Update failed");
      return row;
    }
    const { data: row, error } = await supabaseAdmin.from("offer_popups").insert(payload).select("*").single();
    if (error || !row) throw new Error(error?.message ?? "Create failed");
    return row;
  });

export const deleteAdminOfferPopup = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("offer_popups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
