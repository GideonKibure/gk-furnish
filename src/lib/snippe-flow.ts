import {
  decideVerifiedSnippe,
  maskProviderReference,
  type SnippeAction,
  type SnippeVia,
} from "./snippe-decision.ts";

export type SnippePaymentRow = {
  id: string;
  amount: number;
  currency: string | null;
  status: string;
  reference: string;
  needsReview: boolean;
};

export type SnippeFlowDeps = {
  claim: (eventId: string) => Promise<"new" | "duplicate" | "untracked">;
  findByReference: (reference: string) => Promise<SnippePaymentRow | null>;
  getStatus: (reference: string) => Promise<{ status: string; amount: number; currency: string }>;
  complete: (paymentId: string, via: SnippeVia, reference: string) => Promise<void>;
  fail: (paymentId: string, status: "failed" | "expired") => Promise<void>;
  review: (paymentId: string) => Promise<void>;
  logUnknown?: (maskedReference: string) => void;
};

export type SnippeFlowResult = "ok" | "duplicate" | "unknown" | "retry" | "ignored";

export async function processSnippeEvent(
  event: {
    id: string;
    type: string | null;
    reference: string;
    amount: number | null;
    currency: string | null;
  },
  via: SnippeVia,
  deps: SnippeFlowDeps,
): Promise<SnippeFlowResult> {
  if (via === "webhook") {
    const claim = await deps.claim(event.id);
    if (claim === "duplicate") return "duplicate";
  }

  const payment = await deps.findByReference(event.reference);
  if (!payment) {
    deps.logUnknown?.(maskProviderReference(event.reference));
    return "unknown";
  }
  if (payment.status === "completed" || payment.status === "needs_review" || payment.needsReview)
    return "ignored";

  let remote: { status: string; amount: number; currency: string };
  try {
    remote = await deps.getStatus(event.reference);
  } catch {
    return "retry";
  }

  const decision: SnippeAction = decideVerifiedSnippe({
    eventType: event.type,
    remoteStatus: remote.status,
    localAmount: payment.amount,
    localCurrency: payment.currency,
    webhookAmount: event.amount,
    webhookCurrency: event.currency,
    remoteAmount: remote.amount,
    remoteCurrency: remote.currency,
  });

  if (decision.action === "complete") {
    await deps.complete(payment.id, via, event.reference);
    return "ok";
  }
  if (decision.action === "fail") {
    await deps.fail(payment.id, decision.status);
    return "ok";
  }
  if (decision.action === "review") {
    await deps.review(payment.id);
    return "ok";
  }
  if (decision.action === "retry") return "retry";
  return "ignored";
}
