import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Circle,
  Copy,
  Download,
  MessageCircle,
  PackageSearch,
  Phone,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/brand/Breadcrumbs";
import { EmptyState } from "@/components/brand/EmptyState";
import { StatusPill } from "@/components/brand/StatusPill";
import { MoneyTimeline } from "@/components/site/MoneyTimeline";
import { PayInstructions } from "@/components/site/PayInstructions";
import { WalletPicker } from "@/components/site/WalletPicker";
import { RequestDetails } from "@/components/site/RequestDetails";
import { formatAmount, telLink, waLink } from "@/config/site";
import { getCheckoutConfig, startOrderPayment, submitPaymentProof } from "@/lib/checkout.functions";
import { phoneMatchesWallet, type WalletId } from "@/lib/palmpesa";
import { DEFAULT_PAY_ACCOUNTS, DEFAULT_PAY_METHODS } from "@/lib/pay-accounts";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { statusLabel } from "@/i18n/status";
import { downloadInvoice, downloadReceipt, purposeLabel } from "@/lib/invoice";
import { respondToQuote } from "@/lib/requests.functions";
import { getTracking, type TrackedOrder } from "@/lib/tracking.functions";
import { CUSTOMER_STAGES, customerStageIndex, nextTrackStep, paymentCustomerState } from "@/lib/track-next";
import { moneyStage } from "@/lib/policy";
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

const STAGE_COPY = {
  ordered: "stageOrdered",
  paid: "stagePaid",
  production: "stageProduction",
  received: "stageReceived",
} as const;

function OrderTracking({ order, token }: { order: TrackedOrder; token: string }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const nav = useNavigate();
  const sendProof = useServerFn(submitPaymentProof);
  const startPay = useServerFn(startOrderPayment);
  const loadConfig = useServerFn(getCheckoutConfig);
  const [wallet, setWallet] = useState<WalletId>("mpesa");
  const [payPhone, setPayPhone] = useState("");
  const { data: config } = useQuery({ queryKey: ["checkout-config"], queryFn: () => loadConfig(), staleTime: 5 * 60_000 });
  const [method, setMethod] = useState<"mpesa" | "airtel" | "bank">("mpesa");
  const methods = config?.methods ?? DEFAULT_PAY_METHODS;
  const proofMethods = (
    [
      methods.mpesa ? (["mpesa", t.track.mpesaLipa] as const) : null,
      methods.airtel ? (["airtel", t.track.airtel] as const) : null,
      methods.nmb ? (["bank", t.track.nmb] as const) : null,
    ] as const
  ).filter((item) => item != null);
  useEffect(() => {
    const first = proofMethods[0]?.[0];
    if (first && !proofMethods.some(([id]) => id === method)) setMethod(first);
  }, [method, methods.airtel, methods.mpesa, methods.nmb, proofMethods]);
  const [sender, setSender] = useState("");
  const [shot, setShot] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const due = Math.max(order.advanceRequired - order.paid, 0) > 0 && order.paid < order.advanceRequired
    ? Math.min(order.balance, Math.max(order.advanceRequired - order.paid, 0))
    : order.balance;
  const waiting = order.payments.some((p) => paymentCustomerState(p.status) === "pending");
  const stage = customerStageIndex(order.status);
  const stopped = stage === "cancelled" || stage === "refunded";
  const next = nextTrackStep(order);
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
        <section className="panel p-4 md:p-5">
          <h2 className="text-base font-bold">{t.track.nextTitle}</h2>
          <p className="mt-2 text-sm text-navy">
            {next.id === "cancelled"
              ? t.track.stoppedCancelled
              : next.id === "refunded"
                ? t.track.stoppedRefunded
                : next.id === "advance"
                  ? fill(t.track.nextAdvance, { amount: formatAmount(next.amount) })
                  : next.id === "design"
                    ? t.track.nextDesign
                    : next.id === "building"
                      ? t.track.nextBuilding
                      : next.id === "balance"
                        ? `${fill(t.track.nextBalance, { amount: formatAmount(next.amount) })} ${
                            next.delivery === "free"
                              ? t.track.nextFeeFree
                              : next.delivery === "confirmed" && next.fee != null && next.fee > 0
                                ? fill(t.track.nextFeeAmount, { amount: formatAmount(next.fee) })
                                : t.track.nextFeePending
                          }`
                        : fill(next.method === "collection" ? t.track.nextCollect : t.track.nextDeliver, {
                            place: next.method === "collection" ? order.collectionAddress || order.location : order.location,
                          })}
          </p>
          {order.completionHours != null ? (
            <p className="mt-2 text-sm text-muted-foreground">{fill(t.track.expectedHours, { hours: String(order.completionHours) })}</p>
          ) : null}
          {order.neededBy ? (
            <p className="mt-1 text-sm text-muted-foreground">{fill(t.track.requestedDate, { date: order.neededBy })}</p>
          ) : null}
        </section>
        {order.balance > 0 && order.status !== "cancelled" && (
          <section className="panel p-4 md:p-5">
            <h2 className="text-base font-bold">{t.track.howToPay}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{config?.onlinePayment ? t.track.promptBody : t.track.paySteps}</p>
            {config?.onlinePayment && (
              <form
                className="mt-4 grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!phoneMatchesWallet(payPhone, wallet)) {
                    toast.error(t.checkout.walletMismatch);
                    return;
                  }
                  setBusy(true);
                  void startPay({
                    data: {
                      trackingToken: token,
                      kind: order.paid < order.advanceRequired ? "advance" : "full",
                      phone: payPhone.trim(),
                      wallet,
                    },
                  })
                    .then((r) => nav({ to: "/pay/$paymentId", params: { paymentId: r.paymentId } }))
                    .catch((err) => toast.error(err instanceof Error ? err.message : t.validation.failed))
                    .finally(() => setBusy(false));
                }}
              >
                <p className="text-sm font-semibold text-navy">{t.track.promptTitle}</p>
                <WalletPicker value={wallet} onChange={setWallet} label={t.checkout.walletTitle} />
                <label className="field-label" htmlFor="prompt-phone">{t.track.promptPhone}</label>
                <input id="prompt-phone" type="tel" className="field-input" placeholder={order.phoneMasked} value={payPhone} onChange={(e) => setPayPhone(e.target.value)} />
                <button type="submit" className="btn-base btn-gold" disabled={busy || due <= 0}>{t.track.sendPrompt}</button>
              </form>
            )}
            {config?.onlinePayment && <p className="mt-5 text-sm font-semibold text-navy">{t.track.manualTitle}</p>}
            {proofMethods.length === 0 ? (
              <p className="mt-3 rounded-lg bg-sand p-3 text-sm text-navy">{t.checkout.methodsOff}</p>
            ) : (
            <>
            <PayInstructions
              accounts={config?.pay ?? DEFAULT_PAY_ACCOUNTS}
              methods={methods}
              channel={method === "bank" ? "bank" : "mobile"}
              amount={due}
              orderNumber={order.number}
            />
            {waiting && <p className="mt-3 text-sm font-semibold text-gold-ink">{t.track.awaiting}</p>}
            <form
              className="mt-4 grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (sender.trim().length < 2) {
                  toast.error(t.track.senderName);
                  return;
                }
                if (!shot || !["image/jpeg", "image/png", "image/webp"].includes(shot.type) || shot.size > 5_000_000) {
                  toast.error(t.track.proofImage);
                  return;
                }
                setBusy(true);
                const reader = new FileReader();
                reader.onload = () => {
                  const raw = String(reader.result ?? "");
                  const base64 = raw.slice(raw.indexOf(",") + 1);
                  void sendProof({
                    data: {
                      token,
                      method,
                      amount: Math.round(due),
                      senderName: sender.trim(),
                      screenshot: { name: shot.name, type: shot.type as "image/jpeg" | "image/png" | "image/webp", base64 },
                    },
                  })
                    .then(async () => {
                      toast.success(t.track.proofSent);
                      setSender("");
                      setShot(null);
                      await queryClient.invalidateQueries({ queryKey: ["tracking", token] });
                    })
                    .catch((err) => toast.error(err instanceof Error ? err.message : t.validation.failed))
                    .finally(() => setBusy(false));
                };
                reader.onerror = () => {
                  setBusy(false);
                  toast.error(t.track.proofImage);
                };
                reader.readAsDataURL(shot);
              }}
            >
              <p className="text-sm font-semibold text-navy">{t.track.howPaid}</p>
              <div className={cn("grid gap-2", proofMethods.length > 1 && "sm:grid-cols-3")}>
                {proofMethods.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn("rounded-lg border px-3 py-2 text-sm font-semibold", method === id ? "border-gold bg-gold-tint text-navy" : "border-input")}
                    onClick={() => setMethod(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="field-label" htmlFor="sender">{t.track.senderName}</label>
              <input id="sender" className="field-input" value={sender} onChange={(e) => setSender(e.target.value)} />
              <label className="field-label" htmlFor="shot">{t.track.screenshot}</label>
              <input
                id="shot"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="field-input"
                onChange={(e) => setShot(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">{t.track.proofImage}</p>
              <button type="submit" className="btn-base btn-gold" disabled={busy || due <= 0 || !proofMethods.some(([id]) => id === method)}>{t.track.iHavePaid}</button>
              <a
                className="btn-base btn-outline-navy"
                href={waLink(`Order ${order.number}. I paid ${formatAmount(due)} by ${method}. Sender: ${sender.trim() || "(not yet)"}.`)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4" />
                {t.track.whatsappProof}
              </a>
            </form>
            </>
            )}
          </section>
        )}
        <section className="panel p-4 md:p-5">
          <MoneyTimeline
            current={moneyStage({
              paid: order.paid,
              advanceRequired: order.advanceRequired,
              specsAgreed: order.specsAgreed,
              status: order.status,
            })}
          />
        </section>
        <section className="panel p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">{t.track.progress}</h2>
            <StatusPill status={order.status}>{statusLabel(t, order.status)}</StatusPill>
          </div>
          {stopped ? (
            <p className="mt-3 text-sm font-semibold text-navy">{stage === "cancelled" ? t.track.stoppedCancelled : t.track.stoppedRefunded}</p>
          ) : (
            <ol className="mt-4 grid gap-3 sm:grid-cols-4">
              {CUSTOMER_STAGES.map((name, i) => {
                const here = typeof stage === "number" && i === stage;
                const done = typeof stage === "number" && i <= stage;
                return (
                  <li key={name} className="flex items-start gap-2 sm:flex-col sm:gap-1.5" aria-current={here ? "step" : undefined}>
                    {done ? (
                      <CheckCircle2 className={cn("h-5 w-5 shrink-0", here ? "text-gold-ink" : "text-success")} />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-input" />
                    )}
                    <span className={cn("text-xs font-medium", done ? "text-navy" : "text-muted-foreground")}>
                      {statusLabel(t, name === "ordered" ? "pending" : name === "paid" ? "confirmed" : name === "production" ? "in_production" : "completed")}
                      {here ? ` · ${t.track.stageCurrent}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.track[STAGE_COPY[name]]}</span>
                  </li>
                );
              })}
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
                const shown = paymentCustomerState(p.status);
                const paidUpTo = order.payments
                  .filter((x) => paymentCustomerState(x.status) === "confirmed" && x.updated_at <= p.updated_at)
                  .reduce((sum, x) => sum + x.amount, 0);
                const stateLabel = shown === "confirmed" ? t.track.payConfirmed : shown === "rejected" ? t.track.payRejected : t.track.payPending;
                return (
                  <li
                    key={`${p.created_at}-${p.amount}-${p.status}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand px-3 py-2"
                  >
                    <span>
                      <span className="font-semibold text-navy">{formatAmount(p.amount)}</span>{" "}
                      <span className="text-muted-foreground">
                        {purposeLabel(p.purpose)} · {p.provider || "—"} · {stateLabel} ·{" "}
                        {new Date(p.created_at).toLocaleDateString("en-GB")}
                      </span>
                    </span>
                    {shown === "confirmed" && p.receipt_number ? (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-gold-ink hover:underline"
                      onClick={() =>
                        downloadReceipt({
                          receiptNumber: p.receipt_number ?? "",
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
                      {t.track.downloadReceipt}
                    </button>
                    ) : null}
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
              className="btn-base btn-outline-navy btn-sm min-h-11"
            >
              <MessageCircle className="h-4 w-4" />
              {t.success.contactUs}
            </a>
            <a href={telLink()} className="btn-base btn-outline-navy btn-sm min-h-11">
              <Phone className="h-4 w-4" />
              {t.track.callUs}
            </a>
            <Link to="/policies" className="btn-base btn-outline-navy btn-sm min-h-11">
              {t.track.policies}
            </Link>
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
        {data && data.kind !== "none" ? <p className="mt-2 text-sm text-navy">{t.track.saveReminder}</p> : null}

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
