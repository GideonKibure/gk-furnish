/** Advance payment amount in Tanzanian Shillings (TZS). */
export const ADVANCE_AMOUNT_TZS = 10_000;

export type PaymentKind = "advance" | "full" | "none";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";

export function paymentAmountFor(kind: "advance" | "full", productTotal: number) {
  if (kind === "advance") return ADVANCE_AMOUNT_TZS;
  return Math.max(0, Math.round(productTotal));
}

/** Normalize Tanzania mobile numbers to 255XXXXXXXXX for Snippe. */
export function toSnippePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith("0") && digits.length >= 10) return `255${digits.slice(1, 10)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}
