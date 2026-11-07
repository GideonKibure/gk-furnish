import { SITE } from "@/config/site";

/** Pay-to details shown after an order. The owner can change the number and name here. */
export const PAYMENT_METHODS = [
  { id: "mpesa", label: "M-Pesa", account: SITE.phoneDisplay, accountName: "GK Furnish" },
  { id: "airtel", label: "Airtel Money", account: SITE.phoneDisplay, accountName: "GK Furnish" },
  { id: "yas", label: "Yas (Tigo Pesa)", account: SITE.phoneDisplay, accountName: "GK Furnish" },
  { id: "halopesa", label: "HaloPesa", account: SITE.phoneDisplay, accountName: "GK Furnish" },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export function paymentMethodById(id: string) {
  return PAYMENT_METHODS.find((method) => method.id === id) ?? null;
}
