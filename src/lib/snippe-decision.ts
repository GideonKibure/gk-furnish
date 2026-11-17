/** Pure Snippe payment decisions. Amounts are integer TZS. No network or database calls. */

export type SnippeVia = "webhook" | "reconcile";

export type SnippeAction =
  | { action: "ignore" }
  | { action: "retry" }
  | { action: "review" }
  | { action: "complete" }
  | { action: "fail"; status: "failed" | "expired" };

const FAIL_EVENTS = new Set([
  "payment.failed",
  "payment.voided",
  "payment.expired",
  "payment.cancelled",
]);

export function snippeWebhookEnabled(env: { [key: string]: string | undefined }) {
  return (
    env["SNIPPE_ENABLED"] === "true" &&
    Boolean(env["SNIPPE_API_KEY"]?.trim()) &&
    Boolean(env["SNIPPE_WEBHOOK_SECRET"]?.trim())
  );
}

export function snippeReconcileEnabled(env: { [key: string]: string | undefined }) {
  return env["SNIPPE_ENABLED"] === "true" && Boolean(env["SNIPPE_API_KEY"]?.trim());
}

/** Integer TZS. A fractional amount is rejected rather than rounded into a different value. */
export function integerTzs(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded !== value) return null;
  return rounded;
}

export function moneyMatches(
  localAmount: number,
  localCurrency: string | null | undefined,
  remoteAmount: number,
  remoteCurrency: string | null | undefined,
) {
  const local = integerTzs(localAmount);
  const remote = integerTzs(remoteAmount);
  if (local == null || remote == null) return false;
  const left = (localCurrency?.trim() || "TZS").toUpperCase();
  const right = (remoteCurrency?.trim() || "").toUpperCase();
  return right.length > 0 && left === right && local === remote;
}

function failStatus(status: string): "failed" | "expired" {
  return status === "expired" ? "expired" : "failed";
}

/** Decide from a verified Snippe payment. `completed` is the documented success status. */
export function decideVerifiedSnippe(input: {
  eventType: string | null;
  remoteStatus: string;
  localAmount: number;
  localCurrency: string | null | undefined;
  webhookAmount: number | null;
  webhookCurrency: string | null;
  remoteAmount: number;
  remoteCurrency: string | null;
}): SnippeAction {
  const remoteMatches = moneyMatches(
    input.localAmount,
    input.localCurrency,
    input.remoteAmount,
    input.remoteCurrency,
  );
  const webhookMatches =
    input.webhookAmount == null
      ? true
      : moneyMatches(
          input.localAmount,
          input.localCurrency,
          input.webhookAmount,
          input.webhookCurrency,
        );

  if (input.remoteStatus === "completed") {
    if (!remoteMatches || !webhookMatches) return { action: "review" };
    return { action: "complete" };
  }

  if (
    input.remoteStatus === "failed" ||
    input.remoteStatus === "voided" ||
    input.remoteStatus === "expired"
  ) {
    return { action: "fail", status: failStatus(input.remoteStatus) };
  }

  const eventType = input.eventType ?? "";
  if (eventType === "payment.completed" || FAIL_EVENTS.has(eventType)) return { action: "retry" };
  return { action: "ignore" };
}

/** Fields stored on a confirmed payment. Owner confirmations omit the Snippe audit keys. */
export function completionAudit(details: {
  provider?: string | null;
  confirmedVia?: SnippeVia;
  providerReference?: string;
}): { provider?: string | null; confirmed_via?: SnippeVia; provider_reference?: string } {
  const patch: {
    provider?: string | null;
    confirmed_via?: SnippeVia;
    provider_reference?: string;
  } = {};
  if (details.provider !== undefined) patch.provider = details.provider ?? null;
  if (details.confirmedVia) patch.confirmed_via = details.confirmedVia;
  if (details.providerReference) patch.provider_reference = details.providerReference;
  return patch;
}

export function maskProviderReference(reference: string) {
  const trimmed = reference.trim();
  if (trimmed.length <= 6) return "****";
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}

/** True when a pending Snippe payment is old enough to reconcile and not yet expired from the window. */
export function snippeReconcileDue(createdAtMs: number, nowMs: number) {
  const age = nowMs - createdAtMs;
  return age >= 2 * 60 * 1000 && age <= 48 * 60 * 60 * 1000;
}

/**
 * Stock to remove for one sale line.
 * A product with no stock on hand is left alone (made-to-order pieces are stored as 0).
 * A stocked product that cannot cover the quantity is not reduced, and the order is flagged.
 */
export function stockReductionForSale(available: number, requested: number) {
  const have = Math.trunc(available);
  const want = Math.trunc(requested);
  if (want <= 0 || have <= 0) return { deduct: 0, insufficient: false };
  if (want > have) return { deduct: 0, insufficient: true };
  return { deduct: want, insufficient: false };
}

/** Advance stock runs once. A later confirmation must not deduct again. */
export function shouldReduceStock(input: { stockApplied: boolean; advanceCovered: boolean }) {
  return input.advanceCovered && !input.stockApplied;
}
