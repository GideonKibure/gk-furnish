import { createFileRoute } from "@tanstack/react-router";

/** Hourly reminders and unpaid auto-cancel. Safe to call twice. `?dryRun=1` changes nothing. */
export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"]?.trim();
        if (!secret) return new Response("Server configuration error", { status: 500 });
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
        const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { runReminders } = await import("@/lib/reminders.server");
          const result = await runReminders(supabaseAdmin, { dryRun });
          const { markHeartbeat } = await import("@/lib/heartbeat.server");
          await markHeartbeat("reminders");
          return Response.json(result);
        } catch (err) {
          console.error("[reminders cron]", err instanceof Error ? err.message : "error");
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
