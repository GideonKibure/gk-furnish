import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, FileText, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatPrice } from "@/config/site";
import {
  recordAdminPayment,
  recordOrderChange,
  removeAdminPayment,
  setOrderAdvancePercent,
  setOrderSpecsAgreed,
} from "@/lib/admin.functions";
import { downloadReceipt, purposeLabel } from "@/lib/invoice";
import { balanceDue } from "@/lib/payment-policy";

type Payment = {
  id: string;
  amount: number;
  status: string;
  purpose: string;
  provider: string | null;
  receipt_number: string | null;
  snippe_reference: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type PolicyOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  email: string | null;
  total_amount: number;
  amount_paid: number;
  advance_percent: number;
  advance_required: number;
  specs_agreed_at: string | null;
  specs_agreed_by: string | null;
  payments: Payment[];
  order_items?: { product_name: string; quantity: number; unit_price: number; material?: string | null; size?: string | null; color?: string | null }[];
};

const METHODS = ["Cash", "Bank transfer", "Mobile money", "Other"] as const;

export function OrderPolicyPanel({ order, onChanged }: { order: PolicyOrder; onChanged: () => Promise<void> }) {
  const record = useServerFn(recordAdminPayment);
  const removePayment = useServerFn(removeAdminPayment);
  const setSpecs = useServerFn(setOrderSpecsAgreed);
  const logChange = useServerFn(recordOrderChange);
  const setPercent = useServerFn(setOrderAdvancePercent);
  const [busy, setBusy] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Cash");
  const [showChange, setShowChange] = useState(false);
  const [change, setChange] = useState("");
  const [agreedBy, setAgreedBy] = useState("");
  const [showPercent, setShowPercent] = useState(false);
  const [percent, setPercentValue] = useState(String(order.advance_percent));
  const [reason, setReason] = useState("");

  const total = Number(order.total_amount);
  const paid = Number(order.amount_paid);
  const advanceRequired = Number(order.advance_required);
  const balance = balanceDue(total, paid);
  const advanceLeft = Math.max(0, Math.round(advanceRequired) - Math.round(paid));
  const completed = order.payments.filter((p) => p.status === "completed");
  const others = order.payments.filter((p) => p.status !== "completed");

  async function run(key: string, task: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await task();
      toast.success(success);
      await onChanged();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work");
      return false;
    } finally {
      setBusy(null);
    }
  }

  function receiptFor(p: Payment) {
    const paidUpTo = completed
      .filter((x) => x.updated_at <= p.updated_at)
      .reduce((sum, x) => sum + Number(x.amount), 0);
    downloadReceipt({
      receiptNumber: p.receipt_number ?? `RCT-${order.order_number}`,
      orderNumber: order.order_number,
      paidAt: p.updated_at,
      amount: Number(p.amount),
      purpose: p.purpose,
      method: p.provider ?? (p.snippe_reference ? "Mobile money" : "—"),
      customerName: order.customer_name,
      phone: order.phone,
      ...(order.email ? { email: order.email } : {}),
      orderTotal: total,
      totalPaid: paidUpTo,
      lines: (order.order_items ?? []).map((i) => ({
        name: i.product_name,
        qty: i.quantity,
        unitPrice: Number(i.unit_price),
        details: [i.material, i.size, i.color].filter(Boolean).join(" · "),
      })),
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
        <p className="text-sm font-semibold text-navy">Payment</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Order total</dt>
          <dd className="text-right font-semibold text-navy">{formatPrice(total) ?? "—"}</dd>
          <dt className="text-muted-foreground">Advance ({order.advance_percent}%)</dt>
          <dd className="text-right font-semibold text-navy">{formatPrice(advanceRequired) ?? "—"}</dd>
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="text-right font-semibold text-navy">{formatPrice(paid) ?? "TSh 0"}</dd>
          <dt className="text-muted-foreground">Balance</dt>
          <dd className="text-right font-semibold text-navy">{formatPrice(balance) ?? "TSh 0"}</dd>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          {advanceLeft > 0
            ? `Production is blocked until ${formatPrice(advanceLeft)} more is paid.`
            : balance > 0
              ? `Advance received. ${formatPrice(balance)} must be cleared before delivery.`
              : "Paid in full. Ready for delivery once finished."}
        </p>

        {completed.length + others.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {[...completed, ...others].map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F9FAFB] px-2.5 py-2 text-xs">
                <span className="min-w-0">
                  <span className="font-semibold text-navy">{formatPrice(Number(p.amount))}</span>{" "}
                  <span className="text-muted-foreground">
                    {purposeLabel(p.purpose)} · {p.provider ?? (p.snippe_reference ? "Mobile money" : "—")} ·{" "}
                    {new Date(p.updated_at).toLocaleDateString()}
                  </span>
                  {p.status !== "completed" && <span className="ml-1 font-semibold text-amber-700">({p.status})</span>}
                  {p.snippe_reference && <span className="block truncate text-muted-foreground">Snippe ref {p.snippe_reference}</span>}
                </span>
                <span className="flex gap-1.5">
                  {p.status === "completed" && (
                    <button
                      type="button"
                      onClick={() => receiptFor(p)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-semibold text-navy hover:bg-gold-soft"
                    >
                      <Receipt className="h-3 w-3" />
                      {p.receipt_number ?? "Receipt"}
                    </button>
                  )}
                  {!p.snippe_reference && (
                    <button
                      type="button"
                      aria-label="Remove payment"
                      disabled={busy !== null}
                      onClick={() => {
                        if (confirm("Remove this recorded payment?")) {
                          void run("remove", () => removePayment({ data: { paymentId: p.id } }), "Payment removed");
                        }
                      }}
                      className="grid h-6 w-6 place-items-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {balance > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              step={500}
              inputMode="numeric"
              className="field-input !h-9 w-32 !text-sm"
              placeholder="Amount TSh"
              aria-label="Payment amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <select
              className="field-input !h-9 w-36 !text-sm"
              aria-label="Payment method"
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-base btn-navy !h-9 px-3 text-xs"
              disabled={busy !== null}
              onClick={async () => {
                const value = Number(amount);
                if (!Number.isFinite(value) || value <= 0) {
                  toast.error("Enter the amount received");
                  return;
                }
                const ok = await run("record", () => record({ data: { id: order.id, amount: value, method } }), "Payment recorded with a receipt");
                if (ok) setAmount("");
              }}
            >
              {busy === "record" ? "Saving…" : "Record payment"}
            </button>
            {advanceLeft > 0 && (
              <button type="button" className="text-xs font-semibold text-navy underline" onClick={() => setAmount(String(advanceLeft))}>
                Advance {formatPrice(advanceLeft)}
              </button>
            )}
            <button type="button" className="text-xs font-semibold text-navy underline" onClick={() => setAmount(String(balance))}>
              Full balance {formatPrice(balance)}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4">
        <p className="text-sm font-semibold text-navy">Design and specifications</p>
        {order.specs_agreed_at ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Agreed {new Date(order.specs_agreed_at).toLocaleDateString()}
              {order.specs_agreed_by ? ` · ${order.specs_agreed_by}` : ""}
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground underline"
              disabled={busy !== null}
              onClick={() => void run("specs", () => setSpecs({ data: { id: order.id, agreed: false } }), "Sign-off removed")}
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className="field-input !h-9 w-44 !text-sm"
              placeholder="Agreed with (name)"
              value={agreedBy}
              onChange={(e) => setAgreedBy(e.target.value)}
            />
            <button
              type="button"
              className="btn-base btn-gold !h-9 px-3 text-xs"
              disabled={busy !== null}
              onClick={() =>
                void run("specs", () => setSpecs({ data: { id: order.id, agreed: true, by: agreedBy || order.customer_name } }), "Specifications marked as agreed")
              }
            >
              Mark specifications agreed
            </button>
            <p className="w-full text-xs text-muted-foreground">Production cannot start until this is confirmed with the customer.</p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3 border-t border-border/60 pt-3 text-xs">
          <button type="button" className="inline-flex items-center gap-1 font-semibold text-navy underline" onClick={() => setShowChange((v) => !v)}>
            <FileText className="h-3.5 w-3.5" />
            Record agreed change
          </button>
          <button type="button" className="font-semibold text-navy underline" onClick={() => setShowPercent((v) => !v)}>
            Change advance %
          </button>
        </div>

        {showChange && (
          <div className="mt-3 space-y-2">
            <textarea
              className="field-input !text-sm"
              rows={2}
              placeholder="What changed (size, material, colour, price…)"
              value={change}
              onChange={(e) => setChange(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <input
                className="field-input !h-9 w-44 !text-sm"
                placeholder="Agreed with (name)"
                value={agreedBy}
                onChange={(e) => setAgreedBy(e.target.value)}
              />
              <button
                type="button"
                className="btn-base btn-navy !h-9 px-3 text-xs"
                disabled={busy !== null}
                onClick={async () => {
                  const ok = await run(
                    "change",
                    () => logChange({ data: { id: order.id, change, agreedBy: agreedBy || order.customer_name } }),
                    "Change saved to the order history",
                  );
                  if (ok) {
                    setChange("");
                    setShowChange(false);
                  }
                }}
              >
                Save change
              </button>
            </div>
          </div>
        )}

        {showPercent && (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="number"
              min={0}
              max={100}
              className="field-input !h-9 w-20 !text-sm"
              aria-label="Advance percent"
              value={percent}
              onChange={(e) => setPercentValue(e.target.value)}
            />
            <input
              className="field-input !h-9 min-w-0 flex-1 !text-sm"
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              type="button"
              className="btn-base btn-navy !h-9 px-3 text-xs"
              disabled={busy !== null}
              onClick={async () => {
                const ok = await run(
                  "percent",
                  () => setPercent({ data: { id: order.id, percent: Math.round(Number(percent)), reason } }),
                  "Advance updated",
                );
                if (ok) {
                  setReason("");
                  setShowPercent(false);
                }
              }}
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
