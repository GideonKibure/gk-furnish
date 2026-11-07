import { SITE } from "@/config/site";
import { isMissingSchema } from "@/lib/db-compat";
import {
  assertPayableAmount,
  metaRecord,
  palmTransactionId,
  phoneMatchesWallet,
  toPalmPhone,
  walletById,
  type PalmCallback,
  type WalletId,
} from "@/lib/palmpesa";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const BASE = "https://palmpesa.co.tz";
const OPTIONAL_COLUMNS = [
  "transaction_id",
  "provider_order_id",
  "provider_reference",
  "channel",
  "failure_reason",
  "payment_method",
  "paid_at",
] as const;

export type PalmRemote = {
  transaction_id: string;
  order_id: string;
  status: string;
  failure_reason: string | null;
  amount: number;
  currency: string;
  reference: string | null;
  channel: string | null;
};

export function palmpesaConfigured() {
  return Boolean(process.env["PALMPESA_API_TOKEN"]?.trim());
}

export function palmCallbackUrl() {
  const explicit = process.env["PALMPESA_CALLBACK_URL"]?.trim();
  if (explicit) return explicit;
  const site = (process.env["SITE_URL"]?.trim() || "https://gkfurnish.co.tz").replace(/\/$/, "");
  return `${site}/api/webhooks/palmpesa`;
}

function token() {
  const value = process.env["PALMPESA_API_TOKEN"]?.trim();
  if (!value) throw new Error("Online payment is not configured");
  return value;
}

function readRemote(json: unknown): PalmRemote | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const data = root["data"];
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d["order_id"] !== "string" || typeof d["transaction_id"] !== "string" || typeof d["status"] !== "string") return null;
  if (typeof d["amount"] !== "number" || typeof d["currency"] !== "string") return null;
  return {
    transaction_id: d["transaction_id"],
    order_id: d["order_id"],
    status: d["status"],
    failure_reason: typeof d["failure_reason"] === "string" ? d["failure_reason"] : null,
    amount: d["amount"],
    currency: d["currency"],
    reference: typeof d["reference"] === "string" ? d["reference"] : null,
    channel: typeof d["channel"] === "string" ? d["channel"] : null,
  };
}

async function palmFetch(path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function customerMessage(status: number) {
  if (status === 401 || status === 403) return "Online payment is not available right now. Please contact us.";
  if (status === 422) return "Check the mobile money number and try again.";
  if (status === 429) return "The payment service is busy. Wait a moment and try again.";
  return "We could not send the payment prompt. Try again in a moment.";
}

async function writeRow(
  supabaseAdmin: SupabaseAdmin,
  mode: "insert" | "update",
  id: string | null,
  row: Record<string, unknown>,
) {
  const run = (payload: Record<string, unknown>) =>
    mode === "insert"
      ? supabaseAdmin.from("payments").insert(payload as never).select("id").single()
      : supabaseAdmin.from("payments").update(payload as never).eq("id", id!).select("id").maybeSingle();
  let result = await run(row);
  if (result.error && isMissingSchema(result.error)) {
    const slim = { ...row };
    for (const key of OPTIONAL_COLUMNS) delete slim[key];
    result = await run(slim);
  }
  if (result.error || !result.data) {
    console.error("[palmpesa] payment save failed", result.error?.message ?? "no row");
    throw new Error("Could not save the payment");
  }
  return result.data;
}

async function markFailed(supabaseAdmin: SupabaseAdmin, paymentId: string, reason: string, metadata: Record<string, unknown>) {
  await writeRow(supabaseAdmin, "update", paymentId, {
    status: "failed",
    failure_reason: reason.slice(0, 300),
    metadata: { ...metadata, failure_reason: reason },
    updated_at: new Date().toISOString(),
  });
}

/** Create a pending payment and ask PalmPesa to prompt the phone. 202 is not success. */
export async function startPalmPayment(
  supabaseAdmin: SupabaseAdmin,
  input: {
    orderId: string;
    orderNumber: string;
    purpose: "advance" | "balance" | "full";
    amount: number;
    balance: number;
    phone: string;
    customerName: string;
    email: string | null;
    wallet: WalletId;
  },
) {
  const phone = toPalmPhone(input.phone);
  const wallet = walletById(input.wallet);
  if (!phone || !wallet) throw new Error("Enter a Tanzanian mobile money number, for example 07XXXXXXXX.");
  if (!phoneMatchesWallet(phone, wallet.id)) {
    throw new Error(`That number is not a ${wallet.label} number. Choose the wallet that matches this phone.`);
  }
  const problem = assertPayableAmount(input.amount, input.balance);
  if (problem) throw new Error(problem);
  const callback = palmCallbackUrl();
  if (!callback.startsWith("https://") || /localhost|127\.0\.0\.1/i.test(callback)) {
    throw new Error("Online payment can only be sent from the live website.");
  }

  const amount = Math.round(input.amount);
  const created = await writeRow(supabaseAdmin, "insert", null, {
    order_id: input.orderId,
    payment_kind: input.purpose === "full" ? "full" : "advance",
    purpose: input.purpose,
    amount,
    currency: "TZS",
    phone,
    provider: "PalmPesa",
    payment_method: "mobile_money",
    status: "pending",
    metadata: { source: "palmpesa", method: wallet.label, wallet: wallet.id },
  });

  const transactionId = palmTransactionId(created.id);
  const metadata: Record<string, unknown> = {
    source: "palmpesa",
    method: wallet.label,
    wallet: wallet.id,
    transaction_id: transactionId,
  };
  await writeRow(supabaseAdmin, "update", created.id, {
    transaction_id: transactionId,
    metadata,
    updated_at: new Date().toISOString(),
  });

  const request = {
    transaction_id: transactionId,
    amount,
    currency: "TZS",
    phone,
    name: (input.customerName.trim() || "Customer").slice(0, 255),
    email: (input.email && input.email.includes("@") ? input.email : SITE.email).slice(0, 255),
    callback_url: callback,
    buyer_remarks: `GK Furnish ${input.orderNumber}`.slice(0, 255),
    merchant_remarks: input.purpose.slice(0, 255),
  };

  let result: { status: number; json: unknown } | null = null;
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      const response = await palmFetch("/api/v2/async/payments", request);
      if (response.status >= 500 && attempt === 0) continue;
      result = response;
    } catch (err) {
      console.error("[palmpesa] request failed", err instanceof Error ? err.message : "network");
      if (attempt === 1) {
        await markFailed(supabaseAdmin, created.id, "NETWORK", metadata);
        throw new Error("We could not reach the payment service. Try again in a moment.");
      }
    }
  }
  if (!result) {
    await markFailed(supabaseAdmin, created.id, "NETWORK", metadata);
    throw new Error("We could not reach the payment service. Try again in a moment.");
  }

  const remote = readRemote(result.json);
  if (result.status === 409) {
    await markFailed(supabaseAdmin, created.id, "DUPLICATE", metadata);
    throw new Error("This payment was already sent. Start a new one.");
  }
  if (result.status !== 202 || !remote) {
    console.error("[palmpesa] initiate status", result.status);
    await markFailed(supabaseAdmin, created.id, `HTTP_${result.status}`, metadata);
    throw new Error(customerMessage(result.status));
  }

  const nextMeta = {
    ...metadata,
    provider_order_id: remote.order_id,
    provider_reference: remote.reference,
    channel: remote.channel,
  };
  await writeRow(supabaseAdmin, "update", created.id, {
    provider_order_id: remote.order_id,
    provider_reference: remote.reference,
    channel: remote.channel,
    metadata: nextMeta,
    updated_at: new Date().toISOString(),
  });

  if (remote.status === "INITIATION_FAILED") {
    await markFailed(supabaseAdmin, created.id, remote.failure_reason || "INITIATION_FAILED", nextMeta);
    throw new Error("The payment prompt could not be sent. Check the number and try again.");
  }
  return created.id;
}

/** PalmPesa's own record of a payment. Null when the payment is unknown. */
export async function fetchPalmPayment(orderId: string): Promise<PalmRemote | null> {
  const response = await palmFetch(`/api/v2/async/payments/${encodeURIComponent(orderId)}`);
  if (response.status === 404) return null;
  if (response.status !== 200) {
    console.error("[palmpesa] status check", response.status);
    throw new Error("Could not confirm the payment");
  }
  const remote = readRemote(response.json);
  if (!remote) throw new Error("Could not confirm the payment");
  return remote;
}

export function callbackFromRemote(remote: PalmRemote, fallback: PalmCallback): PalmCallback {
  return {
    ...fallback,
    transaction_id: remote.transaction_id,
    order_id: remote.order_id,
    status: remote.status,
    amount: remote.amount,
    currency: remote.currency,
    channel: remote.channel ?? fallback.channel,
    selcom_reference: remote.reference ?? fallback.selcom_reference,
    failure_reason: remote.failure_reason ?? fallback.failure_reason,
  };
}

export function readPalmMeta(metadata: unknown) {
  const meta = metaRecord(metadata);
  return {
    source: typeof meta["source"] === "string" ? meta["source"] : "",
    transactionId: typeof meta["transaction_id"] === "string" ? meta["transaction_id"] : "",
    providerOrderId: typeof meta["provider_order_id"] === "string" ? meta["provider_order_id"] : "",
    reference: typeof meta["provider_reference"] === "string" ? meta["provider_reference"] : "",
    channel: typeof meta["channel"] === "string" ? meta["channel"] : "",
    failureReason: typeof meta["failure_reason"] === "string" ? meta["failure_reason"] : "",
    method: typeof meta["method"] === "string" ? meta["method"] : "",
    wallet: typeof meta["wallet"] === "string" ? meta["wallet"] : "",
  };
}
