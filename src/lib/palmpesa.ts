/**
 * PalmPesa API v2 rules that do not touch the network or the database.
 * Amounts are whole Tanzanian shillings. Only a verified COMPLETED payment is paid.
 * Docs: https://documentation.palmpesa.co.tz/
 */

export const PALMPESA_MIN_TZS = 100;
export const PALMPESA_MAX_TZS = 100_000_000;
export const ADMIN_REPEAT_WINDOW_MS = 120_000;

export const PALM_EVENTS = [
  "payment.completed",
  "payment.cancelled",
  "payment.rejected",
  "payment.initiation_failed",
  "payment.expired",
] as const;

export type PalmEventName = (typeof PALM_EVENTS)[number];

export type PalmCallback = {
  event: string;
  event_id: string;
  transaction_id: string;
  order_id: string;
  selcom_reference: string | null;
  status: string;
  amount: number;
  currency: string;
  channel: string | null;
  phone: string | null;
  failure_reason: string | null;
};

export type LocalPayment = {
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "expired";
  transactionId: string;
  providerOrderId: string | null;
};

export type CallbackDecision =
  | { action: "duplicate" }
  | { action: "ignore" }
  | { action: "mismatch" }
  | { action: "complete" }
  | { action: "fail"; status: "failed" | "expired"; reason: string };

/** 0712…, 712…, +255 712… and 255712… become 255712345678. Other numbers are rejected. */
export function toPalmPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let n = "";
  if (digits.startsWith("255") && digits.length >= 12) n = digits.slice(0, 12);
  else if (digits.startsWith("0") && digits.length >= 10) n = `255${digits.slice(1, 10)}`;
  else if (digits.length === 9) n = `255${digits}`;
  else return null;
  return /^255[67]\d{8}$/.test(n) ? n : null;
}

/** Whole shillings, within PalmPesa's limits, and never above the balance still owed. */
export function assertPayableAmount(amount: number, balance: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount greater than zero.";
  const n = Math.round(amount);
  const left = Math.round(balance);
  if (n > left) return "That is more than the remaining balance.";
  if (n < PALMPESA_MIN_TZS) return `The smallest mobile money payment is ${PALMPESA_MIN_TZS.toLocaleString("en-US")} TZS.`;
  if (n > PALMPESA_MAX_TZS) return "That amount is above the mobile money limit.";
  return null;
}

/** Cash is recorded by an admin and may be any positive amount up to the balance. */
export function assertCashAmount(amount: number, balance: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount greater than zero.";
  if (Math.round(amount) > Math.round(balance)) return "That is more than the remaining balance.";
  return null;
}

export function palmTransactionId(paymentId: string) {
  return `GK-${paymentId}`;
}

/** The order owner, or anyone holding that order's unguessable payment link. */
export function canPayOrder(input: { userId: string | null; orderUserId: string | null; hasPaymentLink: boolean }) {
  if (input.hasPaymentLink) return true;
  return Boolean(input.userId && input.orderUserId && input.userId === input.orderUserId);
}

/** Same method and amount recorded moments ago: treat as a double click, not a second payment. */
export function isRepeatAdminPayment(
  existing: { amount: number; method: string; createdAtMs: number }[],
  next: { amount: number; method: string; nowMs: number },
) {
  return existing.some(
    (row) =>
      row.method === next.method &&
      Math.round(row.amount) === Math.round(next.amount) &&
      next.nowMs >= row.createdAtMs &&
      next.nowMs - row.createdAtMs < ADMIN_REPEAT_WINDOW_MS,
  );
}

export function parsePalmCallback(body: unknown): PalmCallback | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const amount = b["amount"];
  if (typeof b["event"] !== "string" || typeof b["event_id"] !== "string" || !b["event_id"]) return null;
  if (typeof b["transaction_id"] !== "string" || !b["transaction_id"]) return null;
  if (typeof b["order_id"] !== "string" || !b["order_id"]) return null;
  if (typeof b["status"] !== "string" || typeof b["currency"] !== "string") return null;
  if (typeof amount !== "number" || !Number.isInteger(amount)) return null;
  return {
    event: b["event"],
    event_id: b["event_id"],
    transaction_id: b["transaction_id"],
    order_id: b["order_id"],
    selcom_reference: typeof b["selcom_reference"] === "string" ? b["selcom_reference"] : null,
    status: b["status"],
    amount,
    currency: b["currency"],
    channel: typeof b["channel"] === "string" ? b["channel"] : null,
    phone: typeof b["phone"] === "string" ? b["phone"] : null,
    failure_reason: typeof b["failure_reason"] === "string" ? b["failure_reason"] : null,
  };
}

/**
 * What to do with one callback.
 * `verifiedStatus` is PalmPesa's own status endpoint and wins over the callback body.
 * A COMPLETED result is paid even when an earlier event had already expired or failed.
 * A completed payment is never paid again and is never undone by a later event.
 */
export function decideCallback(input: {
  alreadyProcessed: boolean;
  payment: LocalPayment | null;
  event: PalmCallback;
  verifiedStatus?: string | null;
}): CallbackDecision {
  if (input.alreadyProcessed) return { action: "duplicate" };
  const payment = input.payment;
  const event = input.event;
  if (!payment) return { action: "mismatch" };
  if (payment.transactionId !== event.transaction_id) return { action: "mismatch" };
  if (payment.providerOrderId && payment.providerOrderId !== event.order_id) return { action: "mismatch" };
  if (Math.round(payment.amount) !== event.amount || event.currency !== "TZS" || payment.currency !== "TZS") {
    return { action: "mismatch" };
  }

  const status = (input.verifiedStatus ?? event.status).toUpperCase();
  if (status === "COMPLETED" || (!input.verifiedStatus && event.event === "payment.completed")) {
    if (payment.status === "completed") return { action: "duplicate" };
    return { action: "complete" };
  }
  if (payment.status === "completed") return { action: "ignore" };
  if (payment.status !== "pending") return { action: "ignore" };
  if (status === "EXPIRED" || event.event === "payment.expired") {
    return { action: "fail", status: "expired", reason: "EXPIRED" };
  }
  if (status === "CANCELLED" || event.event === "payment.cancelled") {
    return { action: "fail", status: "failed", reason: "CANCELLED" };
  }
  if (status === "REJECTED" || event.event === "payment.rejected") {
    return { action: "fail", status: "failed", reason: event.failure_reason || "REJECTED" };
  }
  if (status === "INITIATION_FAILED" || event.event === "payment.initiation_failed") {
    return { action: "fail", status: "failed", reason: event.failure_reason || "INITIATION_FAILED" };
  }
  return { action: "ignore" };
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** HMAC of `timestamp.body`. Signing is optional and only checked when PalmPesa has issued a secret. */
export async function verifyPalmSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
  nowMs = Date.now(),
) {
  if (!timestamp || !signature || !secret) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(nowMs / 1000 - seconds) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  return safeEqual(`sha256=${hex(mac)}`, signature.trim());
}

export function metaRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
}
