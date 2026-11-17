import { isMissingSchema } from "@/lib/db-compat";

/** Remember when a background job last finished. A missing table is ignored. */
export async function markHeartbeat(name: "snippe_webhook" | "snippe_reconcile" | "reminders") {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("system_heartbeats").upsert({ name, seen_at: new Date().toISOString() });
    if (error && !isMissingSchema(error)) console.warn("heartbeat:", error.message);
  } catch (err) {
    console.warn("heartbeat:", err instanceof Error ? err.message : "error");
  }
}
