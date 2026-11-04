import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, MessageCircle, Receipt, Smartphone, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { PaymentPolicy } from "@/components/site/PaymentPolicy";
import { formatPrice, waLink } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { getPaymentStatus, resendPaymentPrompt, startOrderPayment } from "@/lib/checkout.functions";
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
  const start = useServerFn(startOrderPayment);
  const [data, setData] = useState<Status | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setData(null);
    setMissing(false);
    const tick = async () => {
      try {
        const next = await load({ data: { paymentId } });
        if (!alive) return;
        setData(next);
        if (next.status === "pending") timer = setTimeout(tick, 4000);
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

  async function payAgain(kind: "advance" | "full") {
    const number = phone.trim() || data?.order.phone || "";
    if (!/^[+\d\s()-]{7,20}$/.test(number)) {
      setShowPhone(true);
      toast.error(t.validation.phoneInvalid);
      return;
    }
    setBusy(true);
    try {
      const r = await start({ data: { paymentId, kind, phone: number } });
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
                {fill(t.pay.body, { phone: data.phone, amount: formatPrice(data.amount) ?? "" })}
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.pay.waiting}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
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
              <p className="mt-6 text-sm text-muted-foreground">{t.pay.productionNote}</p>
            </div>
          )}

          {(data.status === "failed" || data.status === "expired") && (
            <div>
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="mt-4 text-lg text-navy">{t.pay.failedBody}</p>
            </div>
          )}

          {data.status !== "pending" && o.balance > 0 && o.status !== "cancelled" && (
            <div className="mt-8 border-t border-border/70 pt-6">
              {(showPhone || data.status !== "completed") && (
                <div className="mb-4 max-w-xs">
                  <label className="field-label" htmlFor="pay-phone">{t.checkout.phone}</label>
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
    </>
  );
}
