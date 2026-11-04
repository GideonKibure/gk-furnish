import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Factory, PieChart, ShoppingCart, Sparkles, Truck, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  ChartCard,
  DateRangeSelect,
  KpiCard,
  StatusPill,
  formatDate,
  tzs,
} from "@/components/admin/admin-ui";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { getAdminDashboard } from "@/lib/admin.functions";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/ops/business";
import { bucketLabel, DATE_RANGE_LABELS, type DateRange } from "@/lib/ops/date-range";
import { orderStatusLabel, orderStatusTone } from "@/lib/ops/status";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin dashboard — GK furnish" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminDashboard,
});

type Dashboard = Awaited<ReturnType<typeof getAdminDashboard>>;

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const chartConfig = { sales: { label: "Sales", color: "#FCA311" } } satisfies ChartConfig;

function SalesTooltip({
  active,
  payload,
  label,
  bucket,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string;
  bucket: "day" | "month";
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg bg-navy px-3 py-2 text-xs text-white shadow-lg">
      <p className="text-white/65">{bucketLabel(label, bucket)}</p>
      <p className="mt-0.5 text-sm font-semibold">{tzs(Number(payload[0]?.value ?? 0))}</p>
    </div>
  );
}

function SalesChart({ data }: { data: Dashboard }) {
  const total = data.series.reduce((s, p) => s + p.sales, 0);
  if (!total) {
    return (
      <div className="grid h-64 place-items-center rounded-lg bg-[#F9FAFB] text-sm text-[#6B7280]">
        No completed payments in this period yet.
      </div>
    );
  }
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FCA311" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#FCA311" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#EEF0F3" />
        <XAxis
          dataKey="key"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(key: string) => bucketLabel(key, data.bucket)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v: number) => compact.format(v)}
        />
        <ChartTooltip cursor={{ stroke: "#14213D", strokeDasharray: "3 3" }} content={<SalesTooltip bucket={data.bucket} />} />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#FCA311"
          strokeWidth={2.5}
          fill="url(#salesFill)"
          activeDot={{ r: 5, fill: "#FCA311", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function ActionList({
  title,
  icon,
  to,
  count,
  empty,
  children,
}: {
  title: string;
  icon: ReactNode;
  /** Phase 2 module routes are typed loosely (they live in their own route files). */
  to: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gold-soft text-[#B86A00]">{icon}</span>
          {title}
          {count > 0 && <StatusPill tone="pending">{count}</StatusPill>}
        </span>
      }
      action={
        <Link to={to as "/admin"} className="text-xs font-semibold text-[#B86A00] hover:underline">
          Open
        </Link>
      }
      bodyClassName="px-0 md:px-0 pb-2"
    >
      {count ? <ul className="divide-y divide-[#F0F0F0]">{children}</ul> : <p className="px-4 py-6 text-sm text-[#6B7280] md:px-5">{empty}</p>}
    </ChartCard>
  );
}

function ActionRow({ title, detail, href }: { title: string; detail: string; href: { to: "/admin/orders" | "/admin/custom-orders"; q: string } }) {
  return (
    <li>
      <Link to={href.to} search={{ q: href.q }} className="block px-4 py-2.5 hover:bg-[#F9FAFB] md:px-5">
        <p className="truncate text-sm font-semibold text-navy">{title}</p>
        <p className="truncate text-xs text-[#6B7280]">{detail}</p>
      </Link>
    </li>
  );
}

function AdminDashboard() {
  const load = useServerFn(getAdminDashboard);
  const [range, setRange] = useState<DateRange>("30d");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load({ data: { range } })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [load, range]);

  if (error && !data) {
    return (
      <div>
        <AdminPageHeader title="Dashboard" />
        <AdminNotice tone="danger">
          <p className="font-semibold">Could not load the dashboard</p>
          <p className="mt-1">{error}</p>
          {/forbidden/i.test(error) && (
            <p className="mt-1">
              Your sign-in is not listed in <code className="rounded bg-white px-1">admin_users</code>. See ADMIN_SETUP.md.
            </p>
          )}
        </AdminNotice>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Dashboard"
        description={`Sales and orders for the ${DATE_RANGE_LABELS[range].toLowerCase()}.`}
        action={<DateRangeSelect value={range} onChange={(v) => v !== "all" && setRange(v)} className="w-44" />}
      />

      {!data ? (
        <AdminLoading label="Loading dashboard…" />
      ) : (
        <div className={loading ? "space-y-5 opacity-60 transition-opacity" : "space-y-5 transition-opacity"}>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total orders"
              value={data.kpis.orders.toLocaleString("en-US")}
              icon={<ShoppingCart className="h-5 w-5" />}
              tone="gold"
              trend={data.kpis.ordersTrend}
            />
            <KpiCard
              label="Total sales"
              value={tzs(data.kpis.sales)}
              icon={<Wallet className="h-5 w-5" />}
              tone="success"
              trend={data.kpis.salesTrend}
            />
            <KpiCard
              label="Outstanding balances"
              value={tzs(data.kpis.outstanding)}
              icon={<Clock3 className="h-5 w-5" />}
              tone="pending"
              hint={`${data.kpis.outstandingOrders} open order${data.kpis.outstandingOrders === 1 ? "" : "s"} with a balance`}
            />
            {data.netProfit.available ? (
              <Link to={"/admin/reports" as "/admin"} className="block">
                <KpiCard
                  label={data.netProfit.incomplete ? "Net profit (records incomplete)" : "Net profit"}
                  value={tzs(data.netProfit.value)}
                  icon={<PieChart className="h-5 w-5" />}
                  tone={data.netProfit.value < 0 ? "danger" : "navy"}
                  trend={data.netProfit.trend}
                  className="h-full"
                />
              </Link>
            ) : (
              <KpiCard
                label="Net profit"
                value={<span className="text-[#9CA3AF]">—</span>}
                icon={<PieChart className="h-5 w-5" />}
                tone="navy"
                hint="Run migration 0008 to switch on costs, expenses and profit."
              />
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="Sales overview"
              description={`Completed payments, ${data.bucket === "month" ? "per month" : "per day"} (Dar es Salaam time)`}
            >
              <SalesChart data={data} />
            </ChartCard>

            <ChartCard
              title="Recent orders"
              action={
                <Link to="/admin/orders" className="inline-flex items-center gap-1 text-xs font-semibold text-[#B86A00] hover:underline">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
              bodyClassName="px-0 md:px-0 pb-2"
            >
              {data.recentOrders.length ? (
                <ul className="divide-y divide-[#F0F0F0]">
                  {data.recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link
                        to="/admin/orders"
                        search={{ q: o.order_number }}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#F9FAFB] md:px-5"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-navy">#{o.order_number}</span>
                          <span className="block truncate text-xs text-[#6B7280]">
                            {o.customer_name} · {formatDate(o.created_at)}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-semibold text-navy">{tzs(o.total_amount)}</span>
                          <StatusPill tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</StatusPill>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <AdminEmpty className="m-4 border-0 py-8">No orders yet.</AdminEmpty>
              )}
            </ChartCard>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ActionList
              title="Quotes to send"
              icon={<Sparkles className="h-4 w-4" />}
              to="/admin/custom-orders"
              count={data.customAwaitingCount}
              empty="Every custom request has an up-to-date quote."
            >
              {data.customAwaiting.map((c) => (
                <ActionRow
                  key={c.id}
                  title={`${c.request_number} · ${c.full_name}`}
                  detail={`${c.status === "changes_requested" ? "Changes requested" : "New request"} · ${c.furniture_type} · ${formatDate(c.created_at)}`}
                  href={{ to: "/admin/custom-orders", q: c.request_number }}
                />
              ))}
            </ActionList>
            <ActionList
              title="Quote accepted"
              icon={<CheckCircle2 className="h-4 w-4" />}
              to="/admin/custom-orders"
              count={data.customAcceptedCount}
              empty="No accepted quotes waiting to start."
            >
              {data.customAccepted.map((c) => (
                <ActionRow
                  key={c.id}
                  title={`${c.request_number} · ${c.full_name}`}
                  detail={`${c.furniture_type} · collect the advance and start`}
                  href={{ to: "/admin/custom-orders", q: c.request_number }}
                />
              ))}
            </ActionList>
            <ActionList
              title="Waiting for advance"
              icon={<Wallet className="h-4 w-4" />}
              to="/admin/orders"
              count={data.awaitingAdvance.length}
              empty="No orders are waiting for an advance."
            >
              {data.awaitingAdvance.map((o) => (
                <ActionRow
                  key={o.id}
                  title={`#${o.order_number} · ${o.customer_name}`}
                  detail={`${tzs(o.advance_left)} advance still due`}
                  href={{ to: "/admin/orders", q: o.order_number }}
                />
              ))}
            </ActionList>
            <ActionList
              title="Delivery fee to confirm"
              icon={<Truck className="h-4 w-4" />}
              to="/admin/orders"
              count={data.feeToConfirm.length}
              empty="No delivery fees waiting."
            >
              {data.feeToConfirm.map((o) => (
                <ActionRow
                  key={o.id}
                  title={`#${o.order_number} · ${o.customer_name}`}
                  detail={o.delivery_location}
                  href={{ to: "/admin/orders", q: o.order_number }}
                />
              ))}
            </ActionList>
            <ActionList
              title="Low stock"
              icon={<AlertTriangle className="h-4 w-4" />}
              to={data.lowStockSource === "inventory" ? "/admin/inventory" : "/admin/products"}
              count={data.lowStockCount}
              empty={data.lowStockSource === "inventory" ? "Nothing is at or below its reorder level." : "Stock levels look healthy."}
            >
              {data.lowStockItems.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5">
                  <span className="truncate text-sm font-medium text-navy">{p.name}</span>
                  <StatusPill tone={p.out ? "danger" : "pending"}>{p.label}</StatusPill>
                </li>
              ))}
            </ActionList>
            {data.overdueJobs.available && (
              <ActionList
                title="Overdue production"
                icon={<Factory className="h-4 w-4" />}
                to="/admin/production"
                count={data.overdueJobs.count}
                empty="No production jobs are past their target date."
              >
                {data.overdueJobs.rows.map((j) => (
                  <li key={j.id}>
                    <a href={`/admin/production?job=${j.id}`} className="block px-4 py-2.5 hover:bg-[#F9FAFB] md:px-5">
                      <p className="truncate text-sm font-semibold text-navy">
                        {j.job_number} · {j.description}
                      </p>
                      <p className="truncate text-xs text-[#DC2626]">
                        Due {j.target_date ? formatDate(j.target_date) : "—"} · {JOB_STATUS_LABELS[j.status as JobStatus] ?? j.status}
                      </p>
                    </a>
                  </li>
                ))}
              </ActionList>
            )}
            {data.overduePos.available && (
              <ActionList
                title="Overdue purchase orders"
                icon={<ShoppingCart className="h-4 w-4" />}
                to="/admin/purchases"
                count={data.overduePos.count}
                empty="No supplier deliveries are late."
              >
                {data.overduePos.rows.map((p) => (
                  <li key={p.id}>
                    <a href={`/admin/purchases?po=${p.id}`} className="block px-4 py-2.5 hover:bg-[#F9FAFB] md:px-5">
                      <p className="truncate text-sm font-semibold text-navy">
                        {p.po_number} · {p.supplier ?? "Supplier"}
                      </p>
                      <p className="truncate text-xs text-[#DC2626]">Expected {p.expected_date ? formatDate(p.expected_date) : "—"}</p>
                    </a>
                  </li>
                ))}
              </ActionList>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
