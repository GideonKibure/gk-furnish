import { createFileRoute } from "@tanstack/react-router";

/** Backup check for PalmPesa. The callback is the fast path; this catches a missed callback. */
export const Route = createFileRoute("/api/cron/palmpesa")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"]?.trim();
        const auth = request.headers.get("authorization") ?? "";
        if (secret && auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
        if (process.env["PAYMENT_MODE"] !== "palmpesa") return Response.json({ ok: true, disabled: true });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { reconcileOpenPalmPayments } = await import("@/lib/order-payments.server");
          await reconcileOpenPalmPayments(supabaseAdmin, { limit: 20 });
          return Response.json({ ok: true });
        } catch (err) {
          console.error("[palmpesa cron]", err instanceof Error ? err.message : "error");
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
