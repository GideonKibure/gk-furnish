import { isMissingSchema, migrationNeeded } from "@/lib/db-compat";
import { orderStatusLabel } from "@/lib/ops/status";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** The orders status check before 0008 rejects the newer statuses. */
export function statusRejected(error: { code?: string | null; message?: string | null }) {
  return error.code === "23514" || /orders_status_check/i.test(error.message ?? "");
}

/** Update an order's status (plus reasons once 0008 exists). The trigger writes the history row. */
export async function writeOrderStatus(
  supabaseAdmin: SupabaseAdmin,
  orderId: string,
  status: string,
  extra: { status_reason?: string | null; cancel_reason?: string | null } = {},
) {
  let { error } = await supabaseAdmin
    .from("orders")
    .update({ status, ...extra })
    .eq("id", orderId);
  if (error && isMissingSchema(error)) ({ error } = await supabaseAdmin.from("orders").update({ status }).eq("id", orderId));
  if (error && statusRejected(error)) {
    throw new Error(`“${orderStatusLabel(status)}” needs the 0008 database update. ${migrationNeeded("0008_business_operations.sql")}`);
  }
  if (error) throw new Error(error.message);
}

/**
 * The orders trigger writes one history row per status change (with no note). Attach the note
 * and actor to that row instead of inserting a second one. When the status did not change,
 * or no fresh trigger row is found, a plain note row is inserted.
 */
export async function noteOrderHistory(
  supabaseAdmin: SupabaseAdmin,
  input: { orderId: string; status: string; note: string; actor?: string | null; statusChanged: boolean },
) {
  if (input.statusChanged) {
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: row } = await supabaseAdmin
      .from("order_status_history")
      .select("id")
      .eq("order_id", input.orderId)
      .eq("status", input.status)
      .is("note", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row) {
      let { error } = await supabaseAdmin
        .from("order_status_history")
        .update({ note: input.note, actor: input.actor ?? null })
        .eq("id", row.id);
      if (error && isMissingSchema(error)) {
        ({ error } = await supabaseAdmin.from("order_status_history").update({ note: input.note }).eq("id", row.id));
      }
      if (!error) return;
    }
  }
  let { error } = await supabaseAdmin
    .from("order_status_history")
    .insert({ order_id: input.orderId, status: input.status, note: input.note, actor: input.actor ?? null });
  if (error && isMissingSchema(error)) {
    ({ error } = await supabaseAdmin
      .from("order_status_history")
      .insert({ order_id: input.orderId, status: input.status, note: input.note }));
  }
  if (error) console.warn("order history note failed:", error.message);
}
