import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/integrations/supabase/admin-auth";

/** Registered customers with their sign-in email and order totals. Read-only. */
export const listAdminCustomers = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profiles, orders, admins] = await Promise.all([
      supabaseAdmin.from("customer_profiles").select("*").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("orders")
        .select("user_id,total_amount,amount_paid,status,created_at")
        .not("user_id", "is", null),
      supabaseAdmin.from("admin_users").select("user_id"),
    ]);
    if (profiles.error) throw new Error(profiles.error.message);

    const emails = new Map<string, { email: string | null; last_sign_in_at: string | null }>();
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      for (const u of data.users) emails.set(u.id, { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null });
      if (data.users.length < 1000) break;
    }

    const adminIds = new Set((admins.data ?? []).map((a) => a.user_id));
    const stats = new Map<string, { orders: number; spent: number; last: string | null }>();
    for (const o of orders.data ?? []) {
      if (!o.user_id || o.status === "cancelled") continue;
      const s = stats.get(o.user_id) ?? { orders: 0, spent: 0, last: null };
      s.orders += 1;
      s.spent += Number(o.amount_paid);
      if (!s.last || o.created_at > s.last) s.last = o.created_at;
      stats.set(o.user_id, s);
    }

    return (profiles.data ?? [])
      .filter((p) => !adminIds.has(p.user_id))
      .map((p) => {
        const s = stats.get(p.user_id);
        const auth = emails.get(p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          phone: p.phone,
          default_location: p.default_location,
          created_at: p.created_at,
          email: auth?.email ?? null,
          last_sign_in_at: auth?.last_sign_in_at ?? null,
          order_count: s?.orders ?? 0,
          total_paid: s?.spent ?? 0,
          last_order_at: s?.last ?? null,
        };
      });
  });

/** Every payment with its order, newest first. Read-only register. */
export const listAdminPayments = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select(
        "id,order_id,amount,status,purpose,payment_kind,provider,receipt_number,snippe_reference,phone,metadata,created_at,updated_at, orders(order_number,customer_name,phone,email,total_amount,order_items(product_name,quantity,unit_price,material,size,color))",
      )
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => {
      const meta = p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata) ? (p.metadata as Record<string, unknown>) : {};
      return {
        ...p,
        amount: Number(p.amount),
        source: meta["source"] === "admin" ? ("Recorded by admin" as const) : p.snippe_reference ? ("Online (Snippe)" as const) : ("Other" as const),
        method: p.provider ?? (typeof meta["method"] === "string" ? meta["method"] : p.snippe_reference ? "Mobile money" : null),
      };
    });
  });
