import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArchiveRestore, Download, Phone, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  DataTable,
  DateRangeSelect,
  Field,
  FilterSelect,
  SearchInput,
  StatusPill,
  StatusTabs,
  btn,
  formatDate,
  tzs,
  type Column,
} from "@/components/admin/admin-ui";
import { DeliveryFeePanel } from "@/components/admin/DeliveryFeePanel";
import { CancelOrderButton, OrderOpsPanel } from "@/components/admin/OrderOpsPanel";
import { OrderPolicyPanel } from "@/components/admin/OrderPolicyPanel";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatPrice } from "@/config/site";
import { colorSwatch } from "@/lib/color-swatches";
import { csvDate, downloadCsv } from "@/lib/ops/csv";
import { rangeBounds, type DateRange } from "@/lib/ops/date-range";
import {
  ORDER_STATUSES,
  ORDER_STATUSES_0008,
  ORDER_STATUSES_BY_ACTION,
  ORDER_TABS,
  PAYMENT_STATE_LABELS,
  PAYMENT_STATE_TONES,
  deliveryFeeLabel,
  deliveryFeeTone,
  orderStatusLabel,
  orderStatusTone,
  paymentState,
  type OrderStatus,
  type OrderTab,
  type PaymentState,
} from "@/lib/ops/status";
import { parseCatalogColor } from "@/lib/order-options";
import { deliveryFeePending } from "@/lib/payment-policy";
import {
  createAdminOrder,
  deleteAdminOrder,
  listAdminOrders,
  listAdminProducts,
  setOrderArchived,
  updateOrderStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/orders")({
  validateSearch: (s: Record<string, unknown>): { q?: string } =>
    typeof s["q"] === "string" && s["q"].trim() ? { q: s["q"].trim().slice(0, 80) } : {},
  head: () => ({ meta: [{ title: "Orders — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminOrdersPage,
});

type OrderRow = Awaited<ReturnType<typeof listAdminOrders>>[number];
type ProductOpt = Awaited<ReturnType<typeof listAdminProducts>>[number];

const PAYMENT_FILTERS: { value: "all" | PaymentState; label: string }[] = [
  { value: "all", label: "All payments" },
  { value: "unpaid", label: "Unpaid" },
  { value: "pending", label: "Payment pending" },
  { value: "advance", label: "Advance paid" },
  { value: "full", label: "Paid in full" },
  { value: "failed", label: "Payment failed" },
];

function dialHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function OrderColor({ value }: { value: string | null }) {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const color = parseCatalogColor(raw);
  const named = color.label !== color.hex;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-4 w-4 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
        style={{
          background: color.hex ?? undefined,
          backgroundImage: color.hex ? undefined : `url("${colorSwatch(color.label)}")`,
          backgroundSize: "cover",
        }}
        role="img"
        aria-label={named ? color.label : "Selected colour"}
      />
      <span className="text-[#374151]">{named ? color.label : "Selected colour"}</span>
    </span>
  );
}

function matches(o: OrderRow, q: string) {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\D/g, "");
  return (
    o.order_number.toLowerCase().includes(term.replace(/^#/, "")) ||
    o.customer_name.toLowerCase().includes(term) ||
    (o.email ?? "").toLowerCase().includes(term) ||
    (digits.length >= 3 && o.phone.replace(/\D/g, "").includes(digits))
  );
}

/** Statuses offered in the select: no action-only ones, and 0008 statuses only once it has run. */
function selectableStatuses(o: { status: string }, has0008: boolean) {
  return ORDER_STATUSES.filter(
    (s) => s === o.status || (!ORDER_STATUSES_BY_ACTION.includes(s) && (has0008 || !ORDER_STATUSES_0008.includes(s))),
  );
}

function feePending(o: OrderRow) {
  return deliveryFeePending({ fulfilment_method: o.fulfilment_method, delivery_fee_status: o.delivery_fee_status });
}

function AdminOrdersPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/orders" });
  const list = useServerFn(listAdminOrders);
  const listProducts = useServerFn(listAdminProducts);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [tab, setTab] = useState<OrderTab>("all");
  const [q, setQ] = useState(search.q ?? "");
  const [range, setRange] = useState<DateRange | "all">("all");
  const [payment, setPayment] = useState<"all" | PaymentState>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setOrders(await list());
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  useEffect(() => {
    if (search.q) setQ(search.q);
  }, [search.q]);

  // Open the order straight away when the search is an exact order number (top-bar search, dashboard links).
  useEffect(() => {
    if (!orders || !search.q) return;
    const exact = orders.find((o) => o.order_number.toLowerCase() === search.q!.toLowerCase().replace(/^#/, ""));
    if (exact) {
      setOpenId(exact.id);
      void navigate({ search: {}, replace: true });
    }
  }, [orders, search.q]);

  const canArchive = Boolean(orders?.length && orders.every((o) => o.archived_at !== undefined));

  const base = useMemo(() => {
    if (!orders) return [];
    const from = range === "all" ? null : rangeBounds(range).from.getTime();
    return orders.filter((o) => {
      if (!showArchived && o.archived_at) return false;
      if (showArchived && canArchive && !o.archived_at) return false;
      if (from != null && new Date(o.created_at).getTime() < from) return false;
      if (payment !== "all" && paymentState(o) !== payment) return false;
      return matches(o, q);
    });
  }, [orders, range, payment, q, showArchived, canArchive]);

  const tabs = ORDER_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    count: t.statuses ? base.filter((o) => (t.statuses as readonly string[]).includes(o.status)).length : base.length,
  }));
  const activeTab = ORDER_TABS.find((t) => t.id === tab);
  const filtered = activeTab?.statuses ? base.filter((o) => (activeTab.statuses as readonly string[]).includes(o.status)) : base;
  const open = orders?.find((o) => o.id === openId) ?? null;

  function exportCsv() {
    downloadCsv(
      `gk-orders-${new Date().toISOString().slice(0, 10)}`,
      [
        "Order",
        "Date",
        "Customer",
        "Phone",
        "Email",
        "Status",
        "Payment",
        "Fulfilment",
        "Location",
        "Goods (TSh)",
        "Delivery fee (TSh)",
        "Total (TSh)",
        "Paid (TSh)",
        "Balance (TSh)",
      ],
      filtered.map((o) => [
        o.order_number,
        csvDate(o.created_at),
        o.customer_name,
        o.phone,
        o.email,
        orderStatusLabel(o.status),
        PAYMENT_STATE_LABELS[paymentState(o)],
        o.fulfilment_method ?? "",
        o.delivery_location,
        o.subtotal_amount ?? "",
        o.delivery_fee ?? "",
        Number(o.total_amount),
        Number(o.amount_paid),
        Number(o.amount_due),
      ]),
    );
  }

  const columns: Column<OrderRow>[] = [
    {
      key: "order",
      header: "Order",
      cell: (o) => (
        <div>
          <p className="font-semibold text-navy">#{o.order_number}</p>
          <p className="text-xs text-[#6B7280]">{formatDate(o.created_at)}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-navy">{o.customer_name}</p>
          <p className="text-xs text-[#6B7280]">{o.phone}</p>
        </div>
      ),
    },
    { key: "total", header: "Total", align: "right", cell: (o) => <span className="font-semibold text-navy">{tzs(Number(o.total_amount))}</span> },
    {
      key: "payment",
      header: "Payment",
      cell: (o) => <StatusPill tone={PAYMENT_STATE_TONES[paymentState(o)]}>{PAYMENT_STATE_LABELS[paymentState(o)]}</StatusPill>,
    },
    {
      key: "delivery",
      header: "Delivery",
      className: "hidden xl:table-cell",
      cell: (o) =>
        o.delivery_fee_status != null ? (
          <StatusPill tone={deliveryFeeTone(o.delivery_fee_status, o.fulfilment_method)}>
            {deliveryFeeLabel(o.delivery_fee_status, o.fulfilment_method)}
          </StatusPill>
        ) : (
          <span className="text-xs text-[#6B7280]">{o.delivery_location}</span>
        ),
    },
    { key: "status", header: "Status", cell: (o) => <StatusPill tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</StatusPill> },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description="Online, walk-in and phone orders. Click an order to record payments, confirm delivery and move it along."
        action={
          <>
            <button type="button" className={btn("outline")} onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button type="button" className={btn("gold")} onClick={() => setShowForm((v) => !v)}>
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Close" : "Add order"}
            </button>
          </>
        }
      />

      {showForm && (
        <NewOrderForm
          products={products}
          onOpen={() => {
            if (!products.length) listProducts().then(setProducts).catch(() => undefined);
          }}
          onClose={() => setShowForm(false)}
          onCreated={refresh}
        />
      )}

      <div className="mb-4 space-y-3">
        <StatusTabs tabs={tabs} value={tab} onChange={setTab} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              if (search.q) void navigate({ search: {}, replace: true });
            }}
            placeholder="Search order number, customer or phone"
            className="sm:col-span-2 lg:col-span-1"
          />
          <DateRangeSelect value={range} onChange={setRange} allowAll />
          <FilterSelect value={payment} onChange={setPayment} options={PAYMENT_FILTERS} label="Payment status" />
          {canArchive && (
            <label className="flex h-10 items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm text-[#374151]">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[#14213D]" />
              Archived only
            </label>
          )}
        </div>
      </div>

      {!orders ? (
        <AdminLoading label="Loading orders…" />
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          rowKey={(o) => o.id}
          onRowClick={(o) => setOpenId(o.id)}
          empty={<AdminEmpty title="No orders found">{orders.length ? "Try another tab, search or filter." : "Orders will appear here once customers check out."}</AdminEmpty>}
          mobileCard={(o) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">#{o.order_number}</p>
                  <p className="truncate text-xs text-[#6B7280]">{o.customer_name}</p>
                </div>
                <p className="shrink-0 text-xs text-[#6B7280]">{formatDate(o.created_at)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="font-semibold text-navy">{tzs(Number(o.total_amount))}</p>
                <StatusPill tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</StatusPill>
              </div>
              {(paymentState(o) !== "full" || feePending(o)) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusPill tone={PAYMENT_STATE_TONES[paymentState(o)]}>{PAYMENT_STATE_LABELS[paymentState(o)]}</StatusPill>
                  {feePending(o) && <StatusPill tone="pending">Fee to confirm</StatusPill>}
                </div>
              )}
            </div>
          )}
        />
      )}

      <Sheet open={Boolean(open)} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-[#F5F6F8] p-0 sm:max-w-2xl">
          {open && <OrderDetail order={open} canArchive={canArchive} onChanged={refresh} onClose={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OrderDetail({
  order: o,
  canArchive,
  onChanged,
  onClose,
}: {
  order: OrderRow;
  canArchive: boolean;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const update = useServerFn(updateOrderStatus);
  const archive = useServerFn(setOrderArchived);
  const remove = useServerFn(deleteAdminOrder);
  const [busy, setBusy] = useState<string | null>(null);
  const items = o.order_items ?? [];
  const has0008 = o.cancel_reason !== undefined;

  async function run(key: string, task: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await task();
      toast.success(success);
      await onChanged();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work", { duration: 8000 });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-[#E5E5E5] bg-white px-5 py-4 pr-12">
        <SheetTitle className="text-lg font-bold text-navy">Order #{o.order_number}</SheetTitle>
        <SheetDescription className="text-xs text-[#6B7280]">Placed {formatDate(o.created_at, true)}</SheetDescription>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusPill tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</StatusPill>
          <StatusPill tone={PAYMENT_STATE_TONES[paymentState(o)]}>{PAYMENT_STATE_LABELS[paymentState(o)]}</StatusPill>
          {o.user_id && <StatusPill tone="info">Registered customer</StatusPill>}
          {o.archived_at && <StatusPill>Archived</StatusPill>}
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-semibold text-[#374151]">Order status</span>
            <select
              className="h-10 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm text-navy"
              value={o.status}
              disabled={busy !== null}
              onChange={(e) => {
                const status = e.target.value as OrderStatus;
                void run("status", () => update({ data: { id: o.id, status } }), `Status changed to ${orderStatusLabel(status)}`);
              }}
            >
              {selectableStatuses(o, has0008).map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <p className="w-full text-xs text-[#6B7280]">
            Production needs the advance and agreed specifications. Out for delivery, delivered and completed need the delivery fee
            confirmed and the balance cleared. Cancel with a reason below; refunds are recorded per payment.
          </p>
          {o.cancel_reason && <p className="w-full text-xs font-medium text-[#991B1B]">Cancelled: {o.cancel_reason}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
            <Field label="Customer">
              <p className="font-semibold">{o.customer_name}</p>
              <a href={dialHref(o.phone)} className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#B86A00] hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {o.phone}
              </a>
              {o.email && <p className="text-[#6B7280]">{o.email}</p>}
              {o.payment_phone && <p className="mt-1 text-xs text-[#6B7280]">Mobile money: {o.payment_phone}</p>}
            </Field>
            {o.notes && (
              <Field label="Notes" className="mt-3">
                <p className="whitespace-pre-line text-[#374151]">{o.notes}</p>
              </Field>
            )}
            {o.needed_by && (
              <Field label="Needed by" className="mt-3">
                {formatDate(o.needed_by)}
              </Field>
            )}
          </div>
          <DeliveryFeePanel
            order={{
              ...o,
              total_amount: Number(o.total_amount),
              subtotal_amount: o.subtotal_amount == null ? null : Number(o.subtotal_amount),
              delivery_fee: o.delivery_fee == null ? null : Number(o.delivery_fee),
            }}
            onChanged={onChanged}
          />
        </div>

        {items.length > 0 && (
          <div className="rounded-xl border border-[#E5E5E5] bg-white">
            <p className="border-b border-[#F0F0F0] px-4 py-3 text-sm font-semibold text-navy">Items</p>
            <ul className="divide-y divide-[#F0F0F0]">
              {items.map((it) => (
                <li key={it.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-navy">
                      {it.quantity}× {it.product_name}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6B7280]">
                      <OrderColor value={it.color ?? (items.length === 1 ? o.preferred_color : null)} />
                      {(it.size ?? (items.length === 1 ? o.preferred_size : null)) && <span>Size: {it.size ?? o.preferred_size}</span>}
                      {it.material && <span>Material: {it.material}</span>}
                    </div>
                  </div>
                  <span className="font-medium text-navy">{tzs(Number(it.unit_price) * it.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <OrderPolicyPanel
          order={{
            ...o,
            total_amount: Number(o.total_amount),
            amount_paid: Number(o.amount_paid),
            advance_required: Number(o.advance_required),
            payments: o.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
          }}
          onChanged={onChanged}
        />

        <OrderOpsPanel
          order={{
            id: o.id,
            order_number: o.order_number,
            status: o.status,
            fulfilment_method: o.fulfilment_method,
            payments: o.payments.map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              status: p.status,
              receipt_number: p.receipt_number,
              provider: p.provider,
              updated_at: p.updated_at,
            })),
            order_items: items.map((it) => ({ id: it.id, product_name: it.product_name, quantity: it.quantity })),
          }}
          onChanged={onChanged}
        />

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E5E5E5] pt-4">
          <CancelOrderButton order={{ id: o.id, status: o.status, amount_paid: Number(o.amount_paid) }} onDone={onChanged} />
          {canArchive ? (
            <button
              type="button"
              className={btn("outline")}
              disabled={busy !== null}
              onClick={async () => {
                const ok = await run(
                  "archive",
                  () => archive({ data: { id: o.id, archived: !o.archived_at } }),
                  o.archived_at ? "Order restored" : "Order archived",
                );
                if (ok && !o.archived_at) onClose();
              }}
            >
              {o.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {o.archived_at ? "Restore order" : "Archive order"}
            </button>
          ) : (
            <button
              type="button"
              className={btn("danger")}
              disabled={busy !== null}
              onClick={async () => {
                if (!confirm(`Delete order ${o.order_number}? This cannot be undone.`)) return;
                const ok = await run("delete", () => remove({ data: { id: o.id } }), "Order deleted");
                if (ok) onClose();
              }}
            >
              <Trash2 className="h-4 w-4" />
              {busy === "delete" ? "Deleting…" : "Delete order"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewOrderForm({
  products,
  onOpen,
  onClose,
  onCreated,
}: {
  products: ProductOpt[];
  onOpen: () => void;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const create = useServerFn(createAdminOrder);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"delivery" | "collection">("delivery");

  useEffect(onOpen, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const feeRaw = String(fd.get("delivery_fee") ?? "").trim();
    setBusy(true);
    try {
      const r = await create({
        data: {
          customer_name: String(fd.get("customer_name") ?? "").trim(),
          phone: String(fd.get("phone") ?? "").trim(),
          email: String(fd.get("email") ?? "").trim(),
          product_id: String(fd.get("product_id")),
          quantity: Math.max(1, Number(fd.get("quantity") || 1)),
          preferred_color: String(fd.get("preferred_color") ?? "").trim() || "Natural wood",
          preferred_size: String(fd.get("preferred_size") ?? "Standard"),
          delivery_location: String(fd.get("delivery_location") ?? "").trim() || (method === "collection" ? "Collection from GK Furnish" : ""),
          notes: String(fd.get("notes") ?? "").trim(),
          status: String(fd.get("status") ?? "confirmed") as OrderStatus,
          amount_paid: Number(fd.get("amount_paid") || 0),
          fulfilment_method: method,
          delivery_fee: method === "delivery" && feeRaw ? Math.max(0, Number(feeRaw)) : null,
        },
      });
      toast.success(`Order ${r.orderNumber} created`);
      onClose();
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create order", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminCard className="mb-5">
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <h2 className="text-base font-semibold text-navy">New order</h2>
          <p className="text-sm text-[#6B7280]">For walk-in, phone and WhatsApp orders. The reference number is assigned automatically.</p>
        </div>
        <div>
          <label className="field-label">Customer name *</label>
          <input name="customer_name" required className="field-input" />
        </div>
        <div>
          <label className="field-label">Phone *</label>
          <input name="phone" required type="tel" className="field-input" placeholder="+255…" />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input name="email" type="email" className="field-input" />
        </div>
        <div>
          <label className="field-label">Fulfilment</label>
          <select className="field-input" value={method} onChange={(e) => setMethod(e.target.value as "delivery" | "collection")}>
            <option value="delivery">Delivery</option>
            <option value="collection">Collection from workshop</option>
          </select>
        </div>
        <div>
          <label className="field-label">{method === "delivery" ? "Delivery location *" : "Location / note"}</label>
          <input name="delivery_location" required={method === "delivery"} className="field-input" />
        </div>
        {method === "delivery" && (
          <div>
            <label className="field-label">Delivery fee (TSh)</label>
            <input name="delivery_fee" type="number" min={0} step={500} className="field-input" placeholder="Leave empty to confirm later" />
          </div>
        )}
        <div className="md:col-span-2">
          <label className="field-label">Product *</label>
          <select name="product_id" required className="field-input" defaultValue="">
            <option value="" disabled>
              {products.length ? "Select product…" : "Loading products…"}
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatPrice(p.price) ?? "quote"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Quantity *</label>
          <input name="quantity" type="number" min={1} defaultValue={1} required className="field-input" />
        </div>
        <div>
          <label className="field-label">Colour *</label>
          <input name="preferred_color" required className="field-input" defaultValue="Natural wood" />
        </div>
        <div>
          <label className="field-label">Size *</label>
          <select name="preferred_size" className="field-input" defaultValue="Standard">
            {["Small", "Standard", "Large", "4ft x 6ft", "5ft x 6ft", "6ft x 6ft"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Order status</label>
          <select name="status" className="field-input" defaultValue="confirmed">
            {selectableStatuses({ status: "confirmed" }, false).map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Amount already paid (TSh)</label>
          <input name="amount_paid" type="number" min={0} step={100} defaultValue={0} className="field-input" />
          <p className="mt-1 text-xs text-[#6B7280]">Recorded with a receipt. Production needs the advance; delivery needs the full amount.</p>
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Notes</label>
          <textarea name="notes" rows={2} className="field-input" placeholder="Walk-in, WhatsApp order…" />
        </div>
        <div className="flex gap-2 md:col-span-2">
          <button type="submit" className={btn("gold")} disabled={busy}>
            {busy ? "Creating…" : "Create order"}
          </button>
          <button type="button" className={btn("outline")} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </AdminCard>
  );
}
