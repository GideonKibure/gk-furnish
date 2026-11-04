import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMissingSchema } from "@/lib/db-compat";

export type SavedAddress = {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  region: string;
  district: string;
  area: string;
  address_line: string;
  is_default: boolean;
};

const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const AddressInput = z.object({
  id: z.string().uuid().optional(),
  label: opt(40),
  full_name: opt(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[+\d\s()-]*$/)
    .optional()
    .or(z.literal("")),
  region: z.string().trim().min(1).max(80),
  district: opt(80),
  area: opt(120),
  address_line: z.string().trim().min(1).max(200),
  is_default: z.boolean().optional(),
});

/** Saved delivery addresses. `available` is false before migration 0007. */
export const listMyAddresses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ available: boolean; addresses: SavedAddress[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("customer_addresses")
      .select("*")
      .eq("user_id", context.userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      if (isMissingSchema(error)) return { available: false, addresses: [] };
      throw new Error(error.message);
    }
    return {
      available: true,
      addresses: (data ?? []).map((row) => ({
        id: row.id,
        label: row.label ?? "",
        full_name: row.full_name ?? "",
        phone: row.phone ?? "",
        region: row.region,
        district: row.district ?? "",
        area: row.area ?? "",
        address_line: row.address_line ?? "",
        is_default: row.is_default,
      })),
    };
  });

export const saveMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AddressInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const n = (v?: string) => (v ? v : null);
    const { count } = await supabaseAdmin
      .from("customer_addresses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    const makeDefault = Boolean(data.is_default) || !count;
    if (makeDefault) {
      await supabaseAdmin
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("user_id", context.userId);
    }
    const row = {
      user_id: context.userId,
      label: n(data.label),
      full_name: n(data.full_name),
      phone: n(data.phone),
      region: data.region,
      district: n(data.district),
      area: n(data.area),
      address_line: data.address_line,
      is_default: makeDefault,
      updated_at: new Date().toISOString(),
    };
    const result = data.id
      ? await supabaseAdmin
          .from("customer_addresses")
          .update(row)
          .eq("id", data.id)
          .eq("user_id", context.userId)
      : await supabaseAdmin.from("customer_addresses").insert(row);
    if (result.error) {
      if (isMissingSchema(result.error))
        throw new Error("Saved addresses are not switched on yet.");
      throw new Error(result.error.message);
    }
    return { ok: true };
  });

export const deleteMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("customer_addresses")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
