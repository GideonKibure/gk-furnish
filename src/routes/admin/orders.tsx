import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Phone, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminBadge, AdminCard, AdminEmpty, AdminPageHeader } from "@/components/admin/admin-ui";
import { formatPrice } from "@/config/site";
import { colorSwatch } from "@/lib/color-swatches";
import { parseCatalogColor } from "@/lib/order-options";
import {
  createAdminOrder,
  deleteAdminOrder,
  listAdminOrders,
  listAdminProducts,
  updateOrderStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminOrdersPage,
});

type OrderRow = Awaited<ReturnType<typeof listAdminOrders>>[number];
type ProductOpt = Awaited<ReturnType<typeof listAdminProducts>>[number];

const STATUSES = [
  "pending",
  "confirmed",
  "in_production",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

type Filter = "all" | "not_done" | "in_progress" | "done" | "paid_advance" | "paid_full";

function dialHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

function OrderColor({ value }: { value: string | null }) {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return <p className="text-sm text-muted-foreground">No colour chosen</p>;
  }
  const color = parseCatalogColor(raw);
  const named = color.label !== color.hex;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="h-11 w-11 shrink-0 rounded-xl shadow-[inset_0_0_0_1px_color-mix(in_oklab,black_12%,transparent)]"
        style={{
          background: color.hex ?? undefined,
          backgroundImage: color.hex ? undefined : `url("${colorSwatch(color.label)}")`,
          backgroundSize: "cover",
        }}
        role="img"
        aria-label={named ? color.label : "Selected colour"}
      />
      <span className="min-w-0">
        <span className="block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Colour</span>
        <span className="block truncate text-sm font-semibold text-navy">{named ? color.label : "Selected colour"}</span>
      </span>
    </div>
  );
}

function group(status: string): Filter {
  if (["pending", "confirmed"].includes(status)) return "not_done";
  if (["in_production", "ready", "out_for_delivery"].includes(status)) return "in_progress";
  if (status === "completed") return "done";
  return "all";
}

function AdminOrdersPage() {
  const list = useServerFn(listAdminOrders);
  const listProducts = useServerFn(listAdminProducts);
  const create = useServerFn(createAdminOrder);
  const update = useServerFn(updateOrderStatus);
  const remove = useServerFn(deleteAdminOrder);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [o, p] = await Promise.all([list(), listProducts()]);
    setOrders(o);
    setProducts(p);
  }

  useEffect(() => {
    refresh().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter === "all") return true;
      if (filter === "paid_advance") return o.payment_kind === "advance" && o.payment_status === "paid";
      if (filter === "paid_full") return o.payment_kind === "full" && o.payment_status === "paid";
      return group(o.status) === filter;
    });
  }, [orders, filter]);

  async function onStatus(id: string, status: (typeof STATUSES)[number]) {
    try {
      await update({ data: { id, status } });
      toast.success("Status updated");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function onDelete(id: string, orderNumber: string) {
    if (!confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await remove({ data: { id } });
      toast.success("Order deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
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
          delivery_location: String(fd.get("delivery_location") ?? "").trim(),
          notes: String(fd.get("notes") ?? "").trim(),
          status: String(fd.get("status") ?? "confirmed") as (typeof STATUSES)[number],
          payment_kind: String(fd.get("payment_kind") ?? "full") as "advance" | "full",
          payment_status: String(fd.get("payment_status") ?? "unpaid") as "unpaid" | "pending" | "paid" | "failed",
          amount_paid: Number(fd.get("amount_paid") || 0),
        },
      });
      toast.success(`Order ${r.orderNumber} created`);
      setShowForm(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create order");
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "not_done", label: "Not done" },
    { id: "in_progress", label: "In progress" },
    { id: "done", label: "Done" },
    { id: "paid_advance", label: "Paid advance" },
    { id: "paid_full", label: "Paid full" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description="Add walk-in or phone orders — reference numbers generate automatically."
        action={
          <button type="button" className="btn-base btn-gold" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Close" : "Add order"}
          </button>
        }
      />

      {showForm && (
        <AdminCard hover={false} className="mb-6 grid gap-3 md:grid-cols-2">
        <form onSubmit={onCreate} className="contents">
          <h2 className="font-display text-xl text-navy md:col-span-2">New order</h2>
          <p className="text-sm text-muted-foreground md:col-span-2">
            Reference number is assigned automatically (e.g. GK-2026-0001).
          </p>

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
            <label className="field-label">Delivery location *</label>
            <input name="delivery_location" required className="field-input" />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Product *</label>
            <select name="product_id" required className="field-input" defaultValue="">
              <option value="" disabled>
                Select product…
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
              <option value="Small">Small</option>
              <option value="Standard">Standard</option>
              <option value="Large">Large</option>
              <option value="4ft x 6ft">4ft x 6ft</option>
              <option value="5ft x 6ft">5ft x 6ft</option>
              <option value="6ft x 6ft">6ft x 6ft</option>
            </select>
          </div>
          <div>
            <label className="field-label">Order status</label>
            <select name="status" className="field-input" defaultValue="confirmed">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Payment kind</label>
            <select name="payment_kind" className="field-input" defaultValue="full">
              <option value="advance">Advance</option>
              <option value="full">Full</option>
            </select>
          </div>
          <div>
            <label className="field-label">Payment status</label>
            <select name="payment_status" className="field-input" defaultValue="unpaid">
              <option value="unpaid">Unpaid</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="field-label">Amount already paid (TZS)</label>
            <input name="amount_paid" type="number" min={0} step={100} defaultValue={0} className="field-input" />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Notes</label>
            <textarea name="notes" rows={2} className="field-input" placeholder="Walk-in, WhatsApp order…" />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <button type="submit" className="btn-base btn-gold" disabled={busy}>
              {busy ? "Creating…" : "Create order"}
            </button>
            <button type="button" className="btn-base btn-outline-navy" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
        </AdminCard>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
              filter === t.id
                ? "bg-navy text-primary-foreground shadow-[var(--shadow-card)]"
                : "bg-secondary text-navy hover:bg-secondary/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((o) => {
          const items =
            (o as { order_items?: { product_name: string; quantity: number; unit_price: number }[] }).order_items ??
            [];
          return (
            <AdminCard key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-navy">{o.order_number}</p>
                  <p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminBadge>{o.status.replace(/_/g, " ")}</AdminBadge>
                  <AdminBadge tone="gold">
                    {o.payment_kind} · {o.payment_status}
                  </AdminBadge>
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_16rem]">
                <div className="rounded-2xl bg-secondary/40 px-4 py-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Customer</p>
                  <p className="mt-1 font-semibold text-navy">{o.customer_name}</p>
                  <a
                    href={dialHref(o.phone)}
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-gold transition-colors hover:text-navy hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {o.phone}
                  </a>
                  {o.email && <p className="text-sm text-muted-foreground">{o.email}</p>}
                </div>
                <div className="rounded-2xl bg-secondary/40 px-4 py-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Delivery</p>
                  <p className="mt-1 text-sm text-navy">{o.delivery_location}</p>
                  {o.notes && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{o.notes}</p>}
                </div>
                <div className="rounded-2xl border border-gold/25 bg-gold-soft/50 px-4 py-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Payment</p>
                  <p className="mt-1 text-sm font-semibold text-navy">Due {formatPrice(o.amount_due) ?? "—"}</p>
                  <p className="text-sm text-navy">Paid {formatPrice(o.amount_paid) ?? "—"}</p>
                  {o.payment_phone && <p className="mt-1 text-xs text-muted-foreground">MM: {o.payment_phone}</p>}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border border-border/80 bg-background px-3 py-3">
                <OrderColor value={o.preferred_color} />
                <div className="h-8 w-px bg-border/80" aria-hidden />
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">Size</p>
                  <p className="text-sm font-semibold text-navy">{o.preferred_size || "—"}</p>
                </div>
              </div>

              {items.length > 0 && (
                <ul className="mt-4 space-y-1.5 rounded-xl bg-secondary/40 px-3 py-3 text-sm">
                  {items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>
                        {it.quantity}× {it.product_name}
                      </span>
                      <span className="font-medium text-navy">
                        {formatPrice(Number(it.unit_price) * it.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                <label className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Status
                </label>
                <select
                  className="field-input !h-10 max-w-xs"
                  value={o.status}
                  onChange={(e) => onStatus(o.id, e.target.value as (typeof STATUSES)[number])}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onDelete(o.id, o.order_number)}
                  disabled={deletingId === o.id}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingId === o.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </AdminCard>
          );
        })}
        {!filtered.length && <AdminEmpty>No orders in this filter.</AdminEmpty>}
      </div>
    </div>
  );
}
