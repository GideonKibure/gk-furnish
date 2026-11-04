import { useServerFn } from "@tanstack/react-start";
import { Ban, Factory, History, Pencil, Plus, RotateCcw, ShoppingCart, Truck, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { cancelOrder, listOrderOps, recordRefund, saveDeliveryRecord } from "@/lib/ops/order-ops.functions";
import { JOB_STATUS_LABELS, PAYMENT_METHODS, PO_STATUS_LABELS, jobStatusTone, poStatusTone, type JobStatus, type PoStatus } from "@/lib/ops/business";
import { humanize } from "@/lib/ops/status";
import { AdminNotice, StatusPill, adminInput, btn, formatDate, tzs } from "./admin-ui";

type Ops = Awaited<ReturnType<typeof listOrderOps>>;
type Delivery = Ops["deliveries"]["rows"][number];

export type OpsOrder = {
  id: string;
  order_number: string;
  status: string;
  fulfilment_method?: string | null;
  payments: { id: string; amount: number; status: string; receipt_number: string | null; provider: string | null; updated_at: string }[];
  order_items: { id: string; product_name: string; quantity: number }[];
};

const MIGRATION_TEXT = "Run drizzle/migrations/0008_business_operations.sql in Supabase to switch on refunds, delivery records and production / purchase links.";

function SectionTitle({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[#F0F0F0] px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-navy">
        <span className="text-[#6B7280]">{icon}</span>
        {title}
      </p>
      {action}
    </div>
  );
}

/** Refunds, delivery records and production / purchasing links for one order (migration 0008). */
export function OrderOpsPanel({ order, onChanged }: { order: OpsOrder; onChanged: () => Promise<void> }) {
  const load = useServerFn(listOrderOps);
  const [ops, setOps] = useState<Ops | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setOps(await load({ data: { orderId: order.id } }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load order operations");
    }
  }, [load, order.id]);

  useEffect(() => {
    void refresh();
  }, [refresh, order.status, order.payments.length]);

  async function changed() {
    await Promise.all([refresh(), onChanged()]);
  }

  if (error) return <AdminNotice tone="danger">{error}</AdminNotice>;
  if (!ops) return null;
  const ready = ops.refunds.available && ops.deliveries.available;
  if (!ready) return <AdminNotice tone="pending">{MIGRATION_TEXT}</AdminNotice>;

  return (
    <div className="space-y-4">
      <LinesPanel order={order} ops={ops} />
      <RefundsPanel order={order} ops={ops} onChanged={changed} />
      <DeliveryPanel order={order} rows={ops.deliveries.rows} onChanged={changed} />
      {ops.audit.available && ops.audit.rows.length > 0 && (
        <details className="rounded-xl border border-[#E5E5E5] bg-white">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-navy">
            <History className="h-4 w-4 text-[#6B7280]" /> Audit trail ({ops.audit.rows.length})
          </summary>
          <ul className="divide-y divide-[#F0F0F0] border-t border-[#F0F0F0] text-xs">
            {ops.audit.rows.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="font-semibold text-navy">{humanize(a.action)}</span>
                <span className="text-[#6B7280]">
                  {a.actor_email ?? "Admin"} · {formatDate(a.created_at, true)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LinesPanel({ order, ops }: { order: OpsOrder; ops: Ops }) {
  const jobs = ops.jobs.rows;
  const pos = ops.purchaseOrders.rows;
  const orderLevelPos = pos.filter((po) => !po.order_item_ids.length);
  const link = (base: string, itemId: string) => `${base}?new=1&order=${order.id}&item=${itemId}`;
  const closed = ["cancelled", "refunded", "completed", "delivered"].includes(order.status);

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white">
      <SectionTitle icon={<Factory className="h-4 w-4" />} title="Production & purchasing" />
      <ul className="divide-y divide-[#F0F0F0]">
        {order.order_items.map((it) => {
          const itemJobs = jobs.filter((j) => j.order_item_id === it.id);
          const itemPos = pos.filter((po) => po.order_item_ids.includes(it.id));
          return (
            <li key={it.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-navy">
                  {it.quantity}× {it.product_name}
                </p>
                {!closed && (
                  <div className="flex flex-wrap gap-1.5">
                    <a href={link("/admin/production", it.id)} className={btn("outline", "sm")}>
                      <Factory className="h-3.5 w-3.5" /> Send to production
                    </a>
                    <a href={link("/admin/purchases", it.id)} className={btn("outline", "sm")}>
                      <ShoppingCart className="h-3.5 w-3.5" /> Order from partner
                    </a>
                  </div>
                )}
              </div>
              {(itemJobs.length > 0 || itemPos.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {itemJobs.map((j) => (
                    <a key={j.id} href={`/admin/production?job=${j.id}`} className="inline-flex items-center gap-1.5 text-xs hover:underline">
                      <span className="font-semibold text-navy">{j.job_number}</span>
                      <StatusPill tone={jobStatusTone(j.status)}>{JOB_STATUS_LABELS[j.status as JobStatus] ?? humanize(j.status)}</StatusPill>
                    </a>
                  ))}
                  {itemPos.map((po) => (
                    <a key={po.id} href={`/admin/purchases?po=${po.id}`} className="inline-flex items-center gap-1.5 text-xs hover:underline">
                      <span className="font-semibold text-navy">{po.po_number}</span>
                      <StatusPill tone={poStatusTone(po.status)}>{PO_STATUS_LABELS[po.status as PoStatus] ?? humanize(po.status)}</StatusPill>
                    </a>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {(jobs.some((j) => !j.order_item_id) || orderLevelPos.length > 0) && (
          <li className="flex flex-wrap gap-1.5 px-4 py-3 text-xs">
            <span className="text-[#6B7280]">Whole order:</span>
            {jobs
              .filter((j) => !j.order_item_id)
              .map((j) => (
                <a key={j.id} href={`/admin/production?job=${j.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                  <span className="font-semibold text-navy">{j.job_number}</span>
                  <StatusPill tone={jobStatusTone(j.status)}>{JOB_STATUS_LABELS[j.status as JobStatus] ?? humanize(j.status)}</StatusPill>
                </a>
              ))}
            {orderLevelPos.map((po) => (
              <a key={po.id} href={`/admin/purchases?po=${po.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                <span className="font-semibold text-navy">{po.po_number}</span>
                <StatusPill tone={poStatusTone(po.status)}>{PO_STATUS_LABELS[po.status as PoStatus] ?? humanize(po.status)}</StatusPill>
              </a>
            ))}
          </li>
        )}
      </ul>
    </div>
  );
}

function RefundsPanel({ order, ops, onChanged }: { order: OpsOrder; ops: Ops; onChanged: () => Promise<void> }) {
  const refund = useServerFn(recordRefund);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const completed = order.payments.filter((p) => p.status === "completed");
  const refunded = (paymentId: string) =>
    ops.refunds.rows.filter((r) => r.payment_id === paymentId).reduce((s, r) => s + Number(r.amount), 0);

  if (!completed.length && !ops.refunds.rows.length) return null;

  async function submit(e: FormEvent, paymentId: string, left: number) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || Math.round(value) > Math.round(left)) {
      toast.error(`Enter an amount between 1 and ${tzs(left)}`);
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Give the reason for the refund");
      return;
    }
    setBusy(true);
    try {
      const r = await refund({ data: { orderId: order.id, paymentId, amount: value, reason, method } });
      toast.success(r.status === "refunded" ? "Refund recorded. The order is now fully refunded." : "Refund recorded");
      setOpenFor(null);
      setAmount("");
      setReason("");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record the refund", { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white">
      <SectionTitle icon={<RotateCcw className="h-4 w-4" />} title="Refunds" />
      <ul className="divide-y divide-[#F0F0F0]">
        {completed.map((p) => {
          const done = refunded(p.id);
          const left = Math.max(0, Number(p.amount) - done);
          return (
            <li key={p.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-semibold text-navy">{p.receipt_number ?? "Payment"}</span>{" "}
                  <span className="text-[#6B7280]">
                    {tzs(Number(p.amount))} · {p.provider ?? "—"}
                    {done > 0 ? ` · ${tzs(done)} refunded` : ""}
                  </span>
                </span>
                {left > 0 && openFor !== p.id && (
                  <button
                    type="button"
                    className={btn("outline", "sm")}
                    onClick={() => {
                      setOpenFor(p.id);
                      setAmount(String(Math.round(left)));
                      setMethod(p.provider ?? "");
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Refund
                  </button>
                )}
              </div>
              {openFor === p.id && (
                <form onSubmit={(e) => void submit(e, p.id, left)} className="mt-3 grid gap-2 rounded-lg bg-[#FEF2F2] p-3 sm:grid-cols-2">
                  <label className="text-xs text-[#374151]">
                    Amount (max {tzs(left)})
                    <input type="number" min={1} max={left} value={amount} onChange={(e) => setAmount(e.target.value)} className={`${adminInput} mt-1`} />
                  </label>
                  <label className="text-xs text-[#374151]">
                    Paid back by
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${adminInput} mt-1`}>
                      <option value="">Same as the payment</option>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-[#374151] sm:col-span-2">
                    Reason (required)
                    <input value={reason} onChange={(e) => setReason(e.target.value)} className={`${adminInput} mt-1`} placeholder="e.g. Customer cancelled before production" />
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button type="submit" className={btn("navy", "sm")} disabled={busy}>
                      {busy ? "Saving…" : "Record refund"}
                    </button>
                    <button type="button" className={btn("ghost", "sm")} onClick={() => setOpenFor(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {ops.refunds.rows.length > 0 && (
        <ul className="space-y-1 border-t border-[#F0F0F0] px-4 py-3 text-xs">
          {ops.refunds.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2">
              <span className="text-navy">
                <span className="font-semibold">−{tzs(Number(r.amount))}</span> · {r.reason}
              </span>
              <span className="text-[#6B7280]">
                {r.method ?? "—"} · {r.created_by ?? "Admin"} · {formatDate(r.created_at, true)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

/** `datetime-local` values are entered in Dar es Salaam time (UTC+3). */
function fromLocalInput(value: string) {
  return value ? new Date(`${value}:00+03:00`).toISOString() : null;
}

function DeliveryPanel({ order, rows, onChanged }: { order: OpsOrder; rows: Delivery[]; onChanged: () => Promise<void> }) {
  const save = useServerFn(saveDeliveryRecord);
  const [editing, setEditing] = useState<Delivery | "new" | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await save({
        data: {
          ...(editing && editing !== "new" ? { id: editing.id } : {}),
          orderId: order.id,
          method: String(fd.get("method")) === "collection" ? "collection" : "delivery",
          scheduled_at: fromLocalInput(String(fd.get("scheduled_at") ?? "")),
          completed_at: fromLocalInput(String(fd.get("completed_at") ?? "")),
          received_by: String(fd.get("received_by") ?? ""),
          handled_by: String(fd.get("handled_by") ?? ""),
          cost: Math.max(0, Number(fd.get("cost") || 0)),
          notes: String(fd.get("notes") ?? ""),
        },
      });
      toast.success("Delivery record saved");
      setEditing(null);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const current = editing && editing !== "new" ? editing : null;
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white">
      <SectionTitle
        icon={<Truck className="h-4 w-4" />}
        title="Delivery / collection record"
        action={
          !editing && (
            <button type="button" className={btn("ghost", "sm")} onClick={() => setEditing("new")}>
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          )
        }
      />
      {rows.length > 0 && (
        <ul className="divide-y divide-[#F0F0F0]">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-center gap-2 font-medium text-navy">
                  {r.method === "collection" ? "Collection" : "Delivery"}
                  <StatusPill tone={r.completed_at ? "success" : "pending"}>{r.completed_at ? "Done" : "Scheduled"}</StatusPill>
                </p>
                <p className="text-xs text-[#6B7280]">
                  {r.scheduled_at ? `Planned ${formatDate(r.scheduled_at, true)}` : "No date planned"}
                  {r.completed_at ? ` · done ${formatDate(r.completed_at, true)}` : ""}
                  {r.received_by ? ` · received by ${r.received_by}` : ""}
                  {r.handled_by ? ` · by ${r.handled_by}` : ""}
                  {Number(r.cost) > 0 ? ` · cost ${tzs(Number(r.cost))}` : ""}
                </p>
                {r.notes && <p className="text-xs text-[#374151]">{r.notes}</p>}
              </div>
              {!editing && (
                <button type="button" className={btn("ghost", "sm")} onClick={() => setEditing(r)} aria-label="Edit delivery record">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!rows.length && !editing && <p className="px-4 py-3 text-xs text-[#6B7280]">Nothing recorded yet.</p>}
      {editing && (
        <form key={current?.id ?? "new"} onSubmit={submit} className="grid gap-2 border-t border-[#F0F0F0] p-4 sm:grid-cols-2">
          <label className="text-xs text-[#374151]">
            Method
            <select name="method" defaultValue={current?.method ?? order.fulfilment_method ?? "delivery"} className={`${adminInput} mt-1`}>
              <option value="delivery">Delivery</option>
              <option value="collection">Collection</option>
            </select>
          </label>
          <label className="text-xs text-[#374151]">
            Our cost (TSh)
            <input name="cost" type="number" min={0} step={500} defaultValue={current ? Number(current.cost) : 0} className={`${adminInput} mt-1`} />
          </label>
          <label className="text-xs text-[#374151]">
            Planned for
            <input name="scheduled_at" type="datetime-local" defaultValue={toLocalInput(current?.scheduled_at ?? null)} className={`${adminInput} mt-1`} />
          </label>
          <label className="text-xs text-[#374151]">
            Completed at
            <input name="completed_at" type="datetime-local" defaultValue={toLocalInput(current?.completed_at ?? null)} className={`${adminInput} mt-1`} />
          </label>
          <label className="text-xs text-[#374151]">
            Received by
            <input name="received_by" defaultValue={current?.received_by ?? ""} className={`${adminInput} mt-1`} />
          </label>
          <label className="text-xs text-[#374151]">
            Handled by (driver / staff)
            <input name="handled_by" defaultValue={current?.handled_by ?? ""} className={`${adminInput} mt-1`} />
          </label>
          <label className="text-xs text-[#374151] sm:col-span-2">
            Notes
            <input name="notes" defaultValue={current?.notes ?? ""} className={`${adminInput} mt-1`} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className={btn("navy", "sm")} disabled={busy}>
              {busy ? "Saving…" : "Save record"}
            </button>
            <button type="button" className={btn("ghost", "sm")} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
          <p className="text-xs text-[#6B7280] sm:col-span-2">Times are Dar es Salaam time. Our delivery cost is an internal expense, not the fee charged to the customer.</p>
        </form>
      )}
    </div>
  );
}

/** Cancel with a required reason. The server refuses when money has been paid and not refunded. */
export function CancelOrderButton({ order, onDone }: { order: { id: string; status: string; amount_paid: number }; onDone: () => Promise<void> }) {
  const cancel = useServerFn(cancelOrder);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (["cancelled", "refunded", "delivered", "completed"].includes(order.status)) return null;

  if (!open) {
    return (
      <button type="button" className={btn("danger")} onClick={() => setOpen(true)}>
        <Ban className="h-4 w-4" /> Cancel order
      </button>
    );
  }
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-[#FEF2F2] p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (reason.trim().length < 5) {
          toast.error("Give a reason (at least 5 characters)");
          return;
        }
        setBusy(true);
        try {
          await cancel({ data: { orderId: order.id, reason } });
          toast.success("Order cancelled");
          setOpen(false);
          await onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not cancel", { duration: 8000 });
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className={`${adminInput} min-w-0 flex-1`}
        placeholder="Reason for cancelling (shown to the customer)"
        autoFocus
      />
      <button type="submit" className={btn("danger", "sm")} disabled={busy}>
        {busy ? "Cancelling…" : "Confirm cancel"}
      </button>
      <button type="button" className={btn("ghost", "sm")} onClick={() => setOpen(false)} aria-label="Keep the order">
        <X className="h-4 w-4" />
      </button>
      {order.amount_paid > 0 && (
        <p className="w-full text-xs text-[#991B1B]">{tzs(order.amount_paid)} has been paid. Refund it first, then cancel.</p>
      )}
    </form>
  );
}
