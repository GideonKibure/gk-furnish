import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/integrations/supabase/admin-auth";
import { customBounds, darDayKey, darMonthKey, DATE_RANGES, rangeBounds, trendPercent } from "@/lib/ops/date-range";
import {
  computeProfitAndLoss,
  lineCost,
  optionalRows,
  periodDays,
  type PoForCost,
} from "@/lib/ops/reports.server";

type DbError = { code?: string | null; message?: string | null } | null;

const ReportInput = z.union([
  z.object({ range: z.enum(DATE_RANGES) }),
  z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
]);

function methodOf(p: { provider: string | null; snippe_reference: string | null; metadata: unknown }) {
  const meta = p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata) ? (p.metadata as Record<string, unknown>) : {};
  const method = meta["method"];
  return p.provider ?? (typeof method === "string" ? method : p.snippe_reference ? "Mobile money" : "Other");
}

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

type CashLine = { direction: "in" | "out"; kind: string; method: string; amount: number };

/** Everything on the Reports page for one period. Each part says whether its tables exist. */
export const getReports = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d) => ReportInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bounds = "range" in data ? rangeBounds(data.range) : customBounds(data.from, data.to);
    const period = { from: bounds.from, to: new Date(bounds.to.getTime() + 1) };
    const fromIso = period.from.toISOString();
    const toIso = period.to.toISOString();
    const { fromDay, toDay } = periodDays(period);
    const today = darDayKey(new Date());

    const [pnl, pnlPrev] = await Promise.all([
      computeProfitAndLoss(supabaseAdmin, period),
      computeProfitAndLoss(supabaseAdmin, { from: bounds.prevFrom, to: bounds.prevTo }),
    ]);

    const [payments, refunds, capital, expenses, supplierPayments, openOrders, pos, items, completedJobs, activeProducts, costs] =
      await Promise.all([
        supabaseAdmin
          .from("payments")
          .select("id,order_id,amount,provider,snippe_reference,metadata,updated_at")
          .eq("status", "completed")
          .gte("updated_at", fromIso)
          .lt("updated_at", toIso),
        supabaseAdmin.from("refunds").select("amount,method,created_at").gte("created_at", fromIso).lt("created_at", toIso),
        supabaseAdmin.from("capital_contributions").select("source,amount,contributor,date").gte("date", fromDay).lte("date", toDay),
        supabaseAdmin
          .from("expenses")
          .select("id,category,amount,payment_method,receipt_path,expense_date,description")
          .is("archived_at", null)
          .gte("expense_date", fromDay)
          .lte("expense_date", toDay),
        supabaseAdmin.from("supplier_payments").select("amount,method,paid_at").gte("paid_at", fromDay).lte("paid_at", toDay),
        supabaseAdmin.from("orders").select("*").not("status", "in", "(cancelled,refunded)"),
        supabaseAdmin
          .from("purchase_orders")
          .select(
            "id,po_number,order_id,status,transport_cost,inspection_cost,expected_date,updated_at,suppliers(name),purchase_items(id,description,order_item_id,quantity,unit_cost,accepted_qty),supplier_payments(amount)",
          )
          .neq("status", "cancelled"),
        supabaseAdmin.from("inventory_items").select("kind,quantity,unit_cost").is("archived_at", null),
        supabaseAdmin
          .from("production_jobs")
          .select("job_number,act_material_cost,act_labour_cost,act_overhead_cost")
          .eq("status", "completed")
          .gte("completed_at", fromIso)
          .lt("completed_at", toIso),
        supabaseAdmin.from("products").select("id,name").eq("is_available", true),
        supabaseAdmin.from("product_costs").select("product_id"),
      ]);
    const [loanRepaymentsInPeriod, allLoans, allRepayments] = await Promise.all([
      supabaseAdmin
        .from("loan_repayments")
        .select("principal,interest,method")
        .gte("paid_on", fromDay)
        .lte("paid_on", toDay),
      supabaseAdmin
        .from("capital_contributions")
        .select("*")
        .eq("source", "loan")
        .order("date", { ascending: true }),
      supabaseAdmin.from("loan_repayments").select("loan_id,principal,paid_on"),
    ]);
    if (payments.error) throw new Error(payments.error.message);
    if (openOrders.error) throw new Error(openOrders.error.message);

    // Sales by period (cash basis: completed payments, refunds shown separately).
    const series = new Map(bounds.keys.map((k) => [k, { received: 0, refunds: 0 }]));
    const bucketOf = (iso: string) => (bounds.bucket === "month" ? darMonthKey(iso) : darDayKey(iso));
    for (const p of payments.data ?? []) {
      const b = series.get(bucketOf(p.updated_at));
      if (b) b.received += Number(p.amount);
    }
    const refundRows = optionalRows(refunds);
    for (const r of refundRows ?? []) {
      const b = series.get(bucketOf(r.created_at));
      if (b) b.refunds += Number(r.amount);
    }

    // Sales by product and category: order lines of orders that received a payment in the period.
    const paidOrderIds = [...new Set((payments.data ?? []).map((p) => p.order_id))];
    const byProduct = new Map<string, { name: string; quantity: number; value: number }>();
    const byCategory = new Map<string, number>();
    if (paidOrderIds.length) {
      const { data: lines, error } = await supabaseAdmin
        .from("order_items")
        .select("product_id,product_name,quantity,unit_price,products(categories(name))")
        .in("order_id", paidOrderIds);
      if (error) throw new Error(error.message);
      for (const l of lines ?? []) {
        const value = Number(l.unit_price) * l.quantity;
        const key = l.product_id ?? l.product_name;
        const row = byProduct.get(key) ?? { name: l.product_name, quantity: 0, value: 0 };
        row.quantity += l.quantity;
        row.value += value;
        byProduct.set(key, row);
        const category = (l.products as { categories: { name: string } | null } | null)?.categories?.name ?? "Uncategorised";
        add(byCategory, category, value);
      }
    }

    // Cashbook.
    const cash: CashLine[] = [];
    for (const p of payments.data ?? []) cash.push({ direction: "in", kind: "Customer payments", method: methodOf(p), amount: Number(p.amount) });
    const capitalRows = optionalRows(capital);
    for (const c of capitalRows ?? []) {
      cash.push({
        direction: "in",
        kind: c.source === "loan" ? "Loans (not revenue)" : c.source === "gift" ? "Gifts / grants (not revenue)" : "Owner funds (not revenue)",
        method: "—",
        amount: Number(c.amount),
      });
    }
    const expenseRows = optionalRows(expenses);
    for (const e of expenseRows ?? []) cash.push({ direction: "out", kind: "Expenses", method: e.payment_method ?? "Other", amount: Number(e.amount) });
    const supplierRows = optionalRows(supplierPayments);
    for (const s of supplierRows ?? []) cash.push({ direction: "out", kind: "Supplier payments", method: s.method ?? "Other", amount: Number(s.amount) });
    for (const r of refundRows ?? []) cash.push({ direction: "out", kind: "Customer refunds", method: r.method ?? "Other", amount: Number(r.amount) });
    const repaymentRows = optionalRows(loanRepaymentsInPeriod);
    for (const r of repaymentRows ?? []) {
      if (Number(r.principal) > 0) {
        cash.push({ direction: "out", kind: "Loan repayments (principal)", method: r.method ?? "Other", amount: Number(r.principal) });
      }
      if (Number(r.interest) > 0) {
        cash.push({ direction: "out", kind: "Loan interest", method: r.method ?? "Other", amount: Number(r.interest) });
      }
    }
    const cashGroups = new Map<string, CashLine>();
    for (const line of cash) {
      const key = `${line.direction}|${line.kind}|${line.method}`;
      const g = cashGroups.get(key) ?? { ...line, amount: 0 };
      g.amount += line.amount;
      cashGroups.set(key, g);
    }
    const cashIn = cash.filter((c) => c.direction === "in").reduce((s, c) => s + c.amount, 0);
    const cashOut = cash.filter((c) => c.direction === "out").reduce((s, c) => s + c.amount, 0);

    // Receivables: what customers still owe on open orders.
    const receivables = (openOrders.data ?? [])
      .filter((o) => !o.archived_at && Number(o.amount_due) > 0 && Number(o.total_amount) > 0)
      .map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        status: o.status,
        amount_due: Number(o.amount_due),
        created_at: o.created_at,
      }))
      .sort((a, b) => b.amount_due - a.amount_due);

    // Payables: landed PO cost minus what has been paid to the supplier.
    type PoRow = PoForCost & {
      expected_date: string | null;
      suppliers: { name: string } | null;
      supplier_payments: { amount: number }[];
    };
    const poRows = optionalRows(pos as { data: PoRow[] | null; error: DbError });
    const payables = (poRows ?? [])
      .map((po) => {
        const goods = (po.purchase_items ?? []).reduce((s, l) => s + lineCost(l), 0);
        const landed = goods + Number(po.transport_cost) + Number(po.inspection_cost);
        const paid = (po.supplier_payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
        return {
          id: po.id,
          po_number: po.po_number,
          supplier: po.suppliers?.name ?? "—",
          status: po.status,
          expected_date: po.expected_date,
          landed,
          paid,
          balance: Math.max(0, landed - paid),
        };
      })
      .filter((p) => p.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    // Loans still owed today (not limited to the period).
    const loanRows = optionalRows(allLoans);
    const paidByLoan = new Map<string, { repaid: number; last: string | null }>();
    const allRepaymentRows = optionalRows(allRepayments);
    for (const r of allRepaymentRows ?? []) {
      const entry = paidByLoan.get(r.loan_id) ?? { repaid: 0, last: null };
      entry.repaid += Number(r.principal);
      if (!entry.last || r.paid_on > entry.last) entry.last = r.paid_on;
      paidByLoan.set(r.loan_id, entry);
    }
    const loansOwed = (loanRows ?? [])
      .map((l) => {
        const borrowed = Number(l.amount);
        const paid = paidByLoan.get(l.id);
        const dueDate = (l as { due_date?: string | null }).due_date ?? null;
        return {
          id: l.id,
          lender: l.contributor ?? "Loan",
          date: l.date,
          due_date: dueDate,
          borrowed,
          repaid: paid?.repaid ?? 0,
          outstanding: Math.max(0, borrowed - (paid?.repaid ?? 0)),
          last_paid_on: paid?.last ?? null,
          overdue: Boolean(dueDate && dueDate < today && borrowed - (paid?.repaid ?? 0) > 0),
        };
      })
      .filter((l) => l.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
    const overdueLoans = loansOwed.filter((l) => l.overdue);

    // Inventory value at average cost.
    const itemRows = optionalRows(items);
    const inventoryByKind = new Map<string, number>();
    for (const i of itemRows ?? []) {
      const qty = Number(i.quantity);
      if (qty > 0) add(inventoryByKind, i.kind, qty * Number(i.unit_cost));
    }
    const inventoryValue = [...inventoryByKind.values()].reduce((s, v) => s + v, 0);

    // Records-incomplete warnings.
    const warnings: string[] = [...pnl.gaps];
    if (overdueLoans.length) {
      warnings.push(`${overdueLoans.length} loan(s) are past their due date with a balance still owed.`);
    }
    if (loanRows !== null && allRepaymentRows === null && loanRows.length) {
      warnings.push("Loan repayments need migration 0009, so loans show the full amount borrowed.");
    }
    const jobRows = optionalRows(completedJobs);
    const zeroCostJobs = (jobRows ?? []).filter(
      (j) => Number(j.act_material_cost) + Number(j.act_labour_cost) + Number(j.act_overhead_cost) === 0,
    );
    if (zeroCostJobs.length) {
      const list = zeroCostJobs.slice(0, 5).map((j) => j.job_number).join(", ");
      warnings.push(`${zeroCostJobs.length} completed job(s) have no actual cost: ${list}${zeroCostJobs.length > 5 ? "…" : ""}.`);
    }
    const noReceipt = (expenseRows ?? []).filter((e) => !e.receipt_path);
    if (noReceipt.length) warnings.push(`${noReceipt.length} expense(s) in this period have no receipt attached.`);
    const feePending = (openOrders.data ?? []).filter(
      (o) => !o.archived_at && o.fulfilment_method === "delivery" && o.delivery_fee_status === "pending" && o.status !== "completed",
    );
    if (feePending.length) warnings.push(`${feePending.length} open order(s) still have a delivery fee to confirm.`);
    const costRows = optionalRows(costs);
    if (costRows !== null) {
      const costed = new Set(costRows.map((c) => c.product_id));
      const missing = (activeProducts.data ?? []).filter((p) => !costed.has(p.id));
      if (missing.length) warnings.push(`${missing.length} available product(s) have no internal cost price recorded.`);
    }
    if ((pnl.opexByCategory["materials"] ?? 0) > 0 && pnl.cogsProduction > 0) {
      warnings.push("Materials expenses are counted as operating expenses; if the same materials are in production job costs they are counted twice.");
    }
    if (pnl.available && jobRows !== null && poRows !== null) {
      const deliveredIds = (openOrders.data ?? [])
        .filter((o) => ["delivered", "completed"].includes(o.status) && paidOrderIds.includes(o.id))
        .map((o) => o.id);
      if (deliveredIds.length) {
        const [{ data: jobsFor }, { data: posFor }] = await Promise.all([
          supabaseAdmin.from("production_jobs").select("order_id").in("order_id", deliveredIds),
          supabaseAdmin.from("purchase_orders").select("order_id").in("order_id", deliveredIds),
        ]);
        const covered = new Set([...(jobsFor ?? []), ...(posFor ?? [])].map((r) => r.order_id));
        const uncosted = deliveredIds.filter((id) => !covered.has(id)).length;
        if (uncosted) warnings.push(`${uncosted} delivered/completed order(s) paid in this period have no production job or purchase order cost.`);
      }
    }

    return {
      bucket: bounds.bucket,
      from: darDayKey(bounds.from),
      to: darDayKey(bounds.to),
      today,
      basis:
        "Cash basis: revenue is customer payments completed in the period minus refunds made in the period. Capital and loans are not revenue; loan interest is an expense and loan principal repaid is cash out only.",
      pnl,
      trends: {
        revenue: trendPercent(pnl.revenue, pnlPrev.revenue),
        netProfit: pnl.available && pnlPrev.available ? trendPercent(pnl.netProfit, pnlPrev.netProfit) : null,
      },
      series: bounds.keys.map((key) => ({ key, ...(series.get(key) ?? { received: 0, refunds: 0 }) })),
      byProduct: [...byProduct.values()].sort((a, b) => b.value - a.value),
      byCategory: [...byCategory.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      cashbook: {
        available: capitalRows !== null && expenseRows !== null && supplierRows !== null && refundRows !== null,
        lines: [...cashGroups.values()].sort((a, b) => (a.direction === b.direction ? b.amount - a.amount : a.direction === "in" ? -1 : 1)),
        cashIn,
        cashOut,
        net: cashIn - cashOut,
      },
      receivables: { total: receivables.reduce((s, r) => s + r.amount_due, 0), rows: receivables },
      payables: { available: poRows !== null, total: payables.reduce((s, p) => s + p.balance, 0), rows: payables },
      loans: {
        available: loanRows !== null,
        repaymentsAvailable: allRepaymentRows !== null,
        total: loansOwed.reduce((s, l) => s + l.outstanding, 0),
        rows: loansOwed,
      },
      inventory: {
        available: itemRows !== null,
        total: inventoryValue,
        byKind: [...inventoryByKind.entries()].map(([kind, value]) => ({ kind, value })),
      },
      warnings,
    };
  });
