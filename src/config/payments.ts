export type PaymentKind = "advance" | "full" | "none";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";

/** Normalize Tanzania mobile numbers to 255XXXXXXXXX for Snippe. */
export function toSnippePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith("0") && digits.length >= 10) return `255${digits.slice(1, 10)}`;
  if (digits.length === 9) return `255${digits}`;
  return digits;
}
