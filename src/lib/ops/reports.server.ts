/**
 * Profit and loss shared by the Reports page and the dashboard.
 *
 * Basis (cash):
 *   revenue      = completed customer payments in the period (stamped when they complete)
 *                  − refunds recorded in the period
 *   COGS         = actual material + labour + overhead of production jobs completed in the period
 *                  + landed cost of purchase lines bought for customer orders on POs fully received
 *                    (received_at) in the period (line cost + the PO's transport and inspection shared
 *                    pro rata by line value)
 *   gross profit = revenue − COGS
 *   opex         = non-archived expenses dated in the period, by category (payment fees included)
 *   net profit   = gross profit − opex
 * Capital contributions and loans are never revenue (BR-13/14); they only appear in the cashbook.
 */
import { isMissingSchema } from "@/lib/db-compat";
import { darDayKey } from "@/lib/ops/date-range";

type SupabaseAdmin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type DbError = { code?: string | null; message?: string | null } | null;

export type Period = { from: Date; to: Date };

/** Inclusive `YYYY-MM-DD` keys for date columns (expenses, supplier payments, capital). */
export function periodDays(p: Period) {
  return { fromDay: darDayKey(p.from), toDay: darDayKey(p.to.getTime() - 1) };
}

/** Rows of an optional (0008) table: missing table → `null`. */
export function optionalRows<T>(result: { data: T[] | null; error: DbError }): T[] | null {
  if (result.error) {
    if (isMissingSchema(result.error)) return null;
    throw new Error(result.error.message ?? "Database error");
  }
  return result.data ?? [];
}

export type PoForCost = {
  id: string;
  po_number: string;
  order_id: string | null;
  status: string;
  transport_cost: number;
  inspection_cost: number;
  updated_at: string;
  purchase_items: { id: string; description: string; order_item_id: string | null; quantity: number; unit_cost: number; accepted_qty: number }[];
};

/** Cost of a PO line: accepted units when goods were received, otherwise the ordered units. */
export function lineCost(line: PoForCost["purchase_items"][number]) {
  const qty = Number(line.accepted_qty) > 0 ? Number(line.accepted_qty) : Number(line.quantity);
  return qty * Number(line.unit_cost);
}

/** Landed cost of the lines of a PO that were bought for customer orders. */
export function partnerLandedCost(po: PoForCost) {
  const lines = po.purchase_items ?? [];
  const goods = lines.reduce((s, l) => s + lineCost(l), 0);
  const extras = Number(po.transport_cost) + Number(po.inspection_cost);
  const forOrders = lines.filter((l) => po.order_id || l.order_item_id);
  return forOrders.reduce((s, l) => {
    const cost = lineCost(l);
    return s + cost + (goods > 0 ? (extras * cost) / goods : 0);
  }, 0);
}

export type ProfitAndLoss = {
  /** False before migration 0008: COGS, refunds and expenses are unknown. */
  available: boolean;
  received: number;
  refunds: number;
  revenue: number;
  cogsProduction: number;
  cogsPartner: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number | null;
  opexByCategory: Record<string, number>;
  opex: number;
  netProfit: number;
  /** Reasons the figures may be incomplete. */
  gaps: string[];
};

export async function computeProfitAndLoss(supabaseAdmin: SupabaseAdmin, period: Period): Promise<ProfitAndLoss> {
  const fromIso = period.from.toISOString();
  const toIso = period.to.toISOString();
  const { fromDay, toDay } = periodDays(period);

  const [payments, refunds, jobs, pos, expenses] = await Promise.all([
    supabaseAdmin.from("payments").select("amount").eq("status", "completed").gte("updated_at", fromIso).lt("updated_at", toIso),
    supabaseAdmin.from("refunds").select("amount").gte("created_at", fromIso).lt("created_at", toIso),
    supabaseAdmin
      .from("production_jobs")
      .select("act_material_cost,act_labour_cost,act_overhead_cost")
      .eq("status", "completed")
      .gte("completed_at", fromIso)
      .lt("completed_at", toIso),
    supabaseAdmin
      .from("purchase_orders")
      .select("id,po_number,order_id,status,transport_cost,inspection_cost,updated_at,purchase_items(id,description,order_item_id,quantity,unit_cost,accepted_qty)")
      .eq("status", "received")
      .gte("received_at", fromIso)
      .lt("received_at", toIso),
    supabaseAdmin
      .from("expenses")
      .select("category,amount")
      .is("archived_at", null)
      .gte("expense_date", fromDay)
      .lte("expense_date", toDay),
  ]);
  if (payments.error) throw new Error(payments.error.message);

  const received = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const refundRows = optionalRows(refunds);
  const jobRows = optionalRows(jobs);
  const poRows = optionalRows(pos as { data: PoForCost[] | null; error: DbError });
  const expenseRows = optionalRows(expenses);
  const available = refundRows !== null && jobRows !== null && poRows !== null && expenseRows !== null;

  const refundTotal = (refundRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const revenue = received - refundTotal;
  const cogsProduction = (jobRows ?? []).reduce(
    (s, j) => s + Number(j.act_material_cost) + Number(j.act_labour_cost) + Number(j.act_overhead_cost),
    0,
  );
  const cogsPartner = (poRows ?? []).reduce((s, po) => s + partnerLandedCost(po), 0);
  const cogs = cogsProduction + cogsPartner;
  const grossProfit = revenue - cogs;
  const opexByCategory: Record<string, number> = {};
  for (const e of expenseRows ?? []) opexByCategory[e.category] = (opexByCategory[e.category] ?? 0) + Number(e.amount);
  const opex = Object.values(opexByCategory).reduce((s, v) => s + v, 0);

  const gaps: string[] = [];
  if (!available) gaps.push("Costs, refunds and expenses need migration 0008.");
  if (received > 0 && cogs === 0 && available) gaps.push("Sales were received but no production or partner costs are recorded.");
  if ((jobRows ?? []).some((j) => Number(j.act_material_cost) + Number(j.act_labour_cost) + Number(j.act_overhead_cost) === 0)) {
    gaps.push("Some completed production jobs have no actual cost.");
  }

  return {
    available,
    received,
    refunds: refundTotal,
    revenue,
    cogsProduction,
    cogsPartner,
    cogs,
    grossProfit,
    grossMargin: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : null,
    opexByCategory,
    opex,
    netProfit: grossProfit - opex,
    gaps,
  };
}
