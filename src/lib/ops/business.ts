/** Shared vocabulary for the phase 2 business modules (labels, tones, allowed values). */
import type { PillTone } from "@/lib/ops/status";

export const INVENTORY_KINDS = ["raw", "wip", "finished", "partner", "damaged"] as const;
export type InventoryKind = (typeof INVENTORY_KINDS)[number];
export const INVENTORY_KIND_LABELS: Record<InventoryKind, string> = {
  raw: "Raw material",
  wip: "Work in progress",
  finished: "Finished goods",
  partner: "Partner stock",
  damaged: "Damaged",
};

export const MOVEMENT_LABELS: Record<string, string> = {
  purchase_in: "Purchase received",
  production_use: "Used in production",
  production_out: "Produced",
  sale_out: "Sold",
  adjustment: "Adjustment",
  damage: "Damaged",
  return_in: "Returned",
  transfer: "Transfer",
  opening: "Opening stock",
};

export const JOB_STATUSES = [
  "queued",
  "materials_ready",
  "cutting",
  "assembly",
  "finishing",
  "quality_check",
  "completed",
  "on_hold",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Queued",
  materials_ready: "Materials ready",
  cutting: "Cutting",
  assembly: "Assembly",
  finishing: "Finishing",
  quality_check: "Quality check",
  completed: "Completed",
  on_hold: "On hold",
};
/** A job counts as started once it reaches one of these (needs advance + specs, or an exception). */
export const JOB_STARTED_STATUSES: readonly string[] = ["cutting", "assembly", "finishing", "quality_check", "completed"];

export function jobStatusTone(status: string): PillTone {
  if (status === "completed") return "success";
  if (status === "on_hold") return "danger";
  if (status === "queued") return "neutral";
  if (status === "materials_ready") return "info";
  if (status === "quality_check") return "pending";
  return "processing";
}

export const PO_STATUSES = ["draft", "sent", "partially_received", "received", "cancelled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_received: "Partly received",
  received: "Received",
  cancelled: "Cancelled",
};
export function poStatusTone(status: string): PillTone {
  if (status === "received") return "success";
  if (status === "cancelled") return "danger";
  if (status === "partially_received") return "processing";
  if (status === "sent") return "info";
  return "neutral";
}
/** POs still waiting for goods; overdue when past the expected date. */
export const PO_OPEN_STATUSES: readonly string[] = ["draft", "sent", "partially_received"];

export const QC_RESULTS = ["pass", "fail", "rework"] as const;
export function qcTone(result: string): PillTone {
  if (result === "pass") return "success";
  if (result === "fail") return "danger";
  return "pending";
}

export const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "transport",
  "materials",
  "wages",
  "marketing",
  "payment_fees",
  "maintenance",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Rent",
  utilities: "Utilities",
  transport: "Transport",
  materials: "Materials",
  wages: "Wages",
  marketing: "Marketing",
  payment_fees: "Payment fees",
  maintenance: "Maintenance",
  other: "Other",
};

export const PAYMENT_METHODS = ["Cash", "Bank transfer", "Mobile money", "Card", "Other"] as const;

export const CAPITAL_SOURCES = ["owner_funds", "gift", "loan"] as const;
export type CapitalSource = (typeof CAPITAL_SOURCES)[number];
export const CAPITAL_SOURCE_LABELS: Record<CapitalSource, string> = {
  owner_funds: "Owner funds",
  gift: "Gift / grant",
  loan: "Loan",
};

/** Today in Dar es Salaam as `YYYY-MM-DD` (for overdue checks against date columns). */
export function darToday(now = new Date()) {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
