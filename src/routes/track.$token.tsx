import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Circle,
  Copy,
  Download,
  MessageCircle,
  PackageSearch,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/brand/Breadcrumbs";
import { EmptyState } from "@/components/brand/EmptyState";
import { StatusPill } from "@/components/brand/StatusPill";
import { RequestDetails } from "@/components/site/RequestDetails";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/config/payment-methods";
import { formatAmount, waLink } from "@/config/site";
import { submitPaymentProof } from "@/lib/checkout.functions";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { statusLabel } from "@/i18n/status";
import { downloadInvoice, downloadReceipt, purposeLabel } from "@/lib/invoice";
import { respondToQuote } from "@/lib/requests.functions";
import { getTracking, type TrackedOrder } from "@/lib/tracking.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/track/$token")({
  head: () => ({
    meta: [
      { title: "Track your order — GK furnish" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrackPage,
});

const FLOW = [
  "pending",
  "confirmed",
  "in_production",
  "ready",
  "out_for_delivery",
  "completed",
] as const;

function stepIndex(status: string) {
  if (status === "processing") return 1;
  if (status === "delivered") return 5;
  const i = (FLOW as readonly string[]).indexOf(status);
  return i < 0 ? 0 : i;
}

function OrderTracking({ order, token }: { order: TrackedOrder; token: string }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const sendProof = useServerFn(submitPaymentProof);
  const [method, setMethod] = useState<PaymentMethodId>("mpesa");
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);
  const due = Math.max(order.advanceRequired - order.paid, 0) > 0 && order.paid < order.advanceRequired
    ? Math.min(order.balance, Math.max(order.advanceRequired - order.paid, 0))
    : order.balance;
  const waiting = order.payments.some((p) => p.status === "pending");
  const current = stepIndex(order.status);
  const stopped = order.status === "cancelled" || order.status === "refunded";
  const lines = order.items.map((i) => ({
    name: i.product_name,
    qty: i.quantity,
    unitPrice: i.unit_price,
    details: [i.material, i.size, i.color].filter(Boolean).join(" · "),
  }));
  const deliveryLabel =
    order.deliveryFeeStatus === "free"
      ? t.delivery.free
      : order.deliveryFeeStatus === "pending"
        ? t.delivery.toBeConfirmed
        : formatAmount(order.deliveryFee ?? 0);
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam" });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {order.balance > 0 && order.status !== "cancelled" && (
          <section className="panel p-4 md:p-5">
            <h2 className="text-base font-bold">{t.track.howToPay}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.track.paySteps}</p>
            <p className="mt-3 text-sm text-navy">
              {t.track.amountDue}: <strong>{formatAmount(due)}</strong>
            </p>
            <p className="text-sm text-navy">Order {order.number}</p>
            <ul className="mt-3 space-y-2">
              {PAYMENT_METHODS.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <span><strong className="text-navy">{item.label}</strong> · {item.accountName} · {item.account}</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-gold-ink"
                    onClick={() => void navigator.clipboard?.writeText(item.account).then(() => toast.success(t.track.copied))}
                  >
                    {t.track.copy}
                  </button>
                </li>
              ))}
            </ul>
            {waiting && <p className="mt-3 text-sm font-semibold text-gold-ink">{t.track.awaiting}</p>}
            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setBusy(true);
                void sendProof({ data: { token, method, amount: Math.round(due), transactionId: tx.trim() } })
                  .then(async () => {
                    toast.success(t.track.proofSent);
                    setTx("");
                    await queryClient.invalidateQueries({ queryKey: ["tracking", token] });
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : t.validation.failed))
                  .finally(() => setBusy(false));
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={cn("rounded-lg border px-3 py-2 text-sm font-semibold", method === item.id ? "border-gold bg-gold-tint text-navy" : "border-input")}
                    onClick={() => setMethod(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="field-label" htmlFor="tx">{t.track.transactionId}</label>
              <input id="tx" className="field-input" value={tx} onChange={(e) => setTx(e.target.value)} placeholder="ABC123456" />
              <p className="text-xs text-muted-foreground">{t.track.transactionHint}</p>
              <button type="submit" className="btn-base btn-gold" disabled={busy || due <= 0}>{t.track.iHavePaid}</button>
              <a
                className="btn-base btn-outline-navy"
                href={waLink(`Order ${order.number}. I paid ${formatAmount(due)} by ${method}. Transaction ID: ${tx.trim() || "(not yet)"}.`)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4" />
                {t.track.whatsappProof}
              </a>
            </form>
          </section>
        )}
        <section className="panel p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">{t.track.progress}</h2>
            <StatusPill status={order.status}>{statusLabel(t, order.status)}</StatusPill>
          </div>
          {stopped ? (
            <p className="mt-3 text-sm text-danger">{statusLabel(t, order.status)}</p>
          ) : (
            <ol className="mt-4 grid gap-3 sm:grid-cols-6">
              {FLOW.map((s, i) => (
                <li
                  key={s}
                  className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1.5"
                >
                  {i <= current ? (
                    <CheckCircle2
                      className={cn(
                        "h-5 w-5 shrink-0",
                        i === current ? "text-gold-ink" : "text-success",
                      )}
                    />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-input" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      i <= current ? "text-navy" : "text-muted-foreground",
                    )}
                  >
                    {statusLabel(t, s)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {order.history.length > 0 && (
            <ol className="mt-5 space-y-2 border-l-2 border-gold/50 pl-4 text-sm">
              {order.history.map((h, i) => (
                <li key={i}>
                  <span className="font-semibold text-navy">{statusLabel(t, h.status)}</span>{" "}
                  <span className="text-xs text-muted-foreground">{when(h.created_at)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="panel p-4 md:p-5">
          <h2 className="text-base font-bold">{t.account.items}</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 py-2.5">
                <span className="text-navy">
                  {l.qty}× {l.name}
                  {l.details && (
                    <span className="block text-xs text-muted-foreground">{l.details}</span>
                  )}
                </span>
                <span className="tabular-nums">{formatAmount(l.qty * l.unitPrice)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-4 md:p-5">
          <h2 className="text-base font-bold">{t.account.payments}</h2>
          {order.payments.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t.account.noPayments}</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {order.payments.map((p) => {
                const paidUpTo = order.payments
                  .filter((x) => x.status === "completed" && x.updated_at <= p.updated_at)
                  .reduce((sum, x) => sum + x.amount, 0);
                return (
                  <li
                    key={`${p.created_at}-${p.amount}-${p.status}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand px-3 py-2"
                  >
                    <span>
                      <span className="font-semibold text-navy">{formatAmount(p.amount)}</span>{" "}
                      <span className="text-muted-foreground">
                        {purposeLabel(p.purpose)} · {statusLabel(t, p.status)} ·{" "}
                        {new Date(p.updated_at).toLocaleDateString("en-GB")}
                      </span>
                    </span>
                    {p.receipt_number && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-ink hover:underline"
                      onClick={() =>
                        downloadReceipt({
                          receiptNumber: p.receipt_number ?? `RCT-${order.number}`,
                          orderNumber: order.number,
                          paidAt: p.updated_at,
                          amount: p.amount,
                          purpose: p.purpose,
                          method: p.provider ?? "—",
                          customerName: order.customerName,
                          orderTotal: order.total,
                          totalPaid: paidUpTo,
                          lines,
                        })
                      }
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      {p.receipt_number ?? t.pay.receipt}
                    </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="h-fit space-y-4">
        <div className="kpi-card">
          <p className="text-sm text-muted-foreground">{t.success.reference}</p>
          <p className="font-display text-2xl font-bold text-navy">#{order.number}</p>
          <p className="text-xs text-muted-foreground">
            {t.account.placed}{" "}
            {new Date(order.createdAt).toLocaleDateString("en-GB", {
              timeZone: "Africa/Dar_es_Salaam",
            })}{" "}
            · {order.customerName}
          </p>
          <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t.cart.subtotal}</dt>
              <dd className="tabular-nums">{formatAmount(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t.delivery.label}</dt>
              <dd
                className={
                  order.deliveryFeeStatus === "free"
                    ? "font-semibold text-success"
                    : "font-semibold text-navy"
                }
              >
                {deliveryLabel}
              </dd>
            </div>
            <div className="flex justify-between font-bold text-navy">
              <dt>{t.account.total}</dt>
              <dd className="tabular-nums">{formatAmount(order.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {fill(t.checkout.advanceLabel, { percent: order.advancePercent })}
              </dt>
              <dd className="tabular-nums">{formatAmount(order.advanceRequired)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t.account.paid}</dt>
              <dd className="tabular-nums">{formatAmount(order.paid)}</dd>
            </div>
            <div className="flex justify-between font-semibold text-navy">
              <dt>{t.account.balance}</dt>
              <dd className="tabular-nums">{formatAmount(order.balance)}</dd>
            </div>
          </dl>
          {order.deliveryFeeStatus === "pending" && (
            <p className="mt-2 text-xs text-muted-foreground">{t.delivery.pendingNote}</p>
          )}
          <p className="mt-3 text-sm text-navy">
            <span className="text-muted-foreground">
              {order.fulfilmentMethod === "collection" ? t.steps.collectAt : t.steps.deliverTo}:
            </span>{" "}
            {order.location}
          </p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              className="btn-base btn-navy btn-sm"
              onClick={() =>
                downloadInvoice({
                  ref: order.number,
                  customerName: order.customerName,
                  location: order.location,
                  lines,
                  total: order.total,
                  subtotal: order.subtotal,
                  deliveryLabel,
                  paid: order.paid,
                  advancePercent: order.advancePercent,
                  advanceRequired: order.advanceRequired,
                  pay: statusLabel(t, order.paymentStatus),
                  ...(order.neededBy ? { neededBy: order.neededBy } : {}),
                })
              }
            >
              <Download className="h-4 w-4" />
              {t.pay.invoice}
            </button>
            <a
              href={waLink(`${t.whatsapp.orderPrefix} ${order.number}.`)}
              target="_blank"
              rel="noreferrer"
              className="btn-base btn-gold btn-sm"
            >
              <MessageCircle className="h-4 w-4" />
              {t.success.contactUs}
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TrackPage() {
  const { token } = Route.useParams();
  const { t } = useLang();
  const queryClient = useQueryClient();
  const load = useServerFn(getTracking);
  const respond = useServerFn(respondToQuote);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tracking", token],
    queryFn: () => load({ data: { token } }),
    retry: false,
  });

  const title = data?.kind === "request" ? t.track.requestTitle : t.track.title;

  return (
    <div className="bg-sand">
      <div className="container-page py-5 md:py-8">
        <Breadcrumbs items={[{ label: t.nav.home, href: "/" }, { label: title }]} />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display-lg">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.track.subtitle}</p>
          </div>
          {data && data.kind !== "none" && (
            <button
              type="button"
              className="btn-base btn-outline-navy btn-sm"
              onClick={() =>
                void navigator.clipboard?.writeText(window.location.href).then(
                  () => toast.success(t.track.linkCopied),
                  () => undefined,
                )
              }
            >
              <Copy className="h-4 w-4" />
              {t.track.copyLink}
            </button>
          )}
        </div>

        <div className="mt-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : isError || !data || data.kind === "none" ? (
            <EmptyState
              icon={<PackageSearch className="h-6 w-6" />}
              title={
                data?.kind === "none" && !data.available ? t.track.unavailable : t.track.notFound
              }
              action={
                <Link to="/contact" className="btn-base btn-gold">
                  {t.nav.contact}
                </Link>
              }
            />
          ) : data.kind === "order" ? (
            <OrderTracking order={data.order} token={token} />
          ) : (
            <RequestDetails
              request={data.request}
              onRespond={async (quoteId, response, message) => {
                try {
                  await respond({ data: { token, quoteId, response, message } });
                  toast.success(t.requests.responded);
                  await queryClient.invalidateQueries({ queryKey: ["tracking", token] });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t.validation.failed);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
