import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { isMissingSchema } from "@/lib/db-compat";

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [beats, review, attention] = await Promise.all([
      supabaseAdmin.from("system_heartbeats").select("name,seen_at"),
      supabaseAdmin.from("payments").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("needs_attention", true),
    ]);
    const heartbeats = beats.error && isMissingSchema(beats.error) ? null : (beats.data ?? []);
    return {
      heartbeatsReady: heartbeats !== null,
      snippeWebhook: heartbeats?.find((row) => row.name === "snippe_webhook")?.seen_at ?? null,
      snippeReconcile: heartbeats?.find((row) => row.name === "snippe_reconcile")?.seen_at ?? null,
      reminders: heartbeats?.find((row) => row.name === "reminders")?.seen_at ?? null,
      needsReview: review.count ?? 0,
      needsAttention: attention.error ? 0 : (attention.count ?? 0),
    };
  });
