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
    return {
      email,
      full_name: data?.full_name ?? "",
      phone: data?.phone ?? "",
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

const ORDER_FIELDS =
  "id,order_number,status,created_at,needed_by,delivery_location,total_amount,amount_paid,advance_percent,advance_required,specs_agreed_at,payment_status,order_items(product_name,quantity,unit_price,material,size,color)";

function shape<T extends { total_amount: number; amount_paid: number; advance_required: number }>(row: T) {
  const total = Number(row.total_amount);
  const paid = Number(row.amount_paid);
  return { ...row, total_amount: total, amount_paid: paid, advance_required: Number(row.advance_required), balance: balanceDue(total, paid) };
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
    return (data ?? []).map(shape);
  });

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ number: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        `${ORDER_FIELDS},customer_name,phone,email,notes,payments(id,amount,status,purpose,provider,receipt_number,created_at,updated_at),order_status_history(status,note,created_at)`,
      )
      .eq("order_number", data.number)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return null;
    return {
      ...shape(order),
      payments: (order.payments ?? [])
        .map((p) => ({ ...p, amount: Number(p.amount) }))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      order_status_history: (order.order_status_history ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    };
  });
