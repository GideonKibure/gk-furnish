import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { isMissingSchema } from "@/lib/db-compat";

/** True unless the owner has explicitly turned the strong-password rule off. */
export const getOwnerPasswordPolicy = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("site_settings").select("owner_strong_password").eq("id", 1).maybeSingle();
  if (error && isMissingSchema(error)) return { strong: true, ready: false };
  if (error) throw new Error(error.message);
  return { strong: data?.owner_strong_password !== false, ready: true };
});

export const setOwnerPasswordPolicy = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((data) => z.object({ strong: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").update({ owner_strong_password: data.strong }).eq("id", 1);
    if (error && isMissingSchema(error)) throw new Error("Run drizzle/migrations/0029_hardening.sql in the Supabase SQL editor.");
    if (error) throw new Error(error.message);
    return { strong: data.strong };
  });
