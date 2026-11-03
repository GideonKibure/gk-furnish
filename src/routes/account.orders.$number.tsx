import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Clock3, Loader2, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { PaymentPolicy } from "@/components/site/PaymentPolicy";
import { formatPrice } from "@/config/site";
import { useRequireCustomer } from "@/hooks/use-require-customer";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { getMyOrder } from "@/lib/account.functions";
import { startOrderPayment } from "@/lib/checkout.functions";
import { statusLabel } from "@/i18n/status";
import { downloadInvoice, downloadReceipt, purposeLabel } from "@/lib/invoice";

export const Route = createFileRoute("/account/orders/$number")({
  head: () => ({ meta: [{ title: "My order — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: AccountOrderPage,
});

type Order = NonNullable<Awaited<ReturnType<typeof getMyOrder>>>;

function AccountOrderPage() {
  const { number } = Route.useParams();
  const { t } = useLang();
  const nav = useNavigate();
  const { user } = useRequireCustomer();
  const load = useServerFn(getMyOrder);
  const start = useServerFn(startOrderPayment);
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    load({ data: { number } }).then(setOrder).catch(() => setOrder(null));
  }, [user?.id, number]);

  if (order === undefined) {
    return (
      <>
        <PageHeader title={number} />
        <div className="container-page section-y flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.common.loading}
        </div>
      </>
    );
  }

  if (order === null) {
    return (
      <>
        <PageHeader title={t.account.notFound} />
        <div className="container-page section-y">
          <Link to="/account" className="btn-base btn-gold">{t.account.back}</Link>
        </div>
      </>
    );
  }

  const o = order;
  const lines = o.order_items.map((i) => ({
    name: i.product_name,
    qty: i.quantity,
    unitPrice: Number(i.unit_price),
    details: [i.material, i.size, i.color].filter(Boolean).join(" · "),
  }));
  const completed = o.payments.filter((p) => p.status === "completed");
  const advanceLeft = Math.max(0, Math.round(o.advance_required) - Math.round(o.amount_paid));

  async function pay(kind: "advance" | "full") {
    const number = phone.trim() || o.phone;
    if (!/^[+\d\s()-]{7,20}$/.test(number)) {
      toast.error(t.validation.phoneInvalid);
      return;
    }
    setBusy(true);
    try {
      const r = await start({ data: { orderNumber: o.order_number, kind, phone: number } });
      void nav({ to: "/pay/$paymentId", params: { paymentId: r.paymentId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={o.order_number} subtitle={`${t.account.placed} ${new Date(o.created_at).toLocaleDateString()} · ${statusLabel(t, o.status)}`}>
        <Link to="/account" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-navy hover:text-gold">
          <ArrowLeft className="h-4 w-4" />
          {t.account.back}
        </Link>
      </PageHeader>
      <div className="container-page section-y grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border/80 bg-background p-5">
            <h2 className="font-semibold text-navy">{t.account.items}</h2>
            <ul className="mt-3 divide-y divide-border/70 text-sm">
              {lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3 py-2.5">
                  <span className="text-navy">
                    {l.qty}× {l.name}
                    {l.details && <span className="block text-xs text-muted-foreground">{l.details}</span>}
                  </span>
                  <span className="tabular-nums">{formatPrice(l.qty * l.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <p
              className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                o.specs_agreed_at ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
              }`}
            >
              {o.specs_agreed_at ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {o.specs_agreed_at ? t.account.specsAgreed : t.account.specsPending}
            </p>
          </section>

          <section className="rounded-2xl border border-border/80 bg-background p-5">
            <h2 className="font-semibold text-navy">{t.account.payments}</h2>
            {completed.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t.account.noPayments}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {completed.map((p) => {
                  const paidUpTo = completed
                    .filter((x) => x.updated_at <= p.updated_at)
                    .reduce((sum, x) => sum + x.amount, 0);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2">
                      <span>
                        <span className="font-semibold text-navy">{formatPrice(p.amount)}</span>{" "}
                        <span className="text-muted-foreground">
                          {purposeLabel(p.purpose)} · {new Date(p.updated_at).toLocaleDateString()}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline"
                        onClick={() =>
                          downloadReceipt({
                            receiptNumber: p.receipt_number ?? `RCT-${o.order_number}`,
                            orderNumber: o.order_number,
                            paidAt: p.updated_at,
                            amount: p.amount,
                            purpose: p.purpose,
                            method: p.provider ?? "Mobile money",
                            customerName: o.customer_name,
                            phone: o.phone,
                            ...(o.email ? { email: o.email } : {}),
                            orderTotal: o.total_amount,
                            totalPaid: paidUpTo,
                            lines,
                          })
                        }
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        {p.receipt_number ?? t.pay.receipt}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border/80 bg-background p-5">
            <h2 className="font-semibold text-navy">{t.account.history}</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-gold/40 pl-4 text-sm">
              {o.order_status_history.map((h, i) => (
                <li key={i}>
                  <p className="font-semibold text-navy">{statusLabel(t, h.status)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                  {h.note && <p className="mt-0.5 text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="h-fit space-y-4">
          <div className="rounded-2xl border border-border/80 bg-background p-5 shadow-[var(--shadow-card)]">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between font-semibold text-navy">
                <dt>{t.account.total}</dt>
                <dd>{formatPrice(o.total_amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{fill(t.checkout.advanceLabel, { percent: o.advance_percent })}</dt>
                <dd>{formatPrice(o.advance_required)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.account.paid}</dt>
                <dd>{formatPrice(o.amount_paid) ?? "TSh 0"}</dd>
              </div>
              <div className="flex justify-between font-semibold text-navy">
                <dt>{t.account.balance}</dt>
                <dd>{formatPrice(o.balance) ?? "TSh 0"}</dd>
              </div>
            </dl>
            {o.balance > 0 && o.status !== "cancelled" && (
              <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
                <div>
                  <label className="field-label" htmlFor="o-pay-phone">{t.checkout.phone}</label>
                  <input
                    id="o-pay-phone"
                    type="tel"
                    className="field-input"
                    placeholder={o.phone}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                {advanceLeft > 0 && (
                  <button type="button" className="btn-base btn-gold w-full" disabled={busy} onClick={() => void pay("advance")}>
                    {fill(t.pay.payAdvanceRest, { amount: formatPrice(advanceLeft) ?? "" })}
                  </button>
                )}
                <button
                  type="button"
                  className={`btn-base w-full ${advanceLeft > 0 ? "btn-outline-navy" : "btn-gold"}`}
                  disabled={busy}
                  onClick={() => void pay("full")}
                >
                  {fill(t.pay.payBalance, { amount: formatPrice(o.balance) ?? "" })}
                </button>
              </div>
            )}
            <button
              type="button"
              className="btn-base btn-outline-navy mt-3 w-full"
              onClick={() =>
                downloadInvoice({
                  ref: o.order_number,
                  customerName: o.customer_name,
                  phone: o.phone,
                  ...(o.email ? { email: o.email } : {}),
                  location: o.delivery_location,
                  lines,
                  total: o.total_amount,
                  paid: o.amount_paid,
                  advancePercent: o.advance_percent,
                  advanceRequired: o.advance_required,
                  kind: o.amount_paid >= o.total_amount ? "Full" : "Advance",
                  pay: statusLabel(t, o.payment_status),
                  ...(o.needed_by ? { neededBy: o.needed_by } : {}),
                })
              }
            >
              {t.pay.invoice}
            </button>
          </div>
          <PaymentPolicy compact />
        </aside>
      </div>
    </>
  );
}
