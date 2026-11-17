import { z } from "zod";
import { advanceStillDue } from "./payment-policy.ts";

export const TrackingInput = z.object({ token: z.string().uuid() });

export const CUSTOMER_STAGES = ["ordered", "paid", "production", "received"] as const;

const HANDOVER = new Set(["ready", "out_for_delivery", "delivered", "completed"]);

export function customerStageIndex(status: string): number | "cancelled" | "refunded" {
  if (status === "cancelled") return "cancelled";
  if (status === "refunded") return "refunded";
  if (status === "confirmed" || status === "processing") return 1;
  if (status === "in_production" || status === "ready") return 2;
  if (HANDOVER.has(status)) return 3;
  return 0;
}

export type NextTrackStep =
  | { id: "cancelled" }
  | { id: "refunded" }
  | { id: "advance"; amount: number }
  | { id: "design" }
  | { id: "building" }
  | { id: "balance"; amount: number; delivery: "pending" | "free" | "confirmed"; fee: number | null }
  | { id: "ready"; method: "collection" | "delivery" };

export function nextTrackStep(order: {
  status: string;
  paid: number;
  advanceRequired: number;
  balance: number;
  specsAgreed: boolean;
  deliveryFeeStatus: string;
  deliveryFee: number | null;
  fulfilmentMethod: string;
}): NextTrackStep {
  if (order.status === "cancelled") return { id: "cancelled" };
  if (order.status === "refunded") return { id: "refunded" };
  const advance = advanceStillDue(order.advanceRequired, order.paid);
  if (advance > 0) return { id: "advance", amount: advance };
  if (!order.specsAgreed) return { id: "design" };
  if (HANDOVER.has(order.status) && order.balance > 0) {
    const delivery = order.deliveryFeeStatus === "pending" ? "pending" : order.deliveryFeeStatus === "free" ? "free" : "confirmed";
    return { id: "balance", amount: order.balance, delivery, fee: order.deliveryFee };
  }
  if (HANDOVER.has(order.status)) {
    return { id: "ready", method: order.fulfilmentMethod === "collection" ? "collection" : "delivery" };
  }
  return { id: "building" };
}

/** A payment the customer sent is not paid until GK Furnish confirms it. */
export function paymentCustomerState(status: string): "pending" | "confirmed" | "rejected" {
  if (status === "completed" || status === "paid") return "confirmed";
  if (status === "failed" || status === "rejected" || status === "expired" || status === "cancelled") return "rejected";
  return "pending";
}

/** Hours the owner saved. A missing setting stays empty. */
export function savedCompletionHours(value: number | null | undefined) {
  if (value == null) return null;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 1) return null;
  return Math.min(720, Math.round(hours));
}

const item = z.object({
  product_name: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  material: z.string().nullable(),
  size: z.string().nullable(),
  color: z.string().nullable(),
});

const payment = z.object({
  amount: z.number(),
  status: z.string(),
  purpose: z.string(),
  receipt_number: z.string().nullable(),
  provider: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PublicTrackedOrder = z
  .object({
    number: z.string(),
    status: z.string(),
    createdAt: z.string(),
    customerName: z.string(),
    phoneMasked: z.string(),
    fulfilmentMethod: z.string(),
    location: z.string(),
    neededBy: z.string().nullable(),
    subtotal: z.number(),
    deliveryFee: z.number().nullable(),
    deliveryFeeStatus: z.string(),
    total: z.number(),
    paid: z.number(),
    balance: z.number(),
    advancePercent: z.number(),
    advanceRequired: z.number(),
    paymentStatus: z.string(),
    specsAgreed: z.boolean(),
    items: z.array(item),
    payments: z.array(payment),
    history: z.array(z.object({ status: z.string(), created_at: z.string() })),
    collectionAddress: z.string().nullable(),
    completionHours: z.number().nullable(),
  })
  .strict();

export type TrackedOrder = z.infer<typeof PublicTrackedOrder>;

export function receiptRequiredLines(input: {
  business: string;
  address: string;
  orderNumber: string;
  receiptNumber: string;
  amount: string;
  method: string;
  date: string;
}) {
  return [input.business, input.address, input.orderNumber, input.receiptNumber, input.amount, input.method, input.date];
}
