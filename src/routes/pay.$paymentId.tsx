import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MessageCircle, Receipt, Smartphone, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { WalletPicker } from "@/components/site/WalletPicker";
import { PaymentPolicy } from "@/components/site/PaymentPolicy";
import { formatPrice, waLink } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { trackEvent } from "@/lib/analytics";
import { cancelCustomerPayment, getPaymentStatus, resendPaymentPrompt, startOrderPayment } from "@/lib/checkout.functions";
import { completionHours, siteSettingsQuery } from "@/lib/site-content";
import { phoneMatchesWallet, type WalletId } from "@/lib/palmpesa";
import { formatPromptClock } from "@/lib/prompt-window";
import { downloadInvoice, downloadReceipt, receiptText, type ReceiptData } from "@/lib/invoice";

export const Route = createFileRoute("/pay/$paymentId")({
  head: () => ({ meta: [{ title: "Payment — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: PayPage,
});

type Status = Awaited<ReturnType<typeof getPaymentStatus>>;

function PayPage() {
  const { paymentId } = Route.useParams();
  const { t } = useLang();
  const nav = useNavigate();
  const { user } = useAuthUser();
  const load = useServerFn(getPaymentStatus);
  const resend = useServerFn(resendPaymentPrompt);
  const cancelPay = useServerFn(cancelCustomerPayment);
  const cancelDialog = useRef<HTMLDialogElement>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const start = useServerFn(startOrderPayment);
  const [data, setData] = useState<Status | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [wallet, setWallet] = useState<WalletId>("mpesa");
  const [showPhone, setShowPhone] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [clock, setClock] = useState(() => Date.now());
  const paidTracked = useRef(false);
  const { data: settings } = useQuery(siteSettingsQuery);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expiredChecks = 0;
    const started = Date.now();
    setData(null);
    setMissing(false);
    setWaiting(true);
    const tick = async () => {
      try {
        const next = await load({ data: { paymentId } });
        if (!alive) return;
        setData(next);
        if (next.status === "completed" && !paidTracked.current) {
          paidTracked.current = true;
          trackEvent("payment_completed", { payment_id: paymentId });
        }
        if (next.status === "pending") {
          const deadline = next.expiresAt
            ? new Date(next.expiresAt).getTime() + 5_000
            : started + 120_000;
          if (Date.now() < deadline) timer = setTimeout(tick, 3000);
          else setWaiting(false);
        } else if (next.status === "expired" && expiredChecks < 30) {
          expiredChecks += 1;
          timer = setTimeout(tick, 10_000);
        }
      } catch {
        if (alive) setMissing(true);
      }
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId]);

  useEffect(() => {
    if (data?.status !== "pending" || !data.expiresAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [data?.status, data?.expiresAt]);

  useEffect(() => {
    const node = cancelDialog.current;
    if (!node) return;
    if (confirmCancel && !node.open) node.showModal();
    if (!confirmCancel && node.open) node.close();
  }, [confirmCancel]);

  async function confirmCancelPayment() {
    setBusy(true);
    try {
      const result = await cancelPay({ data: { paymentId } });
      if (result.outcome === "paid") toast.message(t.pay.cancelPaid);
      else if (result.outcome === "review") toast.error(t.pay.cancelReview);
      else if (result.outcome === "wait" || result.outcome === "cancel") toast.error(t.pay.cancelWait);
      else toast.success(t.pay.cancelDone);
      const next = await load({ data: { paymentId } });
      setData(next);
      setConfirmCancel(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  async function payAgain(kind: "advance" | "full") {
    const number = phone.trim() || data?.order.phone || "";
    if (!/^[+\d\s()-]{7,20}$/.test(number)) {
      setShowPhone(true);
      toast.error(t.validation.phoneInvalid);
      return;
    }
    if (!phoneMatchesWallet(number, wallet)) {
      setShowPhone(true);
      toast.error(t.checkout.walletMismatch);
      return;
    }
    setBusy(true);
    try {
      const r = await start({ data: { paymentId, kind, phone: number, wallet } });
      void nav({ to: "/pay/$paymentId", params: { paymentId: r.paymentId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <>
        <PageHeader title={t.pay.notFound} />
        <div className="container-page section-y">
          <Link to="/" className="btn-base btn-gold">{t.common.backHome}</Link>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title={t.pay.title} />
        <div className="container-page section-y flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.common.loading}
        </div>
      </>
    );
  }

  const o = data.order;
  const lines = o.items.map((i) => ({
    name: i.product_name,
    qty: i.quantity,
    unitPrice: i.unit_price,
    details: [i.material, i.size, i.color].filter(Boolean).join(" · "),
  }));
  const receipt: ReceiptData | null = data.status === "completed" && data.receiptNumber
    ? {
        receiptNumber: data.receiptNumber,
        orderNumber: o.number,
        paidAt: data.paidAt,
        amount: data.amount,
        purpose: data.purpose,
        method: data.provider ?? "Mobile money",
        customerName: o.customerName,
        phone: o.phone,
        ...(o.email ? { email: o.email } : {}),
        orderTotal: o.total,
        totalPaid: o.paid,
        lines,
      }
    : null;
  const advanceLeft = Math.max(0, Math.round(o.advanceRequired) - Math.round(o.paid));
  const timeLeft = data.expiresAt ? new Date(data.expiresAt).getTime() - clock : null;
  const title = data.status === "completed" ? t.pay.paidTitle : data.status === "pending" ? t.pay.title : t.pay.failedTitle;

  return (
    <>
      <PageHeader title={title} subtitle={`${t.pay.order} ${o.number}`} />
      <div className="container-page section-y grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-xl border border-border/80 bg-background p-6 shadow-[var(--shadow-card)] md:p-8">
          {data.status === "pending" && (
            <div>
              <Smartphone className="h-10 w-10 text-gold-ink" />
              <p className="mt-4 text-lg text-navy">
                {fill(t.pay.body, { phone: data.phone, amount: formatPrice(data.amount) ?? "", wallet: data.wallet || t.pay.walletFallback })}
              </p>
              {timeLeft != null && timeLeft > 0 && (
                <p className="mt-4 text-2xl font-semibold tabular-nums text-navy" aria-live="polite">
                  {fill(t.pay.countdown, { time: formatPromptClock(timeLeft) })}
                </p>
              )}
              {waiting ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.pay.waiting}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-navy">{t.pay.confirmSoon}</p>
                  {o.trackingToken && (
                    <Link to="/track/$token" params={{ token: o.trackingToken }} className="btn-base btn-outline-navy">
                      {t.pay.trackOrder}
                    </Link>
                  )}
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-base btn-outline-navy"
                  disabled={busy}
                  onClick={() => setConfirmCancel(true)}
                >
                  {t.pay.cancel}
                </button>
                {data.canResend && (
                <button
                  type="button"
                  className="btn-base btn-outline-navy"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await resend({ data: { paymentId } });
                      toast.success(t.pay.resent);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : t.validation.failed);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t.pay.resend}
                </button>
                )}
              </div>
            </div>
          )}

          {data.status === "completed" && (
            <div>
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <p className="mt-4 text-lg text-navy">
                {fill(t.pay.paidBody, { amount: formatPrice(data.amount) ?? "", order: o.number })}
              </p>
              {data.receiptNumber && <p className="mt-1 text-sm text-muted-foreground">{data.receiptNumber}</p>}
              <div className="mt-6 flex flex-wrap gap-3">
                {receipt && (
                  <>
                    <button type="button" className="btn-base btn-gold" onClick={() => downloadReceipt(receipt)}>
                      <Receipt className="h-4 w-4" />
                      {t.pay.receipt}
                    </button>
                    <a className="btn-base btn-outline-navy" href={waLink(receiptText(receipt))} target="_blank" rel="noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      {t.pay.shareReceipt}
                    </a>
                  </>
                )}
                <button
                  type="button"
                  className="btn-base btn-outline-navy"
                  onClick={() =>
                    downloadInvoice({
                      ref: o.number,
                      customerName: o.customerName,
                      phone: o.phone,
                      ...(o.email ? { email: o.email } : {}),
                      location: o.location,
                      lines,
                      total: o.total,
                      paid: o.paid,
                      advancePercent: o.advancePercent,
                      advanceRequired: o.advanceRequired,
                      kind: o.paid >= o.total ? "Full" : "Advance",
                      pay: o.paid >= o.total ? "Paid in full" : "Advance paid",
                    })
                  }
                >
                  {t.pay.invoice}
                </button>
                {user && (
                  <Link to="/account/orders/$number" params={{ number: o.number }} className="btn-base btn-outline-navy">
                    {t.pay.viewOrder}
                  </Link>
                )}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">{fill(t.pay.readyIn, { hours: completionHours(settings) })}</p>
              {o.trackingToken && (
                <Link to="/track/$token" params={{ token: o.trackingToken }} className="btn-base btn-outline-navy mt-4">
                  {t.pay.trackOrder}
                </Link>
              )}
              <a className="btn-base btn-outline-navy mt-4" href={waLink(`${t.pay.order} ${o.number}`)} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" />
                {t.common.whatsapp}
              </a>
            </div>
          )}

          {(data.status === "failed" || data.status === "expired") && (
            <div>
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="mt-4 text-lg text-navy">
                {data.status === "expired"
                  ? o.status === "cancelled"
                    ? t.pay.timedOut
                    : t.pay.expiredBody
                  : data.failureReason === "CANCELLED"
                    ? t.pay.cancelledBody
                    : data.failureReason === "REJECTED"
                      ? t.pay.rejectedBody
                      : t.pay.failedBody}
              </p>
            </div>
          )}

          {data.status !== "pending" && o.balance > 0 && o.status !== "cancelled" && (
            <div className="mt-8 border-t border-border/70 pt-6">
              {(showPhone || data.status !== "completed") && (
                <div className="mb-4 max-w-md">
                  <p className="mb-2 text-sm font-semibold text-navy">{t.checkout.walletTitle}</p>
                  <WalletPicker value={wallet} onChange={setWallet} label={t.checkout.walletTitle} />
                  <label className="field-label mt-4" htmlFor="pay-phone">{t.checkout.phone}</label>
                  <input
                    id="pay-phone"
                    type="tel"
                    inputMode="tel"
                    className="field-input"
                    placeholder={o.phone}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {advanceLeft > 0 && (
                  <button type="button" className="btn-base btn-gold" disabled={busy} onClick={() => void payAgain("advance")}>
                    {data.status === "completed"
                      ? fill(t.pay.payAdvanceRest, { amount: formatPrice(advanceLeft) ?? "" })
                      : `${t.pay.tryAgain} · ${formatPrice(advanceLeft)}`}
                  </button>
                )}
                <button
                  type="button"
                  className={advanceLeft > 0 ? "btn-base btn-outline-navy" : "btn-base btn-gold"}
                  disabled={busy}
                  onClick={() => void payAgain("full")}
                >
                  {fill(t.pay.payBalance, { amount: formatPrice(o.balance) ?? "" })}
                </button>
                {data.status === "completed" && !showPhone && (
                  <button type="button" className="text-sm font-semibold text-navy underline" onClick={() => setShowPhone(true)}>
                    {t.pay.otherNumber}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="h-fit space-y-4">
          <div className="rounded-xl border border-border/80 bg-background p-5">
            <ul className="space-y-2 text-sm">
              {o.items.map((i, k) => (
                <li key={k} className="flex justify-between gap-3">
                  <span className="text-navy">
                    {i.quantity}× {i.product_name}
                  </span>
                  <span className="tabular-nums">{formatPrice(i.unit_price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-border/70 pt-3 text-sm">
              <div className="flex justify-between font-semibold text-navy">
                <dt>{t.checkout.total}</dt>
                <dd>{formatPrice(o.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.account.paid}</dt>
                <dd>{formatPrice(o.paid) ?? "TSh 0"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t.pay.balanceLeft}</dt>
                <dd>{formatPrice(o.balance) ?? "TSh 0"}</dd>
              </div>
            </dl>
          </div>
          <PaymentPolicy compact />
        </aside>
      </div>
      <dialog
        ref={cancelDialog}
        className="fixed inset-0 z-[80] m-auto h-fit max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-xl backdrop:bg-navy/40"
        onCancel={(event) => {
          event.preventDefault();
          if (busy) return;
          setConfirmCancel(false);
        }}
      >
        <h2 className="text-lg font-semibold text-navy">{t.pay.cancelTitle}</h2>
        <p className="mt-2 text-sm text-navy">{t.pay.cancelBody}</p>
        <div className="mt-4 grid gap-2">
          <button type="button" className="btn-base btn-gold" disabled={busy} onClick={() => setConfirmCancel(false)}>
            {t.pay.cancelKeep}
          </button>
          <button type="button" className="btn-base btn-outline-navy" disabled={busy} onClick={() => void confirmCancelPayment()}>
            {t.pay.cancelConfirm}
          </button>
        </div>
      </dialog>
    </>
  );
}
