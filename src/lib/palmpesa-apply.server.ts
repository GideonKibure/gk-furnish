import { isMissingSchema } from "@/lib/db-compat";
import { decideCallback, parsePalmCallback, verifyPalmSignature, type LocalPayment } from "@/lib/palmpesa";
import { callbackFromRemote, fetchPalmPayment, readPalmMeta } from "@/lib/palmpesa.server";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const PAYMENT_FIELDS = "id,order_id,amount,currency,status,metadata,transaction_id,provider_order_id";

async function findPayment(supabaseAdmin: SupabaseAdmin, transactionId: string) {
  const byColumn = await supabaseAdmin.from("payments").select(PAYMENT_FIELDS).eq("transaction_id", transactionId).maybeSingle();
  if (!byColumn.error && byColumn.data) return byColumn.data;
  if (byColumn.error && !isMissingSchema(byColumn.error)) {
    console.error("[palmpesa] payment lookup", byColumn.error.message);
  }
  const byMeta = await supabaseAdmin
    .from("payments")
    .select("id,order_id,amount,currency,status,metadata")
    .contains("metadata", { transaction_id: transactionId })
    .maybeSingle();
  return byMeta.data ?? null;
}

async function claimEvent(supabaseAdmin: SupabaseAdmin, eventId: string, paymentId: string | null, eventType: string, payload: unknown) {
  const inserted = await supabaseAdmin
    .from("payment_events")
    .insert({ event_id: eventId, payment_id: paymentId, event_type: eventType, payload: JSON.parse(JSON.stringify(payload)) })
    .select("id")
    .maybeSingle();
  if (!inserted.error) return "new" as const;
  if (isMissingSchema(inserted.error)) return "untracked" as const;
  if (inserted.error.code !== "23505") {
    console.error("[palmpesa] event save", inserted.error.message);
    throw new Error("event");
  }
  const existing = await supabaseAdmin.from("payment_events").select("processed_at").eq("event_id", eventId).maybeSingle();
  if (existing.data?.processed_at) return "done" as const;
  return "retry" as const;
}

async function finishEvent(supabaseAdmin: SupabaseAdmin, eventId: string) {
  const updated = await supabaseAdmin
    .from("payment_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (updated.error && !isMissingSchema(updated.error)) console.error("[palmpesa] event finish", updated.error.message);
}

/** Validate one PalmPesa callback and update the payment. Returns an HTTP response. */
export async function handlePalmCallback(rawBody: string, headers: Headers) {
  const secret = process.env["PALMPESA_SIGNING_SECRET"]?.trim();
  if (secret) {
    const timestamp = headers.get("x-palmpesa-timestamp") ?? "";
    const signature = headers.get("x-palmpesa-signature") ?? "";
    const ok = await verifyPalmSignature(rawBody, timestamp, signature, secret);
    if (!ok) return Response.json({ received: false }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return Response.json({ received: false }, { status: 400 });
  }
  const event = parsePalmCallback(parsed);
  if (!event) return Response.json({ received: false }, { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { completePayment, failPayment } = await import("@/lib/order-payments.server");

  const row = await findPayment(supabaseAdmin, event.transaction_id);
  let claim: "new" | "done" | "retry" | "untracked" = "untracked";
  try {
    claim = await claimEvent(supabaseAdmin, event.event_id, row?.id ?? null, event.event, event);
  } catch {
    return Response.json({ received: false }, { status: 500 });
  }
  if (claim === "done") return Response.json({ received: true, duplicate: true });

  const meta = readPalmMeta(row?.metadata);
  const local: LocalPayment | null = row
    ? {
        amount: Number(row.amount),
        currency: row.currency || "TZS",
        status: row.status as LocalPayment["status"],
        transactionId: meta.transactionId || ("transaction_id" in row && typeof row.transaction_id === "string" ? row.transaction_id : ""),
        providerOrderId: meta.providerOrderId || ("provider_order_id" in row && typeof row.provider_order_id === "string" ? row.provider_order_id : null),
      }
    : null;

  let verified: string | null = null;
  const orderId = event.order_id;
  if (local && orderId) {
    try {
      const remote = await fetchPalmPayment(orderId);
      if (!remote) return Response.json({ received: false }, { status: 500 });
      const confirmed = callbackFromRemote(remote, event);
      if (
        confirmed.transaction_id !== event.transaction_id ||
        confirmed.amount !== event.amount ||
        confirmed.currency !== event.currency
      ) {
        await finishEvent(supabaseAdmin, event.event_id);
        return Response.json({ received: true, ignored: true });
      }
      verified = remote.status;
    } catch {
      return Response.json({ received: false }, { status: 500 });
    }
  }

  const decision = decideCallback({ alreadyProcessed: false, payment: local, event, verifiedStatus: verified });
  if (decision.action === "complete" && row) {
    await completePayment(supabaseAdmin, row.id, {
      amount: event.amount,
      provider: event.channel ? `PalmPesa ${event.channel}` : "PalmPesa",
      metadata: {
        ...metaRecordSafe(row.metadata),
        source: "palmpesa",
        transaction_id: event.transaction_id,
        provider_order_id: event.order_id,
        provider_reference: event.selcom_reference,
        channel: event.channel,
        method: "Mobile money",
      },
    });
  } else if (decision.action === "fail" && row) {
    await failPayment(supabaseAdmin, row.id, decision.status, {
      ...metaRecordSafe(row.metadata),
      source: "palmpesa",
      failure_reason: decision.reason,
      channel: event.channel,
    });
    await supabaseAdmin
      .from("payments")
      .update({ failure_reason: decision.reason })
      .eq("id", row.id)
      .then(({ error }) => {
        if (error && !isMissingSchema(error)) console.error("[palmpesa] failure reason", error.message);
      });
  }

  await finishEvent(supabaseAdmin, event.event_id);
  return Response.json({ received: true });
}

function metaRecordSafe(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...(metadata as Record<string, unknown>) } : {};
}
