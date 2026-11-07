import type { Dictionary } from "./en";

export function statusLabel(t: Dictionary, status: string) {
  return (t.status as Record<string, string>)[status] ?? status.replace(/_/g, " ");
}

export type StatusTone = "success" | "warn" | "pending" | "info" | "danger" | "neutral" | "gold";

/** Colour for an order, custom request or payment status pill. */
export function statusTone(status: string): StatusTone {
  switch (status) {
    case "completed":
    case "delivered":
    case "paid":
    case "accepted":
      return "success";
    case "in_production":
    case "processing":
    case "in_progress":
    case "ready":
      return "warn";
    case "pending":
    case "awaiting_payment":
    case "unpaid":
    case "changes_requested":
      return "pending";
    case "confirmed":
    case "out_for_delivery":
    case "quoted":
      return "info";
    case "cancelled":
    case "failed":
    case "expired":
    case "rejected":
    case "refunded":
      return "danger";
    default:
      return "neutral";
  }
}
