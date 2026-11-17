import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
    const { reconcileOpenPalmPayments, reconcileOpenSnippePayments } = await import("@/lib/order-payments.server");
    if (process.env["PAYMENT_MODE"] === "palmpesa") await reconcileOpenPalmPayments(supabaseAdmin);
    await reconcileOpenSnippePayments(supabaseAdmin);
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
      const palm = meta["source"] === "palmpesa" || p.provider === "PalmPesa" || String(p.provider ?? "").startsWith("PalmPesa");
      const reference =
        (typeof meta["provider_reference"] === "string" && meta["provider_reference"]) ||
        (typeof meta["provider_order_id"] === "string" && meta["provider_order_id"]) ||
        (typeof meta["transaction_id"] === "string" && meta["transaction_id"]) ||
        p.snippe_reference ||
        null;
      return {
        ...p,
        amount: Number(p.amount),
        source: meta["source"] === "manual" ? ("Submitted by customer" as const) : meta["source"] === "admin" ? ("Recorded by admin" as const) : palm ? ("Online (PalmPesa)" as const) : p.snippe_reference ? ("Online (Snippe)" as const) : ("Other" as const),
        method: (typeof meta["method"] === "string" ? meta["method"] : null) ?? (palm || p.snippe_reference ? "Mobile money" : p.provider),
        senderName: typeof meta["sender_name"] === "string" ? meta["sender_name"] : null,
        proofUrl: typeof meta["proof_url"] === "string" ? meta["proof_url"] : null,
        reference,
        purposeKind: p.purpose,
      };
    });
  });

/** Remove one payment, or every payment. Order balances are recalculated from what remains. Admin only. */
export const deleteAdminPayments = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z
      .object({
        all: z.boolean().optional(),
        ids: z.array(z.string().uuid()).max(5000).optional(),
      })
      .refine((input) => input.all === true || (input.ids?.length ?? 0) > 0, "Choose a payment")
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isMissingSchema } = await import("@/lib/db-compat");
    const { refreshOrderPayments } = await import("@/lib/order-payments.server");

    let ids = data.ids ?? [];
    if (data.all) {
      const { data: rows, error } = await supabaseAdmin.from("payments").select("id");
      if (error) throw new Error(error.message);
      ids = (rows ?? []).map((row) => row.id);
    }
    if (!ids.length) return { deleted: 0 };

    const orderIds = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data: linked, error } = await supabaseAdmin.from("payments").select("order_id").in("id", chunk);
      if (error) throw new Error(error.message);
      for (const row of linked ?? []) orderIds.add(row.order_id);
      const refunds = await supabaseAdmin.from("refunds").delete().in("payment_id", chunk);
      if (refunds.error && !isMissingSchema(refunds.error)) throw new Error(refunds.error.message);
      const removed = await supabaseAdmin.from("payments").delete().in("id", chunk);
      if (removed.error) {
        if (removed.error.message.includes("payment records are managed")) {
          throw new Error("Run drizzle/migrations/0024_allow_payment_confirmation.sql in the Supabase SQL editor, then delete again.");
        }
        throw new Error(removed.error.message);
      }
    }

    for (const orderId of orderIds) {
      await refreshOrderPayments(supabaseAdmin, orderId, "A payment was removed from the register.", "Admin");
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("status,amount_paid,advance_required")
        .eq("id", orderId)
        .maybeSingle();
      if (order?.status === "confirmed" && Number(order.amount_paid) < Number(order.advance_required)) {
        const reverted = await supabaseAdmin
          .from("orders")
          .update({ status: "pending", status_reason: "Payment removed. The advance is no longer covered." })
          .eq("id", orderId)
          .eq("status", "confirmed");
        if (reverted.error && isMissingSchema(reverted.error)) {
          await supabaseAdmin.from("orders").update({ status: "pending" }).eq("id", orderId).eq("status", "confirmed");
        }
      }
    }
    return { deleted: ids.length };
  });

/** Outstanding customer balances. Cancelled orders are left out. Admin only. */
export const getAdminPaymentSummary = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("orders").select("amount_due,status").neq("status", "cancelled");
    if (error) throw new Error(error.message);
    const open = (data ?? []).filter((row) => Number(row.amount_due) > 0);
    return {
      outstanding: open.reduce((sum, row) => sum + Number(row.amount_due), 0),
      openOrders: open.length,
    };
  });
