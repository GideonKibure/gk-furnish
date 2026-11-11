import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAdminUserId } from "@/integrations/supabase/admin-auth";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { balanceDue } from "@/lib/payment-policy";

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ isAdmin: await isAdminUserId(context.userId) }));

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("customer_profiles")
      .select("full_name,phone,default_location")
      .eq("user_id", context.userId)
      .maybeSingle();
    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : "";
    const meta = context.claims["user_metadata"];
    const saved = meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
    const savedName = typeof saved["full_name"] === "string" ? saved["full_name"] : typeof saved["name"] === "string" ? saved["name"] : "";
    const savedPhone = typeof saved["phone"] === "string" ? saved["phone"] : "";
    return {
      email,
      full_name: data?.full_name?.trim() || savedName.trim(),
      phone: data?.phone?.trim() || savedPhone.trim(),
      default_location: data?.default_location ?? "",
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        full_name: z.string().trim().max(120),
        phone: z.string().trim().max(20).regex(/^[+\d\s()-]*$/),
        default_location: z.string().trim().max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("customer_profiles").upsert({
      user_id: context.userId,
      full_name: data.full_name || null,
      phone: data.phone || null,
      default_location: data.default_location || null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** `*` keeps working before and after migration 0007 adds the delivery columns. */
const ORDER_FIELDS = "*,order_items(product_name,quantity,unit_price,material,size,color)";

function shape<
  T extends {
    total_amount: number;
    amount_paid: number;
    advance_required: number;
    subtotal_amount?: number | null;
    delivery_fee?: number | null;
    delivery_fee_status?: string | null;
    fulfilment_method?: string | null;
  },
>(row: T) {
  const total = Number(row.total_amount);
  const paid = Number(row.amount_paid);
  return {
    ...row,
    total_amount: total,
    amount_paid: paid,
    advance_required: Number(row.advance_required),
    subtotal_amount: Number(row.subtotal_amount ?? row.total_amount),
    delivery_fee: row.delivery_fee == null ? null : Number(row.delivery_fee),
    delivery_fee_status: row.delivery_fee_status ?? "confirmed",
    fulfilment_method: row.fulfilment_method ?? "delivery",
    balance: balanceDue(total, paid),
  };
}

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select(ORDER_FIELDS)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).filter((row) => !row.archived_at).map(shape);
  });

export type MyNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/** In-app notifications for the signed-in customer. `available` is false before migration 0007. */
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ available: boolean; unread: number; items: MyNotification[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isMissingSchema } = await import("@/lib/db-compat");
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("id,type,title,body,link,read_at,created_at")
      .eq("audience", "customer")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (isMissingSchema(error)) return { available: false, unread: 0, items: [] };
      throw new Error(error.message);
    }
    const items = data ?? [];
    return { available: true, unread: items.filter((n) => !n.read_at).length, items };
  });

export const markMyNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("audience", "customer")
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (data.ids?.length) query = query.in("id", data.ids);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ number: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        `${ORDER_FIELDS},payments(id,amount,status,purpose,provider,receipt_number,metadata,created_at,updated_at),order_status_history(status,note,created_at)`,
      )
      .eq("order_number", data.number)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return null;
    const { reconcileOpenPalmPayments } = await import("@/lib/order-payments.server");
    await reconcileOpenPalmPayments(supabaseAdmin, { orderId: order.id });
    const { data: fresh } = await supabaseAdmin
      .from("orders")
      .select(
        `${ORDER_FIELDS},payments(id,amount,status,purpose,provider,receipt_number,metadata,created_at,updated_at),order_status_history(status,note,created_at)`,
      )
      .eq("id", order.id)
      .maybeSingle();
    const current = fresh ?? order;
    return {
      ...shape(current),
      payments: (current.payments ?? [])
        .map((p) => {
          const meta = p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata) ? (p.metadata as Record<string, unknown>) : {};
          const reference =
            p.receipt_number ||
            (typeof meta["provider_reference"] === "string" ? meta["provider_reference"] : "") ||
            (typeof meta["provider_order_id"] === "string" ? meta["provider_order_id"] : "") ||
            null;
          return {
            id: p.id,
            amount: Number(p.amount),
            status: p.status,
            purpose: p.purpose,
            provider: p.provider,
            receipt_number: p.receipt_number,
            method: p.provider || (typeof meta["method"] === "string" ? meta["method"] : null),
            reference,
            created_at: p.created_at,
            updated_at: p.updated_at,
          };
        })
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      order_status_history: (current.order_status_history ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    };
  });
