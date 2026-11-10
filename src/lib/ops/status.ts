/** Labels and pill colours for the statuses shown in the admin portal. */

export type PillTone = "success" | "processing" | "pending" | "info" | "danger" | "neutral";

/** Every order status, in the order an order moves through them. */
export const ORDER_STATUSES = [
  "pending",
  "awaiting_payment",
  "confirmed",
  "processing",
  "in_production",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Statuses added by migration 0008; the database rejects them before it has run. */
export const ORDER_STATUSES_0008: readonly string[] = ["awaiting_payment", "processing", "delivered", "refunded"];

/** Statuses only reachable through their own action (cancel with a reason, refund flow). */
export const ORDER_STATUSES_BY_ACTION: readonly string[] = ["cancelled", "refunded"];

/** The four stages the customer and the admin orders screen share. Older statuses fold into these. */
export const CUSTOMER_STAGES = [
  { id: "ordered", label: "Ordered", write: "pending", statuses: ["pending", "awaiting_payment"] },
  { id: "paid", label: "Paid", write: "confirmed", statuses: ["confirmed", "processing"] },
  { id: "production", label: "In production", write: "in_production", statuses: ["in_production", "ready"] },
  { id: "received", label: "Received", write: "completed", statuses: ["out_for_delivery", "delivered", "completed"] },
] as const;

export function customerStage(status: string) {
  return CUSTOMER_STAGES.find((stage) => (stage.statuses as readonly string[]).includes(status)) ?? null;
}

/** Status written when the admin picks a stage. Older values display as that stage without being rewritten. */
export function customerStageWrite(status: string) {
  return customerStage(status)?.write ?? status;
}

const ORDER_LABELS: Record<string, string> = {
  pending: "Ordered",
  awaiting_payment: "Ordered",
  confirmed: "Paid",
  processing: "Paid",
  in_production: "In production",
  ready: "In production",
  out_for_delivery: "Received",
  delivered: "Received",
  completed: "Received",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const ORDER_TONES: Record<string, PillTone> = {
  pending: "pending",
  awaiting_payment: "pending",
  confirmed: "info",
  processing: "processing",
  in_production: "processing",
  ready: "processing",
  out_for_delivery: "info",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
  refunded: "neutral",
};

export function humanize(value: string) {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function orderStatusLabel(status: string) {
  return ORDER_LABELS[status] ?? humanize(status);
}

export function orderStatusTone(status: string): PillTone {
  return ORDER_TONES[status] ?? "neutral";
}

/** Status tabs on the orders list, grouping the order statuses. */
export const ORDER_TABS = [
  { id: "all", label: "All", statuses: null },
  { id: "ordered", label: "Ordered", statuses: ["pending", "awaiting_payment"] },
  { id: "paid", label: "Paid", statuses: ["confirmed", "processing"] },
  { id: "production", label: "In production", statuses: ["in_production", "ready"] },
  { id: "received", label: "Received", statuses: ["out_for_delivery", "delivered", "completed"] },
  { id: "cancelled", label: "Cancelled", statuses: ["cancelled", "refunded"] },
] as const;
export type OrderTab = (typeof ORDER_TABS)[number]["id"];

export function paymentState(order: { payment_status: string; payment_kind: string }) {
  if (order.payment_status === "paid" && order.payment_kind === "full") return "full" as const;
  if (order.payment_status === "paid") return "advance" as const;
  if (order.payment_status === "pending") return "pending" as const;
  if (order.payment_status === "failed") return "failed" as const;
  return "unpaid" as const;
}
export type PaymentState = ReturnType<typeof paymentState>;

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  full: "Paid in full",
  advance: "Advance paid",
  pending: "Payment pending",
  failed: "Payment failed",
  unpaid: "Unpaid",
};

export const PAYMENT_STATE_TONES: Record<PaymentState, PillTone> = {
  full: "success",
  advance: "processing",
  pending: "pending",
  failed: "danger",
  unpaid: "neutral",
};

export function paymentRecordTone(status: string): PillTone {
  if (status === "completed") return "success";
  if (status === "pending") return "pending";
  if (status === "failed" || status === "expired") return "danger";
  return "neutral";
}

/** Custom request statuses. `accepted`, `rejected` and `changes_requested` are set by the customer's quote response. */
export const CUSTOM_STATUSES = [
  "pending",
  "quoted",
  "changes_requested",
  "accepted",
  "rejected",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type CustomStatus = (typeof CUSTOM_STATUSES)[number];

/** Requests where GK Furnish has to act next: send a first quote or a revised one. */
export const CUSTOM_NEEDS_QUOTE: readonly string[] = ["pending", "changes_requested"];

const CUSTOM_LABELS: Record<string, string> = {
  pending: "Awaiting quote",
  quoted: "Quoted",
  changes_requested: "Changes requested",
  accepted: "Accepted",
  rejected: "Rejected",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function customStatusLabel(status: string) {
  return CUSTOM_LABELS[status] ?? humanize(status);
}

export function customStatusTone(status: string): PillTone {
  if (status === "completed" || status === "accepted") return "success";
  if (status === "cancelled" || status === "rejected") return "danger";
  if (status === "in_progress") return "processing";
  if (status === "quoted") return "info";
  return "pending";
}

export function reviewTone(status: string): PillTone {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "pending";
}

export function productStatusTone(status: string): PillTone {
  if (status === "active") return "success";
  if (status === "draft") return "pending";
  return "neutral";
}

export function deliveryFeeLabel(status: string | null | undefined, method?: string | null) {
  if (method === "collection") return "Collection";
  if (status === "free") return "Free delivery";
  if (status === "confirmed") return "Fee confirmed";
  return "Fee to confirm";
}

export function deliveryFeeTone(status: string | null | undefined, method?: string | null): PillTone {
  if (method === "collection") return "neutral";
  if (status === "free") return "info";
  if (status === "confirmed") return "success";
  return "pending";
}
