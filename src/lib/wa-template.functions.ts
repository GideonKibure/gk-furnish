import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_KEYS,
  templatesFrom,
  type TemplateBook,
} from "@/lib/wa-template";

const bookSchema = z.object(
  Object.fromEntries(
    TEMPLATE_KEYS.map((key) => [
      key,
      z.object({ en: z.string().trim().min(1).max(500), sw: z.string().trim().min(1).max(500) }),
    ]),
  ) as Record<(typeof TEMPLATE_KEYS)[number], z.ZodObject<{ en: z.ZodString; sw: z.ZodString }>>,
);

export const getWhatsappTemplates = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("whatsapp_templates")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      if (isMissingSchema(error)) return { saved: false as const, templates: DEFAULT_TEMPLATES };
      throw new Error(error.message);
    }
    return { saved: true as const, templates: templatesFrom(data?.whatsapp_templates) };
  });

export const saveWhatsappTemplates = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => bookSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .update({ whatsapp_templates: data })
      .eq("id", 1);
    if (error) {
      if (isMissingSchema(error)) throw new Error(migrationNeeded("0031_whatsapp_templates.sql"));
      throw new Error(error.message);
    }
    return { templates: data as TemplateBook };
  });
