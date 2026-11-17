import {
  advanceAmount,
  advanceTierFor,
  type AdvanceSettings,
  MIN_MOBILE_PAYMENT_TZS,
} from "./payment-policy.ts";

/** Amount the customer pays now; never below the mobile-money minimum or above what is left. */
export function chargeNow(target: number, left: number) {
  if (left <= 0) return 0;
  return Math.min(left, Math.max(MIN_MOBILE_PAYMENT_TZS, Math.round(target)));
}

/** Advance and full amounts for checkout. Uses payment-policy.ts for the tier. */
export function quoteCheckout(
  subtotal: number,
  itemCount: number,
  settings: AdvanceSettings,
  isCustom = false,
) {
  const tier = advanceTierFor(
    { total: subtotal, itemCount, ...(isCustom ? { isCustom: true } : {}) },
    settings,
  );
  const advance = chargeNow(advanceAmount(subtotal, tier.percent), subtotal);
  const full = chargeNow(subtotal, subtotal);
  return {
    tier: tier.tier,
    percent: tier.percent,
    advance,
    full,
    balanceAfterAdvance: Math.max(0, Math.round(subtotal) - advance),
  };
}

/** A repeated checkout key belongs to the order already saved for it. */
export function existingOrderForRequest(existingOrderId: string | null) {
  return existingOrderId;
}

/** A failed phone prompt does not remove the order the customer can still track. */
export function orderAfterPromptFailure(orderNumber: string, message: string) {
  return { orderNumber, paymentId: null as string | null, paymentError: message, usable: true };
}
