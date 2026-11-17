import { createFileRoute } from "@tanstack/react-router";

/** Backup check for Snippe. The webhook is the fast path; this catches a missed webhook. */
export const Route = createFileRoute("/api/cron/snippe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"]?.trim();
        const auth = request.headers.get("authorization") ?? "";
        if (secret && auth !== `Bearer ${secret}`)
          return new Response("Unauthorized", { status: 401 });
        try {
          const { snippeReconcileEnabled } = await import("@/lib/snippe-decision");
          if (!snippeReconcileEnabled(process.env))
            return Response.json({ ok: true, skipped: true });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { reconcileOpenSnippePayments } = await import("@/lib/order-payments.server");
          await reconcileOpenSnippePayments(supabaseAdmin, {
            limit: 20,
            minAgeMs: 2 * 60 * 1000,
            maxAgeMs: 48 * 60 * 60 * 1000,
          });
          const { markHeartbeat } = await import("@/lib/heartbeat.server");
          await markHeartbeat("snippe_reconcile");
          return Response.json({ ok: true });
        } catch (err) {
          console.error("[snippe cron]", err instanceof Error ? err.message : "error");
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
