/** Advance payment tiers and the order rules that depend on payment. */

export type AdvanceSettings = {
  standardPercent: number;
  customPercent: number;
  largePercent: number;
  expensiveFrom: number;
  largeFrom: number;
  largeItems: number;
};

export const DEFAULT_ADVANCE_SETTINGS: AdvanceSettings = {
  standardPercent: 50,
  customPercent: 60,
  largePercent: 70,
  expensiveFrom: 1_000_000,
  largeFrom: 3_000_000,
  largeItems: 10,
};

/** Snippe rejects mobile money payments below this amount. */
export const MIN_MOBILE_PAYMENT_TZS = 500;

type SettingsRow = {
  advance_standard_percent?: number | null;
  advance_custom_percent?: number | null;
  advance_large_percent?: number | null;
  advance_expensive_from?: number | null;
  advance_large_from?: number | null;
  advance_large_items?: number | null;
};

function pick(value: number | null | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function advanceSettingsFrom(row: SettingsRow | null | undefined): AdvanceSettings {
  const d = DEFAULT_ADVANCE_SETTINGS;
  return {
    standardPercent: pick(row?.advance_standard_percent, d.standardPercent),
    customPercent: pick(row?.advance_custom_percent, d.customPercent),
    largePercent: pick(row?.advance_large_percent, d.largePercent),
    expensiveFrom: pick(row?.advance_expensive_from, d.expensiveFrom),
    largeFrom: pick(row?.advance_large_from, d.largeFrom),
    largeItems: pick(row?.advance_large_items, d.largeItems),
  };
}

export type AdvanceTier = "standard" | "custom" | "large";

export function advanceTierFor(
  order: { total: number; itemCount: number; isCustom?: boolean },
  settings: AdvanceSettings,
): { tier: AdvanceTier; percent: number } {
  if (order.total >= settings.largeFrom || order.itemCount >= settings.largeItems) {
    return { tier: "large", percent: settings.largePercent };
  }
  if (order.isCustom || order.total >= settings.expensiveFrom) {
    return { tier: "custom", percent: settings.customPercent };
  }
  return { tier: "standard", percent: settings.standardPercent };
}

export function advanceAmount(total: number, percent: number) {
  return Math.ceil((Math.max(0, total) * Math.min(100, Math.max(0, percent))) / 100);
}

export function balanceDue(total: number, paid: number) {
  return Math.max(0, Math.round(total) - Math.round(paid));
}

type PolicyOrder = {
  total_amount: number;
  amount_paid: number;
  advance_required: number;
  specs_agreed_at: string | null;
  /** From migration 0007. Absent on older rows, which have no delivery fee to confirm. */
  fulfilment_method?: string | null | undefined;
  delivery_fee_status?: string | null | undefined;
};

/** True while a delivery order still waits for GK Furnish to set its delivery fee. */
export function deliveryFeePending(order: Pick<PolicyOrder, "fulfilment_method" | "delivery_fee_status">) {
  return order.fulfilment_method === "delivery" && order.delivery_fee_status === "pending";
}

/** Statuses that mean production has started or finished. */
export const PRODUCTION_STATUSES = ["in_production", "ready"] as const;
/** Statuses that hand the furniture over to the customer. */
export const DELIVERY_STATUSES = ["out_for_delivery", "completed"] as const;

/** Reasons the order cannot move to `status` yet; empty when it can. */
export function statusBlockers(order: PolicyOrder, status: string): string[] {
  const blockers: string[] = [];
  const needsProduction =
    (PRODUCTION_STATUSES as readonly string[]).includes(status) ||
    (DELIVERY_STATUSES as readonly string[]).includes(status);
  if (needsProduction) {
    if (Math.round(order.amount_paid) < Math.round(order.advance_required)) {
      blockers.push("The advance payment has not been received.");
    }
    if (!order.specs_agreed_at) {
      blockers.push("The design and specifications have not been marked as agreed.");
    }
  }
  if ((DELIVERY_STATUSES as readonly string[]).includes(status)) {
    if (deliveryFeePending(order)) blockers.push("The delivery fee has not been confirmed.");
    const left = balanceDue(order.total_amount, order.amount_paid);
    if (left > 0) blockers.push(`The balance of ${left.toLocaleString("en-US")} TSh has not been cleared.`);
  }
  return blockers;
}
