import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Ban, CheckCircle2, PackageCheck, Pencil, Send, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field, StatusPill, adminInput, btn, formatDate, tzs } from "@/components/admin/admin-ui";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PAYMENT_METHODS, PO_STATUS_LABELS, QC_RESULTS, poStatusTone, qcTone, type PoStatus } from "@/lib/ops/business";
import {
  addPoQualityCheck,
  receiveGoods,
  recordSupplierPayment,
  removeSupplierPayment,
  setPoStatus,
} from "@/lib/ops/purchases.functions";
import { humanize } from "@/lib/ops/status";
import type { PoRow } from "./types";

type Receipt = { accepted: string; rejected: string; defects: string };

const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

export function PoDetail({ po, onChanged, onEdit }: { po: PoRow; onChanged: () => Promise<void>; onEdit: () => void }) {
  const receive = useServerFn(receiveGoods);
  const addQc = useServerFn(addPoQualityCheck);
  const pay = useServerFn(recordSupplierPayment);
  const unpay = useServerFn(removeSupplierPayment);
  const setStatus = useServerFn(setPoStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [qcResult, setQcResult] = useState<"" | (typeof QC_RESULTS)[number]>("");
  const [qcNotes, setQcNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>("Cash");
  const [paidAt, setPaidAt] = useState("");
  const [reference, setReference] = useState("");

  const open = !["received", "cancelled"].includes(po.status);
  const nothingReceived = po.purchase_items.every((i) => i.accepted_qty === 0 && i.rejected_qty === 0);

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

  function receiptFor(id: string): Receipt {
    return receipts[id] ?? { accepted: "", rejected: "", defects: "" };
  }

  async function submitReceipt() {
    const lines = po.purchase_items.map((i) => {
      const r = receiptFor(i.id);
      return {
        item_id: i.id,
        accepted_qty: Math.max(0, Number(r.accepted) || 0),
        rejected_qty: Math.max(0, Number(r.rejected) || 0),
        defect_notes: r.defects.trim(),
      };
    });
    const ok = await run(
      "receive",
      () => receive({ data: { po_id: po.id, lines, ...(qcResult ? { quality: { result: qcResult, notes: qcNotes } } : {}) } }),
      "Goods received",
    );
    if (ok) {
      setReceiving(false);
      setReceipts({});
      setQcResult("");
      setQcNotes("");
    }
  }

  function changeStatus(status: "draft" | "sent" | "received" | "cancelled") {
    let reason = "";
    if (status === "cancelled") {
      reason = prompt(`Why is ${po.po_number} being cancelled?`)?.trim() ?? "";
      if (!reason) return;
    }
    void run("status", () => setStatus({ data: { id: po.id, status, reason } }), `${po.po_number}: ${PO_STATUS_LABELS[status]}`);
  }

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-[#E5E5E5] bg-white px-5 py-4 pr-12">
        <SheetTitle className="text-lg font-bold text-navy">{po.po_number}</SheetTitle>
        <SheetDescription className="text-xs text-[#6B7280]">
          {po.suppliers?.name ?? "Supplier"} · ordered {formatDate(po.order_date)}
        </SheetDescription>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <StatusPill tone={poStatusTone(po.status)}>{PO_STATUS_LABELS[po.status as PoStatus] ?? humanize(po.status)}</StatusPill>
          {po.overdue && <StatusPill tone="danger">Overdue</StatusPill>}
          {po.balance > 0 && <StatusPill tone="pending">{tzs(po.balance)} to pay</StatusPill>}
        </div>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap gap-2">
          {po.status !== "cancelled" && (
            <button type="button" className={btn("outline", "sm")} onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          {po.status === "draft" && (
            <button type="button" className={btn("navy", "sm")} disabled={busy !== null} onClick={() => changeStatus("sent")}>
              <Send className="h-3.5 w-3.5" /> Mark as sent
            </button>
          )}
          {po.status === "sent" && nothingReceived && (
            <button type="button" className={btn("ghost", "sm")} disabled={busy !== null} onClick={() => changeStatus("draft")}>
              <Undo2 className="h-3.5 w-3.5" /> Back to draft
            </button>
          )}
          {open && (
            <button type="button" className={btn("gold", "sm")} disabled={busy !== null} onClick={() => setReceiving((v) => !v)}>
              <PackageCheck className="h-3.5 w-3.5" /> {receiving ? "Close receiving" : "Receive goods"}
            </button>
          )}
          {po.status === "partially_received" && (
            <button
              type="button"
              className={btn("outline", "sm")}
              disabled={busy !== null}
              onClick={() => {
                if (confirm("Close this PO as received? Lines not yet delivered will not be expected any more.")) changeStatus("received");
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Close as received
            </button>
          )}
          {open && nothingReceived && (
            <button type="button" className={btn("danger", "sm")} disabled={busy !== null} onClick={() => changeStatus("cancelled")}>
              <Ban className="h-3.5 w-3.5" /> Cancel PO
            </button>
          )}
        </div>

        <div className="grid gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4 sm:grid-cols-2">
          <Field label="Supplier">
            {po.suppliers?.name ?? "—"}
            {po.suppliers?.phone && <span className="block text-xs text-[#6B7280]">{po.suppliers.phone}</span>}
          </Field>
          <Field label="Customer order">
            {po.orders ? (
              <Link to="/admin/orders" search={{ q: po.orders.order_number }} className="font-semibold text-[#B86A00] hover:underline">
                #{po.orders.order_number} · {po.orders.customer_name}
              </Link>
            ) : (
              "Stock purchase"
            )}
          </Field>
          <Field label="Expected">
            <span className={po.overdue ? "font-semibold text-[#DC2626]" : undefined}>{formatDate(po.expected_date)}</span>
          </Field>
          <Field label="Notes">
            <span className="whitespace-pre-line">{po.notes || "—"}</span>
          </Field>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
          <p className="border-b border-[#F0F0F0] px-4 py-3 text-sm font-semibold text-navy">Items</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Item</th>
                  <th className="px-3 py-2 text-right font-semibold">Ordered</th>
                  <th className="px-3 py-2 text-right font-semibold">Accepted</th>
                  <th className="px-3 py-2 text-right font-semibold">Rejected</th>
                  <th className="px-4 py-2 text-right font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {po.purchase_items.map((i) => (
                  <tr key={i.id} className="align-top">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-navy">{i.description}</p>
                      <p className="text-xs text-[#6B7280]">
                        {[i.inventory_item_id ? "Into stock" : null, i.order_item_id ? "For order line" : null].filter(Boolean).join(" · ") ||
                          "Not linked"}
                      </p>
                      {i.defect_notes && <p className="mt-1 whitespace-pre-line text-xs text-[#DC2626]">{i.defect_notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right">{qty(i.quantity)}</td>
                    <td className="px-3 py-2.5 text-right text-[#15803D]">{qty(i.accepted_qty)}</td>
                    <td className="px-3 py-2.5 text-right text-[#DC2626]">{qty(i.rejected_qty)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {tzs(i.quantity * i.unit_cost)}
                      <span className="block text-xs text-[#6B7280]">{tzs(i.unit_cost)} each</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[#F0F0F0] px-4 py-3 text-sm">
            <dt className="text-[#6B7280]">Items</dt>
            <dd className="text-right">{tzs(po.total)}</dd>
            <dt className="text-[#6B7280]">Transport</dt>
            <dd className="text-right">{tzs(po.transport_cost)}</dd>
            <dt className="text-[#6B7280]">Inspection</dt>
            <dd className="text-right">{tzs(po.inspection_cost)}</dd>
            <dt className="font-semibold text-navy">Landed cost</dt>
            <dd className="text-right font-semibold text-navy">{tzs(po.landed)}</dd>
            <dt className="text-[#6B7280]">Paid{po.deposit_paid > 0 ? ` (deposit ${tzs(po.deposit_paid)})` : ""}</dt>
            <dd className="text-right">{tzs(po.paid)}</dd>
            <dt className="font-semibold text-navy">Balance due</dt>
            <dd className="text-right font-semibold text-navy">{tzs(po.balance)}</dd>
          </dl>
        </div>

        {receiving && open && (
          <div className="space-y-3 rounded-xl border border-gold/40 bg-[#FFFBF0] p-4">
            <p className="text-sm font-semibold text-navy">Receive goods</p>
            <p className="text-xs text-[#6B7280]">
              Enter what arrived now. Accepted quantities on lines linked to a stock item are added to inventory.
            </p>
            {po.purchase_items.map((i) => {
              const left = i.quantity - i.accepted_qty - i.rejected_qty;
              const r = receiptFor(i.id);
              const set = (next: Partial<Receipt>) => setReceipts((m) => ({ ...m, [i.id]: { ...r, ...next } }));
              return (
                <div key={i.id} className="grid gap-2 rounded-lg bg-white p-3 sm:grid-cols-[minmax(0,1fr)_6rem_6rem]">
                  <div className="min-w-0 sm:col-span-3">
                    <p className="truncate text-sm font-medium text-navy">{i.description}</p>
                    <p className="text-xs text-[#6B7280]">{left > 0 ? `${qty(left)} still expected` : "Fully received"}</p>
                  </div>
                  <input
                    className={adminInput}
                    placeholder="Defects / notes"
                    aria-label={`Defects for ${i.description}`}
                    value={r.defects}
                    disabled={left <= 0}
                    onChange={(e) => set({ defects: e.target.value })}
                  />
                  <input
                    className={adminInput}
                    type="number"
                    min={0}
                    max={left}
                    step="any"
                    placeholder="Accepted"
                    aria-label={`Accepted quantity for ${i.description}`}
                    value={r.accepted}
                    disabled={left <= 0}
                    onChange={(e) => set({ accepted: e.target.value })}
                  />
                  <input
                    className={adminInput}
                    type="number"
                    min={0}
                    max={left}
                    step="any"
                    placeholder="Rejected"
                    aria-label={`Rejected quantity for ${i.description}`}
                    value={r.rejected}
                    disabled={left <= 0}
                    onChange={(e) => set({ rejected: e.target.value })}
                  />
                </div>
              );
            })}
            <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <select
                className={adminInput}
                aria-label="Quality check result"
                value={qcResult}
                onChange={(e) => setQcResult(e.target.value as typeof qcResult)}
              >
                <option value="">No quality check</option>
                {QC_RESULTS.map((q) => (
                  <option key={q} value={q}>
                    QC: {humanize(q)}
                  </option>
                ))}
              </select>
              <input className={adminInput} placeholder="Quality notes" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} />
            </div>
            <button type="button" className={btn("gold")} disabled={busy !== null} onClick={() => void submitReceipt()}>
              {busy === "receive" ? "Saving…" : "Save receipt"}
            </button>
          </div>
        )}

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
          <p className="text-sm font-semibold text-navy">Quality checks</p>
          {po.quality_checks.length ? (
            <ul className="mt-2 space-y-1.5">
              {po.quality_checks.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusPill tone={qcTone(q.result)}>{humanize(q.result)}</StatusPill>
                  <span className="text-[#374151]">{q.notes || "No notes"}</span>
                  <span className="text-xs text-[#9CA3AF]">
                    {formatDate(q.checked_at, true)}
                    {q.checked_by ? ` · ${q.checked_by}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-[#6B7280]">No checks recorded.</p>
          )}
          {!receiving && po.status !== "cancelled" && (
            <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
              <select
                className={adminInput}
                aria-label="Quality check result"
                value={qcResult}
                onChange={(e) => setQcResult(e.target.value as typeof qcResult)}
              >
                <option value="">Result…</option>
                {QC_RESULTS.map((q) => (
                  <option key={q} value={q}>
                    {humanize(q)}
                  </option>
                ))}
              </select>
              <input className={adminInput} placeholder="Notes" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} />
              <button
                type="button"
                className={btn("outline")}
                disabled={!qcResult || busy !== null}
                onClick={async () => {
                  if (!qcResult) return;
                  const ok = await run("qc", () => addQc({ data: { po_id: po.id, result: qcResult, notes: qcNotes } }), "Quality check saved");
                  if (ok) {
                    setQcResult("");
                    setQcNotes("");
                  }
                }}
              >
                Add check
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
          <p className="text-sm font-semibold text-navy">Supplier payments</p>
          {po.supplier_payments.length ? (
            <ul className="mt-2 space-y-1.5">
              {po.supplier_payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold text-navy">{tzs(p.amount)}</span>{" "}
                    <span className="text-[#6B7280]">
                      {p.method ?? "—"} · {formatDate(p.paid_at)}
                      {p.reference ? ` · ref ${p.reference}` : ""}
                    </span>
                    {p.note && <span className="block text-xs text-[#6B7280]">{p.note}</span>}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove payment"
                    className="grid h-7 w-7 place-items-center rounded-md border border-[#FECACA] text-[#DC2626] hover:bg-[#FEE2E2]"
                    disabled={busy !== null}
                    onClick={() => {
                      if (confirm(`Remove the payment of ${tzs(p.amount)}?`)) {
                        void run("unpay", () => unpay({ data: { id: p.id } }), "Payment removed");
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-[#6B7280]">No payments yet.</p>
          )}
          {po.status !== "cancelled" && po.balance > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[8rem_9rem_10rem_minmax(0,1fr)_auto]">
              <input
                className={adminInput}
                type="number"
                min={1}
                step={100}
                placeholder="Amount"
                aria-label="Payment amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select
                className={adminInput}
                aria-label="Payment method"
                value={method}
                onChange={(e) => setMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <input className={adminInput} type="date" aria-label="Paid on" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              <input className={adminInput} placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
              <button
                type="button"
                className={btn("navy")}
                disabled={busy !== null}
                onClick={async () => {
                  const value = Number(amount);
                  if (!(value > 0)) {
                    toast.error("Enter the amount paid");
                    return;
                  }
                  const ok = await run(
                    "pay",
                    () =>
                      pay({
                        data: { po_id: po.id, supplier_id: po.supplier_id, amount: value, method, paid_at: paidAt, reference },
                      }),
                    "Payment recorded",
                  );
                  if (ok) {
                    setAmount("");
                    setReference("");
                  }
                }}
              >
                Record payment
              </button>
              <button
                type="button"
                className="text-left text-xs font-semibold text-[#B86A00] hover:underline sm:col-span-2 lg:col-span-5"
                onClick={() => setAmount(String(Math.round(po.balance)))}
              >
                Pay full balance {tzs(po.balance)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
