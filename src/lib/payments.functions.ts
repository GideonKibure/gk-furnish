/** Apply a Snippe webhook event to the matching payment and its order. */
export async function applySnippePaymentEvent(event: {
  type: string;
  data: {
    reference?: string;
    status?: string;
    amount?: { value?: number; amount?: number; currency?: string };
    channel?: { provider?: string };
    metadata?: Record<string, unknown>;
  };
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { completePayment, failPayment } = await import("@/lib/order-payments.server");
  const ref = event.data.reference;
  const meta = event.data.metadata ?? {};
  const metaPaymentId = typeof meta["payment_id"] === "string" ? meta["payment_id"] : undefined;

  let paymentId: string | null = null;
  if (ref) {
    const { data } = await supabaseAdmin.from("payments").select("id").eq("snippe_reference", ref).maybeSingle();
    paymentId = data?.id ?? null;
  }
  if (!paymentId && metaPaymentId) {
    const { data } = await supabaseAdmin.from("payments").select("id").eq("id", metaPaymentId).maybeSingle();
    paymentId = data?.id ?? null;
    if (paymentId && ref) {
      await supabaseAdmin.from("payments").update({ snippe_reference: ref }).eq("id", paymentId).is("snippe_reference", null);
    }
  }
  if (!paymentId) return;

  const completed = event.type === "payment.completed" || event.data.status === "completed";
  const expired = event.type === "payment.expired" || event.data.status === "expired";
  const failed =
    expired ||
    event.type === "payment.failed" ||
    event.type === "payment.voided" ||
    event.data.status === "failed" ||
    event.data.status === "voided";

  if (completed) {
    await completePayment(supabaseAdmin, paymentId, {
      amount: event.data.amount?.value ?? event.data.amount?.amount,
      provider: event.data.channel?.provider ?? null,
      metadata: event.data,
    });
  } else if (failed) {
    await failPayment(supabaseAdmin, paymentId, expired ? "expired" : "failed", event.data);
  }
}
