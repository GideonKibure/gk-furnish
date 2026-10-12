import { queryOptions } from "@tanstack/react-query";
import { SITE } from "@/config/site";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SiteSettings = Database["public"]["Tables"]["site_settings"]["Row"];
export type PageSection = Database["public"]["Tables"]["page_sections"]["Row"];
export type OfferPopup = Database["public"]["Tables"]["offer_popups"]["Row"];

export function settingsToSite(s: SiteSettings | null | undefined) {
  if (!s) return SITE;
  return {
    name: SITE.name,
    tagline: s.tagline || SITE.tagline,
    phoneDisplay: s.phone_display || SITE.phoneDisplay,
    phoneDial: s.phone_dial || SITE.phoneDial,
    whatsappNumber: s.whatsapp_number || SITE.whatsappNumber,
    email: s.email || SITE.email,
    location: s.location || SITE.location,
    currency: SITE.currency,
    social: {
      instagram: s.instagram_url || SITE.social.instagram,
      facebook: s.facebook_url || SITE.social.facebook,
      tiktok: s.tiktok_url || SITE.social.tiktok,
    },
  } as const;
}

export const siteSettingsQuery = queryOptions({
  queryKey: ["site_settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data;
  },
  staleTime: 60_000,
});

export const pageSectionsQuery = queryOptions({
  queryKey: ["page_sections"],
  queryFn: async () => {
    const { data, error } = await supabase.from("page_sections").select("*");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

export const activeOfferQuery = queryOptions({
  queryKey: ["offer_popups", "active"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("offer_popups")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  staleTime: 30_000,
});

export function sectionMap(sections: PageSection[]) {
  const map = new Map<string, PageSection>();
  for (const s of sections) map.set(`${s.page_key}:${s.section_key}`, s);
  return map;
}

export function sectionText(
  sections: PageSection[],
  page: string,
  key: string,
  lang: "en" | "sw",
  fallback: string,
) {
  const row = sections.find((s) => s.page_key === page && s.section_key === key);
  if (!row) return fallback;
  const text = lang === "sw" ? row.content_sw || row.content_en : row.content_en;
  return text?.trim() || fallback;
}
