import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";

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
});

export const updateAdminSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => SettingsInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("site_settings")
      .upsert({
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
      })
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
