import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { PaymentPolicy } from "@/components/site/PaymentPolicy";
import { formatPrice } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { fill } from "@/i18n/fill";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { getMyProfile } from "@/lib/account.functions";
import { useCart } from "@/lib/cart";
import { createCheckout } from "@/lib/checkout.functions";
import { advanceAmount, advanceSettingsFrom, advanceTierFor, MIN_MOBILE_PAYMENT_TZS } from "@/lib/payment-policy";
import { siteSettingsQuery } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPage,
});

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CheckoutPage() {
  const { t, lang } = useLang();
  const nav = useNavigate();
  const cart = useCart();
  const { user, ready: authReady } = useAuthUser();
  const send = useServerFn(createCheckout);
  const loadProfile = useServerFn(getMyProfile);
  const { data: settings } = useQuery(siteSettingsQuery);
  const [choice, setChoice] = useState<"advance" | "full">("advance");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    email: "",
    delivery_location: "",
    needed_by: "",
    notes: "",
    payment_phone: "",
  });

  useEffect(() => {
    if (!user) return;
    loadProfile()
      .then((p) =>
        setForm((f) => ({
          ...f,
          customer_name: f.customer_name || p.full_name,
          phone: f.phone || p.phone,
          payment_phone: f.payment_phone || p.phone,
          email: f.email || p.email,
          delivery_location: f.delivery_location || p.default_location,
        })),
      )
      .catch(() => undefined);
  }, [user?.id]);

  const total = cart.subtotal;
  const itemCount = cart.count;
  const tier = advanceTierFor({ total, itemCount }, advanceSettingsFrom(settings));
  const advance = Math.min(total, Math.max(MIN_MOBILE_PAYMENT_TZS, advanceAmount(total, tier.percent)));
  const payNow = choice === "full" ? total : advance;
  const tierLabel = tier.tier === "large" ? t.checkout.tierLarge : tier.tier === "custom" ? t.checkout.tierCustom : t.checkout.tierStandard;
  const blocked = cart.entries.some((e) => !e.product || e.unitPrice == null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const phoneOk = (v: string) => /^[+\d\s()-]{7,20}$/.test(v.trim());
    const errs: Record<string, string> = {};
    if (!form.customer_name.trim()) errs["customer_name"] = t.validation.nameRequired;
    if (!form.phone.trim()) errs["phone"] = t.validation.phoneRequired;
    else if (!phoneOk(form.phone)) errs["phone"] = t.validation.phoneInvalid;
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs["email"] = t.validation.emailInvalid;
    if (!form.delivery_location.trim()) errs["delivery_location"] = t.validation.locationRequired;
    if (!form.needed_by) errs["needed_by"] = t.validation.dateRequired;
    const payPhone = form.payment_phone.trim() || form.phone.trim();
    if (!phoneOk(payPhone)) errs["payment_phone"] = t.validation.phoneInvalid;
    if (!agreed) errs["specs"] = t.checkout.specsRequired;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const r = await send({
        data: {
          items: cart.entries.map((entry) => ({
            product_id: entry.product_id,
            quantity: entry.quantity,
            material: entry.material,
            size: entry.size,
            color: entry.color,
          })),
          customer_name: form.customer_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          delivery_location: form.delivery_location.trim(),
          needed_by: form.needed_by,
          notes: form.notes.trim(),
          payment_choice: choice,
          payment_phone: payPhone,
          specs_agreed: true,
        },
      });
      await cart.clear();
      if (r.paymentId) {
        void nav({ to: "/pay/$paymentId", params: { paymentId: r.paymentId } });
        return;
      }
      if (r.paymentError) toast.error(r.paymentError);
      void nav({
        to: "/order-success",
        search: {
          ref: r.orderNumber,
          item: r.itemSummary,
          qty: r.quantity,
          total: r.total,
          kind: choice,
          pay: "unpaid",
          msg: r.paymentError ?? t.checkout.offline,
          name: form.customer_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          needed: form.needed_by,
          location: form.delivery_location.trim(),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>;

  if (cart.ready && cart.entries.length === 0) {
    return (
      <>
        <PageHeader title={t.checkout.title} />
        <div className="container-page section-y text-center">
          <p className="text-muted-foreground">{t.checkout.emptyCart}</p>
          <Link to="/products" className="btn-base btn-gold mt-6">
            {t.cart.emptyCta}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t.checkout.title} subtitle={t.checkout.subtitle} />
      <div className="container-page section-y">
        {authReady && !user && (
          <p className="mb-6 rounded-xl bg-secondary/60 px-4 py-3 text-sm text-navy">
            {t.checkout.signInPrompt}{" "}
            <Link to="/account/login" search={{ next: "/checkout" }} className="font-semibold text-gold underline">
              {t.nav.signIn}
            </Link>
          </p>
        )}
        <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-6">
            <fieldset className="rounded-2xl border border-border/80 bg-background p-5">
              <legend className="px-1 font-semibold text-navy">{t.checkout.contact}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="c-name">{t.order.name} *</label>
                  <input id="c-name" className="field-input" autoComplete="name" value={form.customer_name} onChange={set("customer_name")} />
                  {err("customer_name")}
                </div>
                <div>
                  <label className="field-label" htmlFor="c-phone">{t.order.phone} *</label>
                  <input id="c-phone" type="tel" inputMode="tel" className="field-input" placeholder="+255…" value={form.phone} onChange={set("phone")} />
                  {err("phone")}
                </div>
                <div>
                  <label className="field-label" htmlFor="c-email">{t.order.email}</label>
                  <input id="c-email" type="email" className="field-input" value={form.email} onChange={set("email")} />
                  {err("email")}
                </div>
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-border/80 bg-background p-5">
              <legend className="px-1 font-semibold text-navy">{t.checkout.delivery}</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="c-loc">{t.order.location} *</label>
                  <input id="c-loc" className="field-input" value={form.delivery_location} onChange={set("delivery_location")} />
                  {err("delivery_location")}
                </div>
                <div>
                  <label className="field-label" htmlFor="c-needed">{t.order.neededBy} *</label>
                  <input id="c-needed" type="date" min={todayIso()} className="field-input" value={form.needed_by} onChange={set("needed_by")} />
                  {err("needed_by")}
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="c-notes">{t.order.notes}</label>
                  <textarea id="c-notes" rows={3} className="field-input" value={form.notes} onChange={set("notes")} />
                </div>
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-border/80 bg-background p-5">
              <legend className="px-1 font-semibold text-navy">{t.checkout.payment}</legend>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tierLabel}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["advance", "full"] as const).map((kind) => (
                  <label
                    key={kind}
                    className={cn(
                      "cursor-pointer rounded-xl border px-4 py-3 transition-colors",
                      choice === kind ? "border-gold bg-gold-soft" : "border-border hover:border-gold/40",
                    )}
                  >
                    <input type="radio" name="payment_choice" className="sr-only" checked={choice === kind} onChange={() => setChoice(kind)} />
                    <span className="block font-semibold text-navy">
                      {kind === "advance" ? fill(t.checkout.advanceLabel, { percent: tier.percent }) : t.checkout.fullLabel}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {kind === "advance"
                        ? fill(t.checkout.advanceHint, {
                            amount: formatPrice(advance) ?? "—",
                            balance: formatPrice(Math.max(0, total - advance)) ?? "TSh 0",
                          })
                        : fill(t.checkout.fullHint, { amount: formatPrice(total) ?? "—" })}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <label className="field-label" htmlFor="c-pay-phone">{t.checkout.phone} *</label>
                <input
                  id="c-pay-phone"
                  type="tel"
                  inputMode="tel"
                  className="field-input"
                  placeholder={form.phone || "07…"}
                  value={form.payment_phone}
                  onChange={set("payment_phone")}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{t.checkout.phoneHint}</p>
                {err("payment_phone")}
              </div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-secondary/50 p-3 text-sm text-navy">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--gold)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>{t.checkout.specsAgree}</span>
              </label>
              {err("specs")}
            </fieldset>
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-28">
            <div className="rounded-2xl border border-border/80 bg-background p-5 shadow-[var(--shadow-card)]">
              <h2 className="font-semibold text-navy">{t.checkout.summary}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {cart.entries.map((entry) => (
                  <li key={entry.key} className="flex justify-between gap-3">
                    <span className="min-w-0 text-navy">
                      {entry.quantity}× {entry.product ? localized(lang, entry.product.name, entry.product.name_sw) : "—"}
                      <span className="block truncate text-xs text-muted-foreground">
                        {[entry.material, entry.size, entry.color].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatPrice(entry.lineTotal) ?? "—"}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-1.5 border-t border-border/70 pt-3 text-sm">
                <div className="flex justify-between font-semibold text-navy">
                  <dt>{t.checkout.total}</dt>
                  <dd className="tabular-nums">{formatPrice(total) ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t.checkout.payNow}</dt>
                  <dd className="font-semibold tabular-nums text-navy">{formatPrice(payNow) ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{t.checkout.balanceLater}</dt>
                  <dd className="tabular-nums">{formatPrice(Math.max(0, total - payNow)) ?? "TSh 0"}</dd>
                </div>
              </dl>
              <button type="submit" className="btn-base btn-gold mt-5 w-full" disabled={busy || blocked || !cart.ready}>
                {busy ? t.checkout.placing : t.checkout.placeOrder}
              </button>
              {blocked && <p className="mt-2 text-xs text-destructive">{t.cart.unavailable}</p>}
            </div>
            <PaymentPolicy compact />
          </aside>
        </form>
      </div>
    </>
  );
}
