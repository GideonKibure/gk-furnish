import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock3, Download, MapPinned, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StatusPill } from "@/components/brand/StatusPill";
import { AccountShell } from "@/components/site/AccountShell";
import { PaymentPolicy } from "@/components/site/PaymentPolicy";
import { formatAmount, formatPrice } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { statusLabel } from "@/i18n/status";
import { getMyOrder } from "@/lib/account.functions";
import { getCheckoutConfig, startOrderPayment } from "@/lib/checkout.functions";
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
  const { user } = useAuthUser();
  const load = useServerFn(getMyOrder);
  const start = useServerFn(startOrderPayment);
  const loadConfig = useServerFn(getCheckoutConfig);
  const { data: config } = useQuery({ queryKey: ["checkout-config"], queryFn: () => loadConfig(), staleTime: 5 * 60_000 });
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      load({ data: { number } })
        .then((next) => {
          if (!alive) return;
          setOrder(next);
          if (next?.payments.some((p) => p.status === "pending")) timer = setTimeout(tick, 8000);
        })
        .catch(() => {
          if (alive) setOrder(null);
        });
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [user?.id, number]);

  const crumbs = [
    { label: t.account.title, href: "/account" },
    { label: t.account.orders, href: "/account" },
    { label: `#${number}` },
  ];

  if (order === undefined || order === null) {
    return (
      <AccountShell active="overview" title={`#${number}`} crumbs={crumbs}>
        {order === undefined ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : (
          <div className="panel p-5">
            <p className="text-navy">{t.account.notFound}</p>
            <Link to="/account" className="btn-base btn-gold mt-4">{t.account.back}</Link>
          </div>
        )}
      </AccountShell>
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
  const deliveryLabel =
    o.delivery_fee_status === "free"
      ? t.delivery.free
      : o.delivery_fee_status === "pending"
        ? t.delivery.toBeConfirmed
        : formatAmount(o.delivery_fee ?? 0);
  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" });

  async function pay(kind: "advance" | "full") {
    const num = phone.trim() || o.phone;
    if (!/^[+\d\s()-]{7,20}$/.test(num)) {
      toast.error(t.validation.phoneInvalid);
      return;
    }
    setBusy(true);
    try {
      const r = await start({ data: { orderNumber: o.order_number, kind, phone: num } });
      void nav({ to: "/pay/$paymentId", params: { paymentId: r.paymentId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell active="overview" title={`#${o.order_number}`} crumbs={crumbs}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <StatusPill status={o.status}>{statusLabel(t, o.status)}</StatusPill>
        <span>
          {t.account.placed} {new Date(o.created_at).toLocaleDateString("en-GB", { timeZone: "Africa/Dar_es_Salaam" })}
        </span>
        {o.tracking_token && (
          <Link to="/track/$token" params={{ token: o.tracking_token }} className="inline-flex items-center gap-1 font-semibold text-gold-ink hover:underline">
            <MapPinned className="h-4 w-4" />
            {t.track.open}
          </Link>
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="panel p-4 md:p-5">
            <h2 className="text-base font-bold">{t.account.items}</h2>
            <ul className="mt-2 divide-y divide-border text-sm">
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
              className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                o.specs_agreed_at ? "bg-success-soft text-success" : "bg-warn-soft text-warn"
              }`}
            >
              {o.specs_agreed_at ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {o.specs_agreed_at ? t.account.specsAgreed : t.account.specsPending}
            </p>
          </section>

          <section className="panel p-4 md:p-5">
            <h2 className="text-base font-bold">{t.account.payments}</h2>
            {completed.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t.account.noPayments}</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {completed.map((p) => {
                  const paidUpTo = completed.filter((x) => x.updated_at <= p.updated_at).reduce((sum, x) => sum + x.amount, 0);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand px-3 py-2">
                      <span>
                        <span className="font-semibold text-navy">{formatPrice(p.amount)}</span>{" "}
                        <span className="text-muted-foreground">
                          {purposeLabel(p.purpose)} · {new Date(p.updated_at).toLocaleDateString("en-GB")}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-ink hover:underline"
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

          <section className="panel p-4 md:p-5">
            <h2 className="text-base font-bold">{t.account.payments}</h2>
            {o.payments.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t.account.noPayments}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {o.payments.map((p) => (
                  <li key={p.id} className="rounded-lg bg-sand px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-navy">{formatAmount(p.amount)}</span>
                      <StatusPill tone={p.status === "completed" ? "success" : p.status === "pending" ? "pending" : "danger"}>
                        {statusLabel(t, p.status)}
                      </StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {purposeLabel(p.purpose)} · {p.method ?? "—"} · {when(p.status === "completed" ? p.updated_at : p.created_at)}
                    </p>
                    {p.reference && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.account.paymentReference}: {p.reference}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-4 md:p-5">
            <h2 className="text-base font-bold">{t.account.history}</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-gold/50 pl-4 text-sm">
              {o.order_status_history.map((h, i) => (
                <li key={i}>
                  <p className="font-semibold text-navy">{statusLabel(t, h.status)}</p>
                  <p className="text-xs text-muted-foreground">{when(h.created_at)}</p>
                  {h.note && <p className="mt-0.5 text-muted-foreground">{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="h-fit space-y-4">
          <div className="kpi-card">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.cart.subtotal}</dt>
                <dd className="tabular-nums">{formatAmount(o.subtotal_amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.delivery.label}</dt>
                <dd className={o.delivery_fee_status === "free" ? "font-semibold text-success" : "font-semibold text-navy"}>{deliveryLabel}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-bold text-navy">
                <dt>{t.account.total}</dt>
                <dd className="tabular-nums">{formatAmount(o.total_amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{fill(t.checkout.advanceLabel, { percent: o.advance_percent })}</dt>
                <dd className="tabular-nums">{formatAmount(o.advance_required)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.account.paid}</dt>
                <dd className="tabular-nums">{formatAmount(o.amount_paid)}</dd>
              </div>
              <div className="flex justify-between font-semibold text-navy">
                <dt>{t.account.balance}</dt>
                <dd className="tabular-nums">{formatAmount(o.balance)}</dd>
              </div>
            </dl>
            {o.amount_paid > 0 && o.balance > 0 && <p className="mt-2 text-xs font-semibold text-gold-ink">{t.account.depositPaid}</p>}
            {o.delivery_fee_status === "pending" && <p className="mt-2 text-xs text-muted-foreground">{t.delivery.pendingNote}</p>}
            {o.balance > 0 && o.status !== "cancelled" && config?.onlinePayment && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <div>
                  <label className="field-label" htmlFor="o-pay-phone">{t.checkout.phone}</label>
                  <input id="o-pay-phone" type="tel" className="field-input" placeholder={o.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
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
            {o.balance > 0 && o.status !== "cancelled" && config && !config.onlinePayment && (
              <p className="mt-3 rounded-lg bg-sand p-3 text-xs text-navy/80">{t.checkout.offline}</p>
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
                  subtotal: o.subtotal_amount,
                  deliveryLabel,
                  paid: o.amount_paid,
                  advancePercent: o.advance_percent,
                  advanceRequired: o.advance_required,
                  kind: o.amount_paid >= o.total_amount ? "Full" : "Advance",
                  pay: statusLabel(t, o.payment_status),
                  ...(o.needed_by ? { neededBy: o.needed_by } : {}),
                })
              }
            >
              <Download className="h-4 w-4" />
              {t.pay.invoice}
            </button>
          </div>
          <PaymentPolicy compact />
        </aside>
      </div>
    </AccountShell>
  );
}
