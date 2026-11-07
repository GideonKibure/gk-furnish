import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock3, Download, Receipt, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataTable,
  DateRangeSelect,
  FilterSelect,
  KpiCard,
  SearchInput,
  StatusPill,
  btn,
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import { downloadReceipt, purposeLabel } from "@/lib/invoice";
import { csvDate, downloadCsv } from "@/lib/ops/csv";
import { getAdminPaymentSummary, listAdminPayments } from "@/lib/ops/customers.functions";
import { rangeBounds, type DateRange } from "@/lib/ops/date-range";
import { humanize, paymentRecordTone } from "@/lib/ops/status";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminPaymentsPage,
});

type Row = Awaited<ReturnType<typeof listAdminPayments>>[number];
type StatusFilter = "all" | "completed" | "pending" | "failed";
type SourceFilter = "all" | Row["source"];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed / expired" },
];

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "Online (PalmPesa)", label: "Online (PalmPesa)" },
  { value: "Online (Snippe)", label: "Online (Snippe)" },
  { value: "Recorded by admin", label: "Recorded by admin" },
  { value: "Other", label: "Other" },
];

const METHOD_OPTIONS = [
  { value: "all", label: "All methods" },
  { value: "Mobile money", label: "Mobile money" },
  { value: "Cash", label: "Cash" },
  { value: "Bank transfer", label: "Bank transfer" },
] as const;

const PURPOSE_OPTIONS = [
  { value: "all", label: "All purposes" },
  { value: "advance", label: "Deposit" },
  { value: "balance", label: "Balance" },
  { value: "full", label: "Full payment" },
] as const;

/** Paid date: completed payments are stamped when they complete. */
function paidAt(p: Row) {
  return p.status === "completed" ? p.updated_at : p.created_at;
}

function AdminPaymentsPage() {
  const list = useServerFn(listAdminPayments);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState<DateRange | "all">("30d");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [method, setMethod] = useState<(typeof METHOD_OPTIONS)[number]["value"]>("all");
  const [purpose, setPurpose] = useState<(typeof PURPOSE_OPTIONS)[number]["value"]>("all");
  const [outstanding, setOutstanding] = useState<{ outstanding: number; openOrders: number } | null>(null);
  const summary = useServerFn(getAdminPaymentSummary);

  useEffect(() => {
    list()
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
    summary()
      .then(setOutstanding)
      .catch(() => setOutstanding(null));
  }, [list, summary]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const from = range === "all" ? null : rangeBounds(range).from.getTime();
    const term = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (from != null && new Date(paidAt(p)).getTime() < from) return false;
      if (status === "failed" ? !["failed", "expired"].includes(p.status) : status !== "all" && p.status !== status) return false;
      if (source !== "all" && p.source !== source) return false;
      if (method !== "all" && p.method !== method) return false;
      if (purpose !== "all" && p.purpose !== purpose) return false;
      if (!term) return true;
      return [p.receipt_number, p.orders?.order_number, p.orders?.customer_name, p.reference, p.snippe_reference, p.phone].some((v) =>
        v?.toLowerCase().includes(term),
      );
    });
  }, [rows, q, range, status, source, method, purpose]);

  const completed = shown.filter((p) => p.status === "completed");
  const pending = shown.filter((p) => p.status === "pending");

  function receipt(p: Row) {
    const order = p.orders;
    if (!order || !rows) return;
    const paidUpTo = rows
      .filter((x) => x.order_id === p.order_id && x.status === "completed" && x.updated_at <= p.updated_at)
      .reduce((s, x) => s + x.amount, 0);
    downloadReceipt({
      receiptNumber: p.receipt_number ?? `RCT-${order.order_number}`,
      orderNumber: order.order_number,
      paidAt: p.updated_at,
      amount: p.amount,
      purpose: p.purpose,
      method: p.method ?? "—",
      customerName: order.customer_name,
      phone: order.phone,
      ...(order.email ? { email: order.email } : {}),
      orderTotal: Number(order.total_amount),
      totalPaid: paidUpTo,
      lines: (order.order_items ?? []).map((i) => ({
        name: i.product_name,
        qty: i.quantity,
        unitPrice: Number(i.unit_price),
        details: [i.material, i.size, i.color].filter(Boolean).join(" · "),
      })),
    });
  }

  const columns: Column<Row>[] = [
    { key: "date", header: "Date", cell: (p) => <span className="whitespace-nowrap text-[#374151]">{formatDate(paidAt(p), true)}</span> },
    {
      key: "order",
      header: "Order",
      cell: (p) =>
        p.orders ? (
          <div className="min-w-0">
            <Link to="/admin/orders" search={{ q: p.orders.order_number }} className="font-semibold text-navy hover:underline">
              #{p.orders.order_number}
            </Link>
            <p className="truncate text-xs text-[#6B7280]">{p.orders.customer_name}</p>
          </div>
        ) : (
          "—"
        ),
    },
    {
      key: "kind",
      header: "Purpose",
      className: "hidden lg:table-cell",
      cell: (p) => (
        <div>
          <p className="text-navy">{purposeLabel(p.purpose)}</p>
          <p className="text-xs text-[#6B7280]">{p.method ?? p.source}</p>
        </div>
      ),
    },
    { key: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-semibold text-navy">{tzs(p.amount)}</span> },
    { key: "status", header: "Status", cell: (p) => <StatusPill tone={paymentRecordTone(p.status)}>{humanize(p.status)}</StatusPill> },
    {
      key: "receipt",
      header: "Receipt",
      align: "right",
      cell: (p) =>
        p.status === "completed" ? (
          <button type="button" className={btn("outline", "sm")} onClick={() => receipt(p)}>
            <Receipt className="h-3.5 w-3.5" /> {p.receipt_number ?? "Receipt"}
          </button>
        ) : (
          <span className="text-xs text-[#9CA3AF]">—</span>
        ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Payments"
        description="Every payment received online or recorded in the portal. To add or remove a payment, open the order."
        action={
          <button
            type="button"
            className={btn("outline")}
            disabled={!shown.length}
            onClick={() =>
              downloadCsv(
                `gk-payments-${new Date().toISOString().slice(0, 10)}`,
                ["Date", "Receipt", "Order", "Customer", "Purpose", "Method", "Source", "Status", "Amount (TZS)", "Reference"],
                shown.map((p) => [
                  csvDate(paidAt(p)),
                  p.receipt_number,
                  p.orders?.order_number,
                  p.orders?.customer_name,
                  purposeLabel(p.purpose),
                  p.method,
                  p.source,
                  p.status,
                  Math.round(p.amount),
                  p.reference,
                ]),
              )
            }
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Received"
          value={tzs(completed.reduce((s, p) => s + p.amount, 0))}
          hint={`${completed.length} completed payment${completed.length === 1 ? "" : "s"}`}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
        />
        <KpiCard
          label="Waiting to complete"
          value={tzs(pending.reduce((s, p) => s + p.amount, 0))}
          hint={`${pending.length} pending`}
          icon={<Clock3 className="h-5 w-5" />}
          tone="pending"
        />
        <KpiCard
          label="Recorded by admin"
          value={completed.filter((p) => p.source === "Recorded by admin").length}
          hint="Cash, bank and mobile money taken in person"
          icon={<Receipt className="h-5 w-5" />}
          tone="navy"
        />
        <KpiCard
          label="Still to collect"
          value={outstanding ? tzs(outstanding.outstanding) : "—"}
          hint={outstanding ? `${outstanding.openOrders} order${outstanding.openOrders === 1 ? "" : "s"} with a balance` : "Outstanding balances"}
          icon={<Wallet className="h-5 w-5" />}
          tone="pending"
        />
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SearchInput value={q} onChange={setQ} placeholder="Search receipt, order, customer or reference" className="sm:col-span-2 xl:col-span-2" />
        <DateRangeSelect value={range} onChange={setRange} allowAll />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} label="Payment status" />
        <FilterSelect value={source} onChange={setSource} options={SOURCE_OPTIONS} label="Payment source" />
        <FilterSelect value={method} onChange={setMethod} options={[...METHOD_OPTIONS]} label="Payment method" />
        <FilterSelect value={purpose} onChange={setPurpose} options={[...PURPOSE_OPTIONS]} label="Payment purpose" />
      </div>

      {!rows ? (
        <AdminLoading label="Loading payments…" />
      ) : (
        <DataTable
          rows={shown}
          columns={columns}
          rowKey={(p) => p.id}
          empty={<AdminEmpty title="No payments found">{rows.length ? "Try another date range or filter." : "Payments appear here once customers pay."}</AdminEmpty>}
          mobileCard={(p) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{p.orders ? `#${p.orders.order_number}` : "—"}</p>
                  <p className="truncate text-xs text-[#6B7280]">
                    {p.orders?.customer_name} · {purposeLabel(p.purpose)}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-[#6B7280]">{formatDate(paidAt(p))}</p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-navy">{tzs(p.amount)}</p>
                <StatusPill tone={paymentRecordTone(p.status)}>{humanize(p.status)}</StatusPill>
              </div>
              {p.status === "completed" && (
                <button type="button" className={btn("outline", "sm", "mt-2 w-full")} onClick={() => receipt(p)}>
                  <Receipt className="h-3.5 w-3.5" /> Download receipt {p.receipt_number ?? ""}
                </button>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}
