import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/palmpesa")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = Buffer.from(await request.arrayBuffer()).toString("utf8");
        try {
          const { handlePalmCallback } = await import("@/lib/palmpesa-apply.server");
          return await handlePalmCallback(rawBody, request.headers);
        } catch (err) {
          console.error("[palmpesa webhook]", err instanceof Error ? err.message : "error");
          return Response.json({ received: false }, { status: 500 });
        }
      },
    },
  },
});
