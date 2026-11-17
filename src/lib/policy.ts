/** Policy figures come from site settings. An empty setting is not replaced with a guessed number. */

export const INSPECTION_WINDOW_HOURS_WHEN_COLUMN_MISSING = 48;

export type PolicySettings = {
  warrantyMonthsStructure: number | null;
  warrantyMonthsFinish: number | null;
  /** Null means the owner cleared it. 48 is used only when the column is not in the database yet. */
  inspectionWindowHours: number | null;
  refundProcessingDays: number | null;
  /** 0 means ready-made pieces are not returnable. Null means the owner has not set it. */
  readyMadeReturnWindowHours: number | null;
  unpaidExpiryDays: number | null;
  policyVersion: string;
};

type SettingsRow = {
  warranty_months_structure?: number | null;
  warranty_months_finish?: number | null;
  inspection_window_hours?: number | null;
  refund_processing_days?: number | null;
  ready_made_return_window_hours?: number | null;
  unpaid_expiry_days?: number | null;
  policy_version?: string | null;
};

function wholeNumber(value: number | null | undefined, whenMissing: number | null) {
  if (value === undefined) return whenMissing;
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export function policySettingsFrom(row: SettingsRow | null | undefined): PolicySettings {
  return {
    warrantyMonthsStructure: wholeNumber(row?.warranty_months_structure, null),
    warrantyMonthsFinish: wholeNumber(row?.warranty_months_finish, null),
    inspectionWindowHours: wholeNumber(row?.inspection_window_hours, INSPECTION_WINDOW_HOURS_WHEN_COLUMN_MISSING),
    refundProcessingDays: wholeNumber(row?.refund_processing_days, null),
    readyMadeReturnWindowHours: wholeNumber(row?.ready_made_return_window_hours, null),
    unpaidExpiryDays: wholeNumber(row?.unpaid_expiry_days, null),
    policyVersion: (row?.policy_version ?? "").trim(),
  };
}

/** True when the public page should say "Ask us on WhatsApp" instead of a number. */
export function policyFigureMissing(value: number | null) {
  return value == null;
}

export function policiesAccepted(accepted: boolean) {
  return accepted === true;
}

/** Written once, when the customer accepts. Later order updates must drop these keys. */
export function policyAcceptanceStamp(version: string, acceptedAt: Date) {
  return {
    policy_version: version.trim(),
    policy_accepted_at: acceptedAt.toISOString(),
  };
}

export function withoutPolicyStamp<T extends { policy_version?: unknown; policy_accepted_at?: unknown }>(patch: T) {
  const rest = { ...patch };
  delete rest.policy_version;
  delete rest.policy_accepted_at;
  return rest;
}

/** 0 advance, 1 design agreed, 2 building, 3 balance and handover. */
export function moneyStage(order: { paid: number; advanceRequired: number; specsAgreed: boolean; status: string }) {
  const handover = ["ready", "out_for_delivery", "delivered", "completed"].includes(order.status);
  if (order.advanceRequired > 0 && order.paid < order.advanceRequired) return 0;
  if (!order.specsAgreed) return 1;
  if (handover) return 3;
  return 2;
}
