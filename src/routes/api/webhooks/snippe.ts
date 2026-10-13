import { createFileRoute } from "@tanstack/react-router";
import { applySnippePaymentEvent } from "@/lib/payments.functions";

export const Route = createFileRoute("/api/webhooks/snippe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SNIPPE_WEBHOOK_SECRET"]?.trim();
        if (!secret) {
          return new Response("Webhook not configured", { status: 503 });
        }

        const rawBody = Buffer.from(await request.arrayBuffer());
        const signature =
          request.headers.get("X-Webhook-Signature") ?? request.headers.get("x-webhook-signature");
        const timestamp =
          request.headers.get("X-Webhook-Timestamp") ?? request.headers.get("x-webhook-timestamp");

        try {
          const { verifyWebhook, SnippeWebhookVerificationError } = await import("@snippe/sdk");
          const event = verifyWebhook({
            rawBody,
            signature,
            timestamp,
            signingKey: secret,
          }) as {
            type: string;
            data: {
              reference?: string;
              status?: string;
              amount?: { value?: number; currency?: string };
              channel?: { provider?: string };
              metadata?: { order_id?: string; order_number?: string };
            };
          };

          await applySnippePaymentEvent(event);
          return Response.json({ ok: true });
        } catch (err) {
          const { SnippeWebhookVerificationError } = await import("@snippe/sdk");
          if (err instanceof SnippeWebhookVerificationError) {
            return new Response("Invalid signature", { status: 400 });
          }
          console.error("[snippe webhook]", err);
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
