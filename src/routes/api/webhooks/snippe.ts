import { createFileRoute } from "@tanstack/react-router";
import { handleSnippeWebhook } from "@/lib/snippe-webhook.server";

export const Route = createFileRoute("/api/webhooks/snippe")({
  server: {
    handlers: {
      POST: async ({ request }) => handleSnippeWebhook(request),
    },
  },
});
