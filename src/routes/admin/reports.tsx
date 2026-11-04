import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, PieChart, Receipt, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  ChartCard,
  DataTable,
  KpiCard,
  StatusPill,
  adminInput,
  btn,
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { EXPENSE_CATEGORY_LABELS, INVENTORY_KIND_LABELS, PO_STATUS_LABELS, type ExpenseCategory, type InventoryKind, type PoStatus } from "@/lib/ops/business";
import { downloadCsv } from "@/lib/ops/csv";
import { bucketLabel, DATE_RANGE_LABELS, DATE_RANGES, type DateRange } from "@/lib/ops/date-range";
import { getReports } from "@/lib/ops/reports.functions";
import { humanize, orderStatusLabel, orderStatusTone } from "@/lib/ops/status";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminReportsPage,
});

type Report = Awaited<ReturnType<typeof getReports>>;
type Choice = DateRange | "custom";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const salesConfig = { received: { label: "Received", color: "#FCA311" }, refunds: { label: "Refunds", color: "#DC2626" } } satisfies ChartConfig;
const categoryConfig = { value: { label: "Sales", color: "#14213D" } } satisfies ChartConfig;

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function CsvButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={btn("ghost", "sm")} onClick={onClick} disabled={disabled}>
      <Download className="h-3.5 w-3.5" /> CSV
    </button>
  );
}

function ChartTip({ active, payload, label, bucket }: { active?: boolean; payload?: { name?: string; value?: number | string }[]; label?: string; bucket: "day" | "month" }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg bg-navy px-3 py-2 text-xs text-white shadow-lg">
      <p className="text-white/65">{bucketLabel(label, bucket)}</p>
      {payload.map((p) => (
        <p key={p.name} className="mt-0.5 font-semibold">
          {p.name === "refunds" ? "Refunds" : "Received"}: {tzs(Number(p.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

function StatementRow({ label, value, strong, indent, negative }: { label: ReactNode; value: number; strong?: boolean; indent?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 text-sm ${strong ? "border-t border-[#E5E5E5] pt-2 font-semibold text-navy" : "text-[#374151]"}`}>
      <span className={indent ? "pl-4" : ""}>{label}</span>
      <span className={value < 0 ? "text-[#DC2626]" : ""}>
        {negative && value > 0 ? "−" : ""}
        {tzs(Math.abs(value))}
        {value < 0 && !negative ? " loss" : ""}
      </span>
    </div>
  );
}

function AdminReportsPage() {
  const load = useServerFn(getReports);
  const [choice, setChoice] = useState<Choice>("30d");
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const input = choice === "custom" ? { from, to } : { range: choice };
    load({ data: input })
      .then((r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load reports"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [load, choice, from, to]);

  const label = data ? `${formatDate(data.from)} – ${formatDate(data.to)}` : "";
  const file = (name: string) => `gk-${name}-${data?.from ?? stamp()}-to-${data?.to ?? stamp()}`;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Reports"
        description="Sales, profit and loss, cash, money owed and stock value for a period."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select value={choice} onChange={(e) => setChoice(e.target.value as Choice)} className={`${adminInput} w-44`} aria-label="Report period">
              {DATE_RANGES.map((r) => (
                <option key={r} value={r}>
                  {DATE_RANGE_LABELS[r]}
                </option>
              ))}
              <option value="custom">Custom dates</option>
            </select>
            {choice === "custom" && (
              <>
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${adminInput} w-40`} aria-label="From" />
                <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${adminInput} w-40`} aria-label="To" />
              </>
            )}
          </div>
        }
      />

      {error && !data && <AdminNotice tone="danger">{error}</AdminNotice>}
      {!data ? (
        !error && <AdminLoading label="Building reports…" />
      ) : (
        <div className={loading ? "space-y-5 opacity-60 transition-opacity" : "space-y-5 transition-opacity"}>
          <AdminNotice>
            <span className="font-semibold">{label}.</span> {data.basis}
          </AdminNotice>
          {!data.pnl.available && (
            <AdminNotice tone="pending">
              Costs, expenses, refunds, purchasing and stock value appear once drizzle/migrations/0008_business_operations.sql has been run.
              Sales and receivables below are already complete.
            </AdminNotice>
          )}
          {data.warnings.length > 0 && (
            <AdminNotice tone="pending">
              <p className="font-semibold">Records may be incomplete</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {data.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AdminNotice>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Revenue (cash)" value={tzs(data.pnl.revenue)} icon={<Wallet className="h-5 w-5" />} tone="success" trend={data.trends.revenue} />
            <KpiCard
              label="Gross profit"
              value={data.pnl.available ? tzs(data.pnl.grossProfit) : "—"}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="gold"
              hint={data.pnl.grossMargin != null && data.pnl.available ? `${data.pnl.grossMargin}% margin` : "Needs cost records"}
            />
            <KpiCard
              label="Operating expenses"
              value={data.pnl.available ? tzs(data.pnl.opex) : "—"}
              icon={<Receipt className="h-5 w-5" />}
              tone="pending"
              hint="Recorded expenses in the period"
            />
            <KpiCard
              label="Net profit"
              value={data.pnl.available ? tzs(data.pnl.netProfit) : "—"}
              icon={<PieChart className="h-5 w-5" />}
              tone={data.pnl.netProfit < 0 ? "danger" : "navy"}
              {...(data.pnl.available ? { trend: data.trends.netProfit } : { hint: "Run migration 0008" })}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <ChartCard
              title="Profit and loss"
              description="Cash basis"
              action={
                <CsvButton
                  onClick={() =>
                    downloadCsv(file("profit-and-loss"), ["Line", "Amount (TSh)"], [
                      ["Customer payments received", Math.round(data.pnl.received)],
                      ["Refunds", -Math.round(data.pnl.refunds)],
                      ["Revenue", Math.round(data.pnl.revenue)],
                      ["Production costs (completed jobs)", -Math.round(data.pnl.cogsProduction)],
                      ["Partner goods for orders (landed)", -Math.round(data.pnl.cogsPartner)],
                      ["Gross profit", Math.round(data.pnl.grossProfit)],
                      ...Object.entries(data.pnl.opexByCategory).map(([k, v]): (string | number)[] => [
                        `Expense: ${EXPENSE_CATEGORY_LABELS[k as ExpenseCategory] ?? humanize(k)}`,
                        -Math.round(v),
                      ]),
                      ["Net profit", Math.round(data.pnl.netProfit)],
                    ])
                  }
                />
              }
            >
              <StatementRow label="Customer payments received" value={data.pnl.received} />
              <StatementRow label="Refunds" value={data.pnl.refunds} indent negative />
              <StatementRow label="Revenue" value={data.pnl.revenue} strong />
              <StatementRow label="Production costs (completed jobs)" value={data.pnl.cogsProduction} indent negative />
              <StatementRow label="Partner goods for orders (landed)" value={data.pnl.cogsPartner} indent negative />
              <StatementRow label="Gross profit" value={data.pnl.grossProfit} strong />
              {Object.entries(data.pnl.opexByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <StatementRow key={k} label={EXPENSE_CATEGORY_LABELS[k as ExpenseCategory] ?? humanize(k)} value={v} indent negative />
                ))}
              {!Object.keys(data.pnl.opexByCategory).length && <p className="py-1.5 pl-4 text-xs text-[#6B7280]">No expenses recorded.</p>}
              <StatementRow label="Net profit" value={data.pnl.netProfit} strong />
            </ChartCard>

            <ChartCard
              className="xl:col-span-2"
              title="Sales over time"
              description={`Completed payments and refunds ${data.bucket === "month" ? "per month" : "per day"} (Dar es Salaam time)`}
              action={
                <CsvButton
                  onClick={() =>
                    downloadCsv(
                      file("sales-by-period"),
                      ["Period", "Received (TSh)", "Refunds (TSh)"],
                      data.series.map((s) => [s.key, Math.round(s.received), Math.round(s.refunds)]),
                    )
                  }
                />
              }
            >
              {data.series.some((s) => s.received || s.refunds) ? (
                <ChartContainer config={salesConfig} className="aspect-auto h-64 w-full">
                  <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FCA311" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#FCA311" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#EEF0F3" />
                    <XAxis dataKey="key" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(k: string) => bucketLabel(k, data.bucket)} />
                    <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compact.format(v)} />
                    <ChartTooltip content={<ChartTip bucket={data.bucket} />} />
                    <Area type="monotone" dataKey="received" stroke="#FCA311" strokeWidth={2.5} fill="url(#reportFill)" />
                    <Area type="monotone" dataKey="refunds" stroke="#DC2626" strokeWidth={1.5} fill="transparent" />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="grid h-64 place-items-center rounded-lg bg-[#F9FAFB] text-sm text-[#6B7280]">No payments in this period.</div>
              )}
            </ChartCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Sales by product"
              description="Order lines of orders that received a payment in the period (order value, not cash)"
              action={
                <CsvButton
                  disabled={!data.byProduct.length}
                  onClick={() =>
                    downloadCsv(file("sales-by-product"), ["Product", "Units", "Order value (TSh)"], data.byProduct.map((p) => [p.name, p.quantity, Math.round(p.value)]))
                  }
                />
              }
              bodyClassName="px-0 md:px-0"
            >
              <DataTable
                className="px-4 md:px-5"
                rows={data.byProduct.slice(0, 15)}
                rowKey={(p) => p.name}
                columns={[
                  { key: "name", header: "Product", cell: (p) => <span className="font-medium text-navy">{p.name}</span> },
                  { key: "qty", header: "Units", align: "right", cell: (p) => p.quantity },
                  { key: "value", header: "Order value", align: "right", cell: (p) => tzs(p.value) },
                ]}
                mobileCard={(p) => (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-navy">
                      {p.quantity}× {p.name}
                    </span>
                    <span className="font-semibold text-navy">{tzs(p.value)}</span>
                  </div>
                )}
                empty={<p className="px-4 py-6 text-sm text-[#6B7280] md:px-5">No paid orders in this period.</p>}
              />
            </ChartCard>

            <ChartCard
              title="Sales by category"
              description="Same basis as sales by product"
              action={
                <CsvButton
                  disabled={!data.byCategory.length}
                  onClick={() => downloadCsv(file("sales-by-category"), ["Category", "Order value (TSh)"], data.byCategory.map((c) => [c.name, Math.round(c.value)]))}
                />
              }
            >
              {data.byCategory.length ? (
                <ChartContainer config={categoryConfig} className="aspect-auto h-64 w-full">
                  <BarChart data={data.byCategory} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="#EEF0F3" />
                    <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v: number) => compact.format(v)} />
                    <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={110} />
                    <ChartTooltip cursor={{ fill: "#F5F6F8" }} formatter={(v) => tzs(Number(v))} />
                    <Bar dataKey="value" fill="#14213D" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="grid h-64 place-items-center rounded-lg bg-[#F9FAFB] text-sm text-[#6B7280]">No paid orders in this period.</div>
              )}
            </ChartCard>
          </section>

          <Cashbook data={data} file={file} />

          <section className="grid gap-4 xl:grid-cols-2">
            <Receivables data={data} file={file} />
            <Payables data={data} file={file} />
          </section>

          <LoansOwed data={data} file={file} />

          <ChartCard
            title="Inventory value"
            description="Quantity × average unit cost of items in stock"
            action={
              <CsvButton
                disabled={!data.inventory.byKind.length}
                onClick={() =>
                  downloadCsv(file("inventory-value"), ["Kind", "Value (TSh)"], data.inventory.byKind.map((k) => [INVENTORY_KIND_LABELS[k.kind as InventoryKind] ?? k.kind, Math.round(k.value)]))
                }
              />
            }
          >
            {!data.inventory.available ? (
              <p className="text-sm text-[#6B7280]">Needs migration 0008.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <div className="rounded-lg bg-[#F9FAFB] px-4 py-3">
                  <p className="text-xs text-[#6B7280]">Total</p>
                  <p className="text-lg font-bold text-navy">{tzs(data.inventory.total)}</p>
                </div>
                {data.inventory.byKind.map((k) => (
                  <div key={k.kind} className="rounded-lg border border-[#E5E5E5] px-4 py-3">
                    <p className="text-xs text-[#6B7280]">{INVENTORY_KIND_LABELS[k.kind as InventoryKind] ?? k.kind}</p>
                    <p className="text-base font-semibold text-navy">{tzs(k.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function Cashbook({ data, file }: { data: Report; file: (name: string) => string }) {
  const lines = data.cashbook.lines;
  const columns: Column<(typeof lines)[number]>[] = [
    {
      key: "dir",
      header: "",
      cell: (l) => <StatusPill tone={l.direction === "in" ? "success" : "danger"}>{l.direction === "in" ? "In" : "Out"}</StatusPill>,
    },
    { key: "kind", header: "Type", cell: (l) => <span className="font-medium text-navy">{l.kind}</span> },
    { key: "method", header: "Method", cell: (l) => l.method },
    { key: "amount", header: "Amount", align: "right", cell: (l) => <span className="font-semibold text-navy">{tzs(l.amount)}</span> },
  ];
  return (
    <ChartCard
      title="Cashbook"
      description="Money in and out by type and method. Capital and loans are cash in but not revenue."
      action={
        <CsvButton
          disabled={!lines.length}
          onClick={() =>
            downloadCsv(file("cashbook"), ["Direction", "Type", "Method", "Amount (TSh)"], lines.map((l) => [l.direction, l.kind, l.method, Math.round(l.amount)]))
          }
        />
      }
    >
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="rounded-lg bg-[#F0FDF4] px-4 py-2.5">
          <p className="text-xs text-[#15803D]">Cash in</p>
          <p className="text-base font-bold text-navy">{tzs(data.cashbook.cashIn)}</p>
        </div>
        <div className="rounded-lg bg-[#FEF2F2] px-4 py-2.5">
          <p className="text-xs text-[#DC2626]">Cash out</p>
          <p className="text-base font-bold text-navy">{tzs(data.cashbook.cashOut)}</p>
        </div>
        <div className="rounded-lg bg-[#F9FAFB] px-4 py-2.5">
          <p className="text-xs text-[#6B7280]">Net cash</p>
          <p className={`text-base font-bold ${data.cashbook.net < 0 ? "text-[#DC2626]" : "text-navy"}`}>{tzs(data.cashbook.net)}</p>
        </div>
      </div>
      {!data.cashbook.available && <p className="mb-2 text-xs text-[#6B7280]">Expenses, supplier payments, refunds and capital need migration 0008.</p>}
      <DataTable
        rows={lines}
        rowKey={(l) => `${l.direction}-${l.kind}-${l.method}`}
        columns={columns}
        mobileCard={(l) => (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>
              <StatusPill tone={l.direction === "in" ? "success" : "danger"}>{l.direction === "in" ? "In" : "Out"}</StatusPill>{" "}
              <span className="font-medium text-navy">{l.kind}</span> <span className="text-xs text-[#6B7280]">{l.method}</span>
            </span>
            <span className="font-semibold text-navy">{tzs(l.amount)}</span>
          </div>
        )}
        empty={<p className="py-4 text-sm text-[#6B7280]">No money moved in this period.</p>}
      />
    </ChartCard>
  );
}

function Receivables({ data, file }: { data: Report; file: (name: string) => string }) {
  const rows = data.receivables.rows;
  return (
    <ChartCard
      title={`Customers owe ${tzs(data.receivables.total)}`}
      description="Open order balances today (not limited to the period)"
      action={
        <CsvButton
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(file("receivables"), ["Order", "Customer", "Status", "Balance (TSh)", "Placed"], rows.map((r) => [r.order_number, r.customer_name, r.status, Math.round(r.amount_due), r.created_at.slice(0, 10)]))
          }
        />
      }
    >
      <DataTable
        rows={rows.slice(0, 12)}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "order",
            header: "Order",
            cell: (r) => (
              <a href={`/admin/orders?q=${encodeURIComponent(r.order_number)}`} className="font-semibold text-navy hover:underline">
                #{r.order_number}
              </a>
            ),
          },
          { key: "customer", header: "Customer", cell: (r) => r.customer_name },
          { key: "status", header: "Status", cell: (r) => <StatusPill tone={orderStatusTone(r.status)}>{orderStatusLabel(r.status)}</StatusPill> },
          { key: "due", header: "Balance", align: "right", cell: (r) => <span className="font-semibold text-navy">{tzs(r.amount_due)}</span> },
        ]}
        mobileCard={(r) => (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-semibold text-navy">#{r.order_number}</span> <span className="text-xs text-[#6B7280]">{r.customer_name}</span>
            </span>
            <span className="font-semibold text-navy">{tzs(r.amount_due)}</span>
          </div>
        )}
        empty={<p className="py-4 text-sm text-[#6B7280]">Nothing owed.</p>}
      />
    </ChartCard>
  );
}

function LoansOwed({ data, file }: { data: Report; file: (name: string) => string }) {
  const rows = data.loans.rows;
  return (
    <ChartCard
      title={`We owe lenders ${tzs(data.loans.total)}`}
      description="Amount borrowed minus principal repaid, today (not limited to the period). Interest is shown under expenses."
      action={
        <CsvButton
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(
              file("loans-owed"),
              ["Lender", "Borrowed on", "Due", "Borrowed (TSh)", "Repaid (TSh)", "Still owed (TSh)", "Last repayment"],
              rows.map((l) => [l.lender, l.date, l.due_date, Math.round(l.borrowed), Math.round(l.repaid), Math.round(l.outstanding), l.last_paid_on]),
            )
          }
        />
      }
    >
      {!data.loans.available ? (
        <p className="text-sm text-[#6B7280]">Needs migration 0008.</p>
      ) : (
        <>
          {!data.loans.repaymentsAvailable && (
            <p className="mb-2 text-xs text-[#6B7280]">Run migration 0009 to record repayments. Until then each loan shows the full amount borrowed.</p>
          )}
          <DataTable
            rows={rows.slice(0, 12)}
            rowKey={(l) => l.id}
            columns={[
              {
                key: "lender",
                header: "Lender",
                cell: (l) => (
                  <a href="/admin/finance" className="font-semibold text-navy hover:underline">
                    {l.lender}
                  </a>
                ),
              },
              { key: "borrowed", header: "Borrowed", align: "right", className: "hidden md:table-cell", cell: (l) => tzs(l.borrowed) },
              { key: "repaid", header: "Repaid", align: "right", className: "hidden md:table-cell", cell: (l) => tzs(l.repaid) },
              {
                key: "due",
                header: "Due",
                cell: (l) =>
                  l.due_date ? <StatusPill tone={l.overdue ? "danger" : "neutral"}>{l.overdue ? `Overdue · ${l.due_date}` : l.due_date}</StatusPill> : "—",
              },
              { key: "owed", header: "Still owed", align: "right", cell: (l) => <span className="font-semibold text-navy">{tzs(l.outstanding)}</span> },
            ]}
            mobileCard={(l) => (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-navy">{l.lender}</span>{" "}
                  <span className={`text-xs ${l.overdue ? "text-[#DC2626]" : "text-[#6B7280]"}`}>
                    {l.overdue ? "Overdue" : l.due_date ? `Due ${l.due_date}` : `Repaid ${tzs(l.repaid)}`}
                  </span>
                </span>
                <span className="font-semibold text-navy">{tzs(l.outstanding)}</span>
              </div>
            )}
            empty={<p className="py-4 text-sm text-[#6B7280]">No loan balances.</p>}
          />
        </>
      )}
    </ChartCard>
  );
}

function Payables({ data, file }: { data: Report; file: (name: string) => string }) {
  const rows = data.payables.rows;
  return (
    <ChartCard
      title={`We owe suppliers ${tzs(data.payables.total)}`}
      description="Landed PO cost (goods + transport + inspection) minus supplier payments"
      action={
        <CsvButton
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(file("payables"), ["PO", "Supplier", "Status", "Landed (TSh)", "Paid (TSh)", "Balance (TSh)"], rows.map((p) => [p.po_number, p.supplier, p.status, Math.round(p.landed), Math.round(p.paid), Math.round(p.balance)]))
          }
        />
      }
    >
      {!data.payables.available ? (
        <p className="text-sm text-[#6B7280]">Needs migration 0008.</p>
      ) : (
        <DataTable
          rows={rows.slice(0, 12)}
          rowKey={(p) => p.id}
          columns={[
            {
              key: "po",
              header: "PO",
              cell: (p) => (
                <a href={`/admin/purchases?po=${p.id}`} className="font-semibold text-navy hover:underline">
                  {p.po_number}
                </a>
              ),
            },
            { key: "supplier", header: "Supplier", cell: (p) => p.supplier },
            { key: "status", header: "Status", cell: (p) => PO_STATUS_LABELS[p.status as PoStatus] ?? humanize(p.status) },
            { key: "balance", header: "Balance", align: "right", cell: (p) => <span className="font-semibold text-navy">{tzs(p.balance)}</span> },
          ]}
          mobileCard={(p) => (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-semibold text-navy">{p.po_number}</span> <span className="text-xs text-[#6B7280]">{p.supplier}</span>
              </span>
              <span className="font-semibold text-navy">{tzs(p.balance)}</span>
            </div>
          )}
          empty={<p className="py-4 text-sm text-[#6B7280]">No supplier balances.</p>}
        />
      )}
    </ChartCard>
  );
}
