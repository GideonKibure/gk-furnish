import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { isMissingSchema } from "@/lib/db-compat";

/** Strip characters that have meaning inside a PostgREST `or=(…)` filter. */
function searchTerm(raw: string) {
  return raw.replace(/[%,()*\\]/g, " ").trim().slice(0, 60);
}

/** Top-bar search across orders and products. */
export const adminQuickSearch = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ q: z.string().max(80) }).parse(d))
  .handler(async ({ data }) => {
    const q = searchTerm(data.q);
    if (q.length < 2) return { orders: [], products: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const like = `%${q}%`;
    const [orders, products] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id,order_number,customer_name,phone,status,total_amount,created_at")
        .or(`order_number.ilike.${like},customer_name.ilike.${like},phone.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("products")
        .select("id,name,slug,price,stock_quantity")
        .or(`name.ilike.${like},slug.ilike.${like}`)
        .order("name")
        .limit(6),
    ]);
    return { orders: orders.data ?? [], products: products.data ?? [] };
  });

/** Staff notifications for the bell. `available` is false until the notifications table exists. */
export const listStaffNotifications = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("id,type,title,body,link,read_at,created_at")
      .eq("audience", "staff")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      if (isMissingSchema(error)) return { available: false as const, items: [], unread: 0 };
      throw new Error(error.message);
    }
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("audience", "staff")
      .is("read_at", null);
    return { available: true as const, items: data ?? [], unread: count ?? 0 };
  });

export const markStaffNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("audience", "staff")
      .is("read_at", null);
    if (data.ids?.length) query = query.in("id", data.ids);
    const { error } = await query;
    if (error && !isMissingSchema(error)) throw new Error(error.message);
    return { ok: true };
  });
