import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, MapPin, Pencil, Store, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Stepper } from "@/components/brand/Stepper";
import { DeliveryFields, type DeliveryValues } from "@/components/site/DeliveryFields";
import { PaymentPolicy } from "@/components/site/PaymentPolicy";
import { WalletPicker } from "@/components/site/WalletPicker";
import { formatAmount, formatPrice } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { fill } from "@/i18n/fill";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { getMyProfile } from "@/lib/account.functions";
import { listMyAddresses, type SavedAddress } from "@/lib/addresses.functions";
import { useCart } from "@/lib/cart";
import { createCheckout, getCheckoutConfig } from "@/lib/checkout.functions";
import { composeDeliveryLocation, deliveryFeeStatusFor, type FulfilmentMethod } from "@/lib/delivery";
import { phoneMatchesWallet, walletById, type WalletId } from "@/lib/palmpesa";
import { advanceAmount, advanceSettingsFrom, advanceTierFor, MIN_MOBILE_PAYMENT_TZS } from "@/lib/payment-policy";
import { isPurchasable } from "@/lib/product-display";
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

const phoneOk = (v: string) => /^[+\d\s()-]{7,20}$/.test(v.trim());

function CheckoutPage() {
  const { t, lang } = useLang();
  const nav = useNavigate();
  const cart = useCart();
  const { user, ready: authReady } = useAuthUser();
  const send = useServerFn(createCheckout);
  const loadProfile = useServerFn(getMyProfile);
  const loadAddresses = useServerFn(listMyAddresses);
  const loadConfig = useServerFn(getCheckoutConfig);
  const { data: settings } = useQuery(siteSettingsQuery);
  const { data: config } = useQuery({ queryKey: ["checkout-config"], queryFn: () => loadConfig(), staleTime: 5 * 60_000 });
  const { data: saved } = useQuery({
    queryKey: ["my-addresses", user?.id],
    queryFn: () => loadAddresses(),
    enabled: Boolean(user),
    retry: false,
  });
  const addresses: SavedAddress[] = saved?.addresses ?? [];
  const online = Boolean(config?.onlinePayment);

  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<"advance" | "full">("advance");
  const [payMethod, setPayMethod] = useState<"mobile" | "cash">("mobile");
  const [wallet, setWallet] = useState<WalletId>("mpesa");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<FulfilmentMethod>("delivery");
  const [addressId, setAddressId] = useState<string>("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [place, setPlace] = useState<DeliveryValues>({ region: "", district: "", address_line: "" });
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    email: "",
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
        })),
      )
      .catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    if (addressId || !addresses.length) return;
    const pick = addresses.find((a) => a.is_default) ?? addresses[0];
    if (pick) chooseAddress(pick);
  }, [addresses.length]);

  useEffect(() => {
    if (sessionStorage.getItem("gk-checkout-start") !== "payment") return;
    sessionStorage.removeItem("gk-checkout-start");
    setStep(1);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  function chooseAddress(a: SavedAddress) {
    setAddressId(a.id);
    setPlace({ region: a.region, district: a.district, address_line: [a.area, a.address_line].filter(Boolean).join(", ") });
    setForm((f) => ({
      ...f,
      customer_name: f.customer_name || a.full_name,
      phone: f.phone || a.phone,
    }));
  }

  const subtotal = cart.subtotal;
  const itemCount = cart.count;
  const products = cart.entries.flatMap((e) => (e.product ? [e.product] : []));
  const feeStatus = deliveryFeeStatusFor(method, products);
  const tier = advanceTierFor({ total: subtotal, itemCount }, advanceSettingsFrom(settings));
  const advance = Math.min(subtotal, Math.max(MIN_MOBILE_PAYMENT_TZS, advanceAmount(subtotal, tier.percent)));
  const payNow = choice === "full" ? subtotal : advance;
  const tierLabel = tier.tier === "large" ? t.checkout.tierLarge : tier.tier === "custom" ? t.checkout.tierCustom : t.checkout.tierStandard;
  const blocked = cart.entries.some((e) => !e.product || e.unitPrice == null || !isPurchasable(e.product));
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const collectionAddress = config?.collectionAddress ?? "Mbeya, Tanzania";
  const placeLabel = useMemo(
    () =>
      method === "collection"
        ? collectionAddress
        : composeDeliveryLocation({ method, region: place.region, district: place.district, area: place.address_line }),
    [method, place, collectionAddress],
  );

  function validateDelivery() {
    const errs: Record<string, string> = {};
    if (!form.customer_name.trim()) errs["customer_name"] = t.validation.nameRequired;
    if (!form.phone.trim()) errs["phone"] = t.validation.phoneRequired;
    else if (!phoneOk(form.phone)) errs["phone"] = t.validation.phoneInvalid;
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs["email"] = t.validation.emailInvalid;
    if (method === "delivery") {
      if (!place.region) errs["region"] = t.delivery.regionRequired;
      if (!place.address_line.trim()) errs["address_line"] = t.delivery.areaRequired;
    }
    if (!form.needed_by) errs["needed_by"] = t.validation.dateRequired;
    setErrors(errs);
    return !Object.keys(errs).length;
  }

  function validatePayment() {
    const errs: Record<string, string> = {};
    if (online && payMethod === "mobile") {
      const payPhone = form.payment_phone.trim() || form.phone.trim();
      if (!phoneOk(payPhone)) errs["payment_phone"] = t.validation.phoneInvalid;
      else if (!phoneMatchesWallet(payPhone, wallet)) errs["payment_phone"] = t.checkout.walletMismatch;
    }
    setErrors(errs);
    return !Object.keys(errs).length;
  }

  function next() {
    if (step === 0 && !validateDelivery()) return;
    if (step === 1 && !validatePayment()) return;
    if (step === 1 && !validateDelivery()) {
      setStep(0);
      return;
    }
    setStep((s) => Math.min(2, s + 1));
  }

  async function placeOrder() {
    if (!user) {
      void nav({ to: "/account/login", search: { next: "/checkout" } });
      return;
    }
    if (!validateDelivery()) {
      setStep(0);
      return;
    }
    if (!agreed) {
      setErrors({ specs: t.checkout.specsRequired });
      return;
    }
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
          fulfilment_method: method,
          region: method === "delivery" ? place.region : "",
          district: method === "delivery" ? place.district.trim() : "",
          address_line: method === "delivery" ? place.address_line.trim() : "",
          save_address: Boolean(user) && method === "delivery" && !addressId && saveAddress,
          needed_by: form.needed_by,
          notes: form.notes.trim(),
          payment_choice: choice,
          payment_method: online && payMethod === "mobile" ? "mobile" : "cash",
          ...(online && payMethod === "mobile" ? { wallet } : {}),
          payment_phone: online && payMethod === "mobile" ? form.payment_phone.trim() || form.phone.trim() : "",
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
          location: r.deliveryLocation,
          track: r.trackingToken ?? undefined,
          delivery: r.deliveryFeeStatus,
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k] && <p className="field-error">{errors[k]}</p>;

  if (cart.ready && cart.entries.length === 0) {
    return (
      <div className="container-page section-y text-center">
        <h1 className="display-lg">{t.checkout.title}</h1>
        <p className="mt-3 text-muted-foreground">{t.checkout.emptyCart}</p>
        <Link to="/products" className="btn-base btn-gold mt-6">
          {t.cart.emptyCta}
        </Link>
      </div>
    );
  }

  const deliveryValue =
    feeStatus === "free" ? (
      <span className="font-semibold text-success">{t.delivery.free}</span>
    ) : (
      <span className="font-semibold text-navy">{t.delivery.toBeConfirmed}</span>
    );

  const summary = (
    <div className="kpi-card">
      <h2 className="text-base font-bold">{t.checkout.summary}</h2>
      <ul className="mt-3 space-y-2.5 text-sm">
        {cart.entries.map((entry) => (
          <li key={entry.key} className="flex justify-between gap-3">
            <span className="min-w-0 text-navy">
              <span className="font-medium">{entry.quantity}×</span>{" "}
              {entry.product ? localized(lang, entry.product.name, entry.product.name_sw) : "—"}
              <span className="block truncate text-xs text-muted-foreground">
                {[entry.material, entry.size, entry.color].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatPrice(entry.lineTotal) ?? "—"}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t.cart.subtotal}</dt>
          <dd className="tabular-nums text-navy">{formatAmount(subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t.delivery.label}</dt>
          <dd className="text-right">{deliveryValue}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-base">
          <dt className="font-bold text-navy">{t.checkout.total}</dt>
          <dd className="price-text">{formatAmount(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t.checkout.payNow}</dt>
          <dd className="font-semibold tabular-nums text-navy">{formatAmount(payNow)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t.checkout.balanceLater}</dt>
          <dd className="tabular-nums">{formatAmount(Math.max(0, subtotal - payNow))}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {feeStatus === "free" ? (method === "collection" ? t.delivery.collectionNote : t.delivery.freeNote) : t.delivery.pendingNote}
      </p>
      {blocked && <p className="mt-2 text-xs text-danger">{t.cart.unavailable}</p>}
    </div>
  );

  return (
    <div className="bg-sand">
      <div className="container-page py-5 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="display-lg">{t.checkout.title}</h1>
          {authReady && !user && (
            <p className="max-w-xl text-sm text-navy">
              {t.checkout.signInPrompt}{" "}
              <Link to="/account/login" search={{ next: "/checkout" }} className="font-semibold text-gold-ink underline">
                {t.nav.signIn}
              </Link>
            </p>
          )}
        </div>
        <Stepper
          className="mt-4 max-w-xl"
          steps={[t.steps.delivery, t.steps.payment, t.steps.review]}
          current={step}
          onStepClick={setStep}
        />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            {step === 0 && (
              <>
                <section className="panel p-4 md:p-5">
                  <h2 className="text-base font-bold">{t.checkout.contact}</h2>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="field-label" htmlFor="c-name">{t.order.name} *</label>
                      <input id="c-name" className="field-input" autoComplete="name" value={form.customer_name} onChange={set("customer_name")} aria-invalid={Boolean(errors["customer_name"])} />
                      {err("customer_name")}
                    </div>
                    <div>
                      <label className="field-label" htmlFor="c-phone">{t.order.phone} *</label>
                      <input id="c-phone" type="tel" inputMode="tel" autoComplete="tel" className="field-input" placeholder="+255…" value={form.phone} onChange={set("phone")} aria-invalid={Boolean(errors["phone"])} />
                      {err("phone")}
                    </div>
                    <div>
                      <label className="field-label" htmlFor="c-email">{t.order.email}</label>
                      <input id="c-email" type="email" autoComplete="email" className="field-input" value={form.email} onChange={set("email")} aria-invalid={Boolean(errors["email"])} />
                      {err("email")}
                    </div>
                  </div>
                </section>

                <section className="panel p-4 md:p-5">
                  <h2 className="text-base font-bold">{t.delivery.method}</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.delivery.method}>
                    {(
                      [
                        { id: "delivery", icon: Truck, title: t.delivery.deliveryOption, hint: t.delivery.deliveryOptionHint },
                        { id: "collection", icon: Store, title: t.delivery.collectionOption, hint: t.delivery.collectionOptionHint },
                      ] as const
                    ).map((o) => (
                      <label
                        key={o.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                          method === o.id ? "border-gold bg-gold-tint" : "border-input bg-white hover:border-navy/30",
                        )}
                      >
                        <input type="radio" name="method" className="sr-only" checked={method === o.id} onChange={() => setMethod(o.id)} />
                        <o.icon className="mt-0.5 h-5 w-5 shrink-0 text-navy" strokeWidth={1.8} />
                        <span>
                          <span className="block font-semibold text-navy">{o.title}</span>
                          <span className="block text-sm text-muted-foreground">{o.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  {method === "delivery" ? (
                    <div className="mt-4 space-y-4">
                      {addresses.length > 0 && (
                        <div>
                          <p className="field-label">{t.steps.savedAddresses}</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {addresses.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => chooseAddress(a)}
                                aria-pressed={addressId === a.id}
                                className={cn(
                                  "rounded-lg border p-3 text-left text-sm transition-colors",
                                  addressId === a.id ? "border-gold bg-gold-tint" : "border-input bg-white hover:border-navy/30",
                                )}
                              >
                                <span className="flex items-center gap-1.5 font-semibold text-navy">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {a.label || a.region}
                                  {a.is_default && <span className="status-pill tone-gold !py-0 !text-[0.65rem]">{t.addresses.default}</span>}
                                </span>
                                <span className="mt-0.5 block text-muted-foreground">
                                  {[a.area, a.address_line, a.district, a.region].filter(Boolean).join(", ")}
                                </span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setAddressId("");
                                setPlace({ region: "", district: "", address_line: "" });
                              }}
                              aria-pressed={!addressId}
                              className={cn(
                                "rounded-lg border border-dashed p-3 text-left text-sm font-semibold transition-colors",
                                !addressId ? "border-gold bg-gold-tint text-navy" : "border-input text-navy hover:border-navy/30",
                              )}
                            >
                              + {t.steps.newAddress}
                            </button>
                          </div>
                        </div>
                      )}
                      <DeliveryFields
                        value={place}
                        onChange={(v) => {
                          setPlace(v);
                          setAddressId("");
                        }}
                        errors={{ region: errors["region"], address_line: errors["address_line"] }}
                        idPrefix="c"
                      />
                      {user && saved?.available && !addressId && (
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-navy">
                          <input type="checkbox" className="h-4 w-4 accent-[var(--gold-ink)]" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                          {t.steps.saveAddress}
                        </label>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 flex items-start gap-2 rounded-lg bg-sand p-3 text-sm text-navy">
                      <Store className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="font-semibold">{t.delivery.collectFrom}:</span> {collectionAddress}
                      </span>
                    </p>
                  )}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label" htmlFor="c-needed">{t.order.neededBy} *</label>
                      <input id="c-needed" type="date" min={todayIso()} className="field-input" value={form.needed_by} onChange={set("needed_by")} aria-invalid={Boolean(errors["needed_by"])} />
                      {err("needed_by")}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="field-label" htmlFor="c-notes">{t.order.notes}</label>
                      <textarea id="c-notes" rows={3} className="field-input" value={form.notes} onChange={set("notes")} />
                    </div>
                  </div>
                </section>
              </>
            )}

            {step === 1 && (
              <>
                <section className="panel p-4 md:p-5">
                  {online ? (
                    <div>
                      <p className="text-sm font-semibold text-navy">{t.checkout.methodTitle}</p>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.checkout.methodTitle}>
                        {(["mobile", "cash"] as const).map((kind) => (
                          <label
                            key={kind}
                            className={cn(
                              "cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                              payMethod === kind ? "border-gold bg-gold-tint" : "border-input bg-white hover:border-navy/30",
                            )}
                          >
                            <input type="radio" name="payment_method" className="sr-only" checked={payMethod === kind} onChange={() => setPayMethod(kind)} />
                            <span className="block font-semibold text-navy">{kind === "mobile" ? t.checkout.methodMobile : t.checkout.methodCash}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {kind === "mobile" ? t.checkout.methodMobileHint : t.checkout.methodCashHint}
                            </span>
                          </label>
                        ))}
                      </div>
                      {payMethod === "mobile" ? (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-navy">{t.checkout.walletTitle}</p>
                          <div className="mt-2">
                            <WalletPicker value={wallet} onChange={setWallet} label={t.checkout.walletTitle} />
                          </div>
                          <label className="field-label mt-4" htmlFor="c-pay-phone">{t.checkout.phone} *</label>
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
                      ) : (
                        <p className="mt-3 rounded-lg bg-sand p-3 text-sm text-navy">{t.checkout.methodCashHint}</p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-sand p-4">
                      <p className="text-sm font-semibold text-navy">{t.steps.howToPay}</p>
                      <ol className="mt-2 space-y-1.5 text-sm text-navy/80">
                        {t.steps.offlineSteps.map((line, i) => (
                          <li key={line} className="flex gap-2">
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold text-[0.7rem] font-bold text-navy">{i + 1}</span>
                            {line}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <h2 className={cn("text-base font-bold", online ? "mt-6" : "")}>{t.steps.paymentPlan}</h2>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tierLabel}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.steps.paymentPlan}>
                    {(["advance", "full"] as const).map((kind) => (
                      <label
                        key={kind}
                        className={cn(
                          "cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                          choice === kind ? "border-gold bg-gold-tint" : "border-input bg-white hover:border-navy/30",
                        )}
                      >
                        <input type="radio" name="payment_choice" className="sr-only" checked={choice === kind} onChange={() => setChoice(kind)} />
                        <span className="block font-semibold text-navy">
                          {kind === "advance" ? fill(t.checkout.advanceLabel, { percent: tier.percent }) : t.checkout.fullLabel}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {kind === "advance"
                            ? fill(t.checkout.advanceHint, { amount: formatAmount(advance), balance: formatAmount(Math.max(0, subtotal - advance)) })
                            : fill(t.checkout.fullHint, { amount: formatAmount(subtotal) })}
                        </span>
                      </label>
                    ))}
                  </div>
                  {feeStatus === "pending" && <p className="mt-3 text-xs text-muted-foreground">{t.delivery.pendingNote}</p>}
                </section>
                <PaymentPolicy />
              </>
            )}

            {step === 2 && (
              <section className="panel p-4 md:p-5">
                <h2 className="text-base font-bold">{t.steps.reviewTitle}</h2>
                <dl className="mt-3 divide-y divide-border text-sm">
                  {[
                    {
                      label: t.steps.contactDetails,
                      value: [form.customer_name, form.phone, form.email].filter(Boolean).join(" · "),
                      go: 0,
                    },
                    {
                      label: method === "collection" ? t.steps.collectAt : t.steps.deliverTo,
                      value: placeLabel,
                      go: 0,
                    },
                    { label: t.order.neededBy, value: form.needed_by, go: 0 },
                    {
                      label: t.steps.paymentPlan,
                      value:
                        choice === "advance"
                          ? `${fill(t.checkout.advanceLabel, { percent: tier.percent })} — ${formatAmount(advance)}`
                          : `${t.checkout.fullLabel} — ${formatAmount(subtotal)}`,
                      go: 1,
                    },
                    {
                      label: t.checkout.payment,
                      value: online && payMethod === "mobile" ? `${t.checkout.methodMobile} · ${walletById(wallet)?.label ?? ""}` : t.checkout.cashReview,
                      go: 1,
                    },
                    ...(form.notes ? [{ label: t.order.notes, value: form.notes, go: 0 }] : []),
                  ].map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{row.label}</dt>
                        <dd className="mt-0.5 break-words text-navy">{row.value}</dd>
                      </div>
                      <button type="button" onClick={() => setStep(row.go)} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gold-ink hover:underline">
                        <Pencil className="h-3 w-3" />
                        {t.steps.edit}
                      </button>
                    </div>
                  ))}
                </dl>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-sand p-3 text-sm text-navy">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--gold-ink)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  <span>{t.checkout.specsAgree}</span>
                </label>
                {err("specs")}
                <p className="mt-3 text-xs text-muted-foreground">{t.steps.trackHint}</p>
              </section>
            )}

            <div className="flex flex-wrap-reverse items-center justify-between gap-3 [&>*:last-child]:max-sm:w-full">
              {step > 0 ? (
                <button type="button" className="btn-base btn-outline-navy" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft className="h-4 w-4" />
                  {t.steps.back}
                </button>
              ) : (
                <Link to="/cart" className="btn-base btn-ghost">
                  <ArrowLeft className="h-4 w-4" />
                  {t.cart.title}
                </Link>
              )}
              {step < 2 ? (
                <button type="button" className="btn-base btn-gold btn-lg" onClick={next} disabled={blocked}>
                  {step === 0 ? t.steps.continuePayment : t.steps.continueReview}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : authReady && !user ? (
                <Link to="/account/login" search={{ next: "/checkout" }} className="btn-base btn-gold btn-lg">
                  {t.checkout.signInToOrder}
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn-base btn-gold btn-lg"
                  onClick={() => void placeOrder()}
                  disabled={busy || blocked || !cart.ready || !authReady}
                >
                  {busy ? t.checkout.placing : online && payMethod === "mobile" ? t.checkout.placeOrder : t.checkout.placeOrderOffline}
                </button>
              )}
            </div>
          </div>

          <aside className="h-fit lg:sticky lg:top-24">{summary}</aside>
        </div>
      </div>
    </div>
  );
}
