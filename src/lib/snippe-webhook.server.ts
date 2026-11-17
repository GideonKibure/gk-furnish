import { isMissingSchema } from "@/lib/db-compat";
import {
  completePayment,
  failPayment,
  getSnippePaymentStatus,
  markPaymentNeedsReview,
} from "@/lib/order-payments.server";
import { snippeWebhookEnabled } from "@/lib/snippe-decision";
import { processSnippeEvent } from "@/lib/snippe-flow";
import { loadSnippeSdk } from "@/lib/snippe-sdk.server";

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function claimSnippeEvent(supabaseAdmin: SupabaseAdmin, eventId: string, eventType: string) {
  const inserted = await supabaseAdmin
    .from("payment_events")
    .insert({ event_id: eventId, event_type: eventType, payload: { source: "snippe" } })
    .select("id")
    .maybeSingle();
  if (!inserted.error) return "new" as const;
  if (isMissingSchema(inserted.error)) return "untracked" as const;
  if (inserted.error.code === "23505") return "duplicate" as const;
  throw new Error("event");
}

async function findSnippePayment(supabaseAdmin: SupabaseAdmin, reference: string) {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("id,amount,currency,status,metadata")
    .eq("snippe_reference", reference)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const meta = data.metadata;
  const needsReview = Boolean(
    meta && typeof meta === "object" && !Array.isArray(meta) && meta["needs_review"] === true,
  );
  return {
    id: data.id,
    amount: Number(data.amount),
    currency: data.currency,
    status: data.status,
    reference,
    needsReview,
  };
}

/** Verify a Snippe webhook and apply it once. Always returns a response. */
export async function handleSnippeWebhook(request: Request): Promise<Response> {
  try {
    if (!snippeWebhookEnabled(process.env)) return Response.json({ ok: true });
    const secret = process.env["SNIPPE_WEBHOOK_SECRET"]?.trim() ?? "";
    const rawBody = Buffer.from(await request.arrayBuffer());
    const signature = request.headers.get("x-webhook-signature");
    const timestamp = request.headers.get("x-webhook-timestamp");
    const { verifyWebhook, SnippeWebhookVerificationError } = loadSnippeSdk();
    let event: ReturnType<typeof verifyWebhook>;
    try {
      event = verifyWebhook({ rawBody, signature, timestamp, signingKey: secret });
    } catch (err) {
      if (err instanceof SnippeWebhookVerificationError)
        return new Response("Invalid signature", { status: 401 });
      console.error("[snippe webhook]", err instanceof Error ? err.message : "verify failed");
      return new Response("Invalid signature", { status: 401 });
    }

    if (!event.type.startsWith("payment.")) return Response.json({ ok: true });
    const reference = typeof event.data.reference === "string" ? event.data.reference : "";
    if (!event.id || !reference) return Response.json({ ok: true });
    const webhookAmount =
      typeof event.data.amount?.value === "number" ? event.data.amount.value : null;
    const webhookCurrency =
      typeof event.data.amount?.currency === "string" ? event.data.amount.currency : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await processSnippeEvent(
      {
        id: event.id,
        type: event.type,
        reference,
        amount: webhookAmount,
        currency: webhookCurrency,
      },
      "webhook",
      {
        claim: (eventId) => claimSnippeEvent(supabaseAdmin, eventId, event.type),
        findByReference: (ref) => findSnippePayment(supabaseAdmin, ref),
        getStatus: getSnippePaymentStatus,
        complete: async (paymentId, via, providerReference) => {
          await completePayment(supabaseAdmin, paymentId, {
            provider: "snippe",
            confirmedVia: via,
            providerReference,
          });
        },
        fail: (paymentId, status) => failPayment(supabaseAdmin, paymentId, status),
        review: (paymentId) =>
          markPaymentNeedsReview(
            supabaseAdmin,
            paymentId,
            "Snippe amount or currency did not match this payment.",
          ),
        logUnknown: (masked) => {
          console.warn("[snippe webhook] unknown reference", masked);
        },
      },
    );
    if (result === "retry") return Response.json({ ok: false }, { status: 500 });
    const { markHeartbeat } = await import("@/lib/heartbeat.server");
    await markHeartbeat("snippe_webhook");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[snippe webhook]", err instanceof Error ? err.message : "error");
    return Response.json({ ok: false }, { status: 500 });
  }
}
