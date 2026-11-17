import { advanceStillDue, statusBlockers } from "./payment-policy.ts";

const ADVANCE_MESSAGE = "The advance payment has not been received.";
const CLOSED = ["cancelled", "refunded", "delivered", "completed"];

export type QueueStamp = { createdAt: string };
export type BlockedStamp = QueueStamp & { why: string };

export type TodayRow = {
  id: "payments" | "price" | "custom" | "advance" | "blocked" | "stock";
  label: string;
  count: number;
  oldestAt: string | null;
  href: string;
  why: string | null;
};

export function isPriceAsk(description: string | null | undefined) {
  return /asking for the price|anauliza bei/i.test(description ?? "");
}

export function orderNeedsAdvance(order: {
  status: string;
  amount_paid: number;
  advance_required: number;
}) {
  if (CLOSED.includes(order.status)) return false;
  return advanceStillDue(order.advance_required, order.amount_paid) > 0;
}

/** First production or handover sentence, leaving the advance row to cover advance-only blocks. */
export function orderBlockedWhy(order: {
  status: string;
  total_amount: number;
  amount_paid: number;
  advance_required: number;
  specs_agreed_at: string | null;
  fulfilment_method?: string | null;
  delivery_fee_status?: string | null;
}) {
  if (CLOSED.includes(order.status)) return null;
  const target = ["ready", "in_production", "out_for_delivery"].includes(order.status)
    ? "out_for_delivery"
    : "in_production";
  const reasons = statusBlockers(order, target).filter((reason) => reason !== ADVANCE_MESSAGE);
  return reasons[0] ?? null;
}

export function queueAgeLabel(oldestAt: string | null, nowMs: number) {
  if (!oldestAt) return null;
  const hours = Math.max(0, Math.floor((nowMs - new Date(oldestAt).getTime()) / 3_600_000));
  if (!Number.isFinite(hours)) return null;
  if (hours < 1) return "Less than an hour";
  if (hours < 48) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

function oldest(rows: QueueStamp[]) {
  if (!rows.length) return null;
  return rows.reduce(
    (best, row) => (row.createdAt < best ? row.createdAt : best),
    rows[0]?.createdAt ?? "",
  );
}

function blockedWhy(rows: BlockedStamp[]) {
  const reasons = [...new Set(rows.map((row) => row.why))];
  if (reasons.length === 1) return reasons[0] ?? null;
  return "More than one reason. Open the list.";
}

export function buildTodayQueue(input: {
  paymentsWaiting: QueueStamp[];
  priceRequests: QueueStamp[];
  customRequests: QueueStamp[];
  needingAdvance: QueueStamp[];
  blocked: BlockedStamp[];
  lowStockCount: number;
  lowStockHref: string;
}): TodayRow[] {
  const rows: TodayRow[] = [];
  if (input.paymentsWaiting.length) {
    rows.push({
      id: "payments",
      label: "Payments waiting for confirmation",
      count: input.paymentsWaiting.length,
      oldestAt: oldest(input.paymentsWaiting),
      href: "/admin/payments?status=pending",
      why: null,
    });
  }
  if (input.priceRequests.length) {
    rows.push({
      id: "price",
      label: "Price requests not yet answered",
      count: input.priceRequests.length,
      oldestAt: oldest(input.priceRequests),
      href: "/admin/custom-orders?view=price",
      why: null,
    });
  }
  if (input.customRequests.length) {
    rows.push({
      id: "custom",
      label: "Custom requests not yet answered",
      count: input.customRequests.length,
      oldestAt: oldest(input.customRequests),
      href: "/admin/custom-orders?view=custom",
      why: null,
    });
  }
  if (input.needingAdvance.length) {
    rows.push({
      id: "advance",
      label: "Orders needing an advance",
      count: input.needingAdvance.length,
      oldestAt: oldest(input.needingAdvance),
      href: "/admin/orders?view=advance",
      why: null,
    });
  }
  if (input.blocked.length) {
    rows.push({
      id: "blocked",
      label: "Orders blocked from production or handover",
      count: input.blocked.length,
      oldestAt: oldest(input.blocked),
      href: "/admin/orders?view=blocked",
      why: blockedWhy(input.blocked),
    });
  }
  if (input.lowStockCount > 0) {
    rows.push({
      id: "stock",
      label: "Low stock",
      count: input.lowStockCount,
      oldestAt: null,
      href: input.lowStockHref,
      why: null,
    });
  }
  return rows;
}

export function confirmPaymentCopy(amountLabel: string, orderNumber: string) {
  return `Confirm ${amountLabel} for order ${orderNumber}? This adds the money to the order.`;
}

export function notificationGroup(type: string) {
  if (type.includes("payment")) return "Payments";
  if (type.includes("request") || type.includes("custom") || type.includes("quote"))
    return "Requests";
  if (type.startsWith("order")) return "Orders";
  if (type.includes("review")) return "Reviews";
  if (type.startsWith("job") || type.startsWith("po")) return "Workshop";
  return "Other";
}

export function groupNotifications<T extends { type: string }>(items: T[]) {
  const order = ["Payments", "Requests", "Orders", "Reviews", "Workshop", "Other"];
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = notificationGroup(item.type);
    const list = groups.get(label) ?? [];
    list.push(item);
    groups.set(label, list);
  }
  return order.flatMap((label) => {
    const grouped = groups.get(label);
    return grouped ? [{ label, items: grouped }] : [];
  });
}
