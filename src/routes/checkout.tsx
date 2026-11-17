import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Store, Truck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DeliveryFields, type DeliveryValues } from "@/components/site/DeliveryFields";
import { PayInstructions } from "@/components/site/PayInstructions";
import { PaymentPolicy } from "@/components/site/PaymentPolicy";
import { Honeypot } from "@/components/site/Honeypot";
import { MoneyTimeline } from "@/components/site/MoneyTimeline";
import { WalletPicker } from "@/components/site/WalletPicker";
import { formatAmount, formatPrice } from "@/config/site";
import { useAuthUser } from "@/hooks/use-auth";
import { useAuthPopup } from "@/hooks/use-auth-popup";
import { sessionContact } from "@/hooks/use-customer-name";
import { fill } from "@/i18n/fill";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { getMyProfile } from "@/lib/account.functions";
import { listMyAddresses, type SavedAddress } from "@/lib/addresses.functions";
import { trackEvent } from "@/lib/analytics";
import { clearBuyNow, readBuyNow, type BuyNowLine } from "@/lib/buy-now";
import { useCart } from "@/lib/cart";
import { productsQuery } from "@/lib/catalog";
import { createCheckout, getCheckoutConfig } from "@/lib/checkout.functions";
import { quoteCheckout } from "@/lib/checkout-quote";
import { composeDeliveryLocation, deliveryFeeStatusFor, placeFromProfileLocation, type FulfilmentMethod } from "@/lib/delivery";
import { DEFAULT_PAY_ACCOUNTS, DEFAULT_PAY_METHODS } from "@/lib/pay-accounts";
import { phoneMatchesWallet, walletById, type WalletId } from "@/lib/palmpesa";
import { advanceSettingsFrom } from "@/lib/payment-policy";
import { selectedOptionPrice } from "@/lib/order-options";
import { asksForPrice, isPurchasable } from "@/lib/product-display";
import { normaliseTzMobile } from "@/lib/phone-tz";
import { siteSettingsQuery, completionHours } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): { buy?: boolean } => {
    const buy = search["buy"] === "1" || search["buy"] === 1 || search["buy"] === true;
    return buy ? { buy: true } : {};
  },
  head: () => ({ meta: [{ title: "Checkout — GK furnish" }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPage,
});

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const phoneOk = (v: string) => normaliseTzMobile(v) != null;

function CheckoutPage() {
  const { t, lang } = useLang();
  const { buy } = Route.useSearch();
  const nav = useNavigate();
  const cart = useCart();
  const { data: catalog = [] } = useQuery(productsQuery);
  const [buyLine, setBuyLine] = useState<BuyNowLine | null>(null);
  const { user, ready: authReady } = useAuthUser();
  const { open: openAuth } = useAuthPopup();
  const send = useServerFn(createCheckout);
  const loadProfile = useServerFn(getMyProfile);
  const loadAddresses = useServerFn(listMyAddresses);
  const loadConfig = useServerFn(getCheckoutConfig);
  const { data: settings } = useQuery(siteSettingsQuery);
  const { data: config } = useQuery({ queryKey: ["checkout-config"], queryFn: () => loadConfig(), staleTime: 5 * 60_000 });
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => loadProfile(),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
  const { data: saved } = useQuery({
    queryKey: ["my-addresses", user?.id],
    queryFn: () => loadAddresses(),
    enabled: Boolean(user),
    retry: false,
  });
  const addresses: SavedAddress[] = saved?.addresses ?? [];
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<"advance" | "full">("advance");
  const [payMethod, setPayMethod] = useState<"mobile" | "bank">("mobile");
  const [wallet, setWallet] = useState<WalletId | null>(null);
  const methods = config?.methods ?? DEFAULT_PAY_METHODS;
  const payChannels = useMemo(
    () => (["mobile", "bank"] as const).filter((kind) => (kind === "bank" ? methods.nmb : methods.mpesa || methods.airtel)),
    [methods.airtel, methods.mpesa, methods.nmb],
  );
  const [agreed, setAgreed] = useState(false);
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<FulfilmentMethod>("collection");
  const [manualPay, setManualPay] = useState(false);
  const [remember, setRemember] = useState(true);
  const [requestId] = useState(() => crypto.randomUUID());
  const started = useRef(Date.now());
  const phoneTracked = useRef(false);
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

  const filled = useRef({ name: "", phone: "", email: "", location: "" });

  useEffect(() => {
    if (buy) setBuyLine(readBuyNow());
  }, [buy]);

  useEffect(() => {
    try {
      if (localStorage.getItem("gk-checkout-remember") === "0") {
        setRemember(false);
        return;
      }
      const name = localStorage.getItem("gk-checkout-name") ?? "";
      const phone = localStorage.getItem("gk-checkout-phone") ?? "";
      if (!name && !phone) return;
      setForm((current) => ({
        ...current,
        customer_name: current.customer_name || name,
        phone: current.phone || phone,
        payment_phone: current.payment_phone || phone,
      }));
    } catch {
      // Storage can be blocked. Checkout still works.
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const session = sessionContact(user);
    const name = profile?.full_name?.trim() || session.name;
    const phone = profile?.phone?.trim() || session.phone;
    const email = profile?.email?.trim() || session.email;
    const location = profile?.default_location?.trim() || "";
    setForm((current) => ({
      ...current,
      customer_name: current.customer_name && current.customer_name !== filled.current.name ? current.customer_name : name,
      phone: current.phone && current.phone !== filled.current.phone ? current.phone : phone,
      payment_phone: current.payment_phone && current.payment_phone !== filled.current.phone ? current.payment_phone : phone,
      email: current.email && current.email !== filled.current.email ? current.email : email,
    }));
    if (!addressId && location && location !== filled.current.location) {
      setPlace((current) => (current.region || current.district || current.address_line ? current : placeFromProfileLocation(location)));
    }
    filled.current = { name, phone, email, location };
  }, [user, profile, addressId]);

  useEffect(() => {
    if (addressId || !addresses.length) return;
    const pick = addresses.find((a) => a.is_default) ?? addresses[0];
    if (pick) chooseAddress(pick);
  }, [addresses.length]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  useEffect(() => {
    const first = payChannels[0];
    if (first && !payChannels.includes(payMethod)) setPayMethod(first);
  }, [payChannels, payMethod]);

  function chooseAddress(a: SavedAddress) {
    setAddressId(a.id);
    setPlace({ region: a.region, district: a.district, address_line: [a.area, a.address_line].filter(Boolean).join(", ") });
    setForm((f) => ({
      ...f,
      customer_name: f.customer_name || a.full_name,
      phone: f.phone || a.phone,
    }));
  }

  const buyProduct = buyLine ? catalog.find((item) => item.id === buyLine.product_id) : undefined;
  const buyUnit = buyProduct && buyLine ? selectedOptionPrice(buyProduct, buyLine.material, buyLine.size) : null;
  const lines = buy && buyLine && buyProduct && buyUnit != null
    ? [{
        key: "buy-now",
        product_id: buyLine.product_id,
        quantity: buyLine.quantity,
        material: buyLine.material,
        size: buyLine.size,
        color: buyLine.color,
        product: buyProduct,
        unitPrice: buyUnit,
        lineTotal: buyUnit * buyLine.quantity,
      }]
    : cart.entries.map((entry) => ({
        key: entry.key,
        product_id: entry.product_id,
        quantity: entry.quantity,
        material: entry.material,
        size: entry.size,
        color: entry.color,
        product: entry.product,
        unitPrice: entry.unitPrice,
        lineTotal: entry.lineTotal,
      }));
  const subtotal = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const products = lines.flatMap((e) => (e.product ? [e.product] : []));
  const feeStatus = deliveryFeeStatusFor(method, products, method === "delivery" ? place.region : undefined);
  const quote = quoteCheckout(subtotal, itemCount, advanceSettingsFrom(settings));
  const advance = quote.advance;
  const payNow = choice === "full" ? quote.full : quote.advance;
  const tierLabel = quote.tier === "large" ? t.checkout.tierLarge : quote.tier === "custom" ? t.checkout.tierCustom : t.checkout.tierStandard;
  const blocked = lines.some((e) => !e.product || asksForPrice(e.product) || e.unitPrice == null || !isPurchasable(e.product));
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const snippePayNow = Boolean(config?.snippePayNow) && !manualPay;
  const promptPay = snippePayNow && payMethod === "mobile";
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
    setErrors(errs);
    return !Object.keys(errs).length;
  }

  async function placeOrder() {
    if (!validateDelivery()) {
      setStep(0);
      return;
    }
    if (!agreed) {
      setErrors({ specs: t.checkout.specsRequired });
      return;
    }
    if (!policiesAccepted) {
      setErrors({ policies: t.validation.policiesRequired });
      return;
    }
    const customerPhone = normaliseTzMobile(form.phone);
    const payPhone = (form.payment_phone || customerPhone || "").trim();
    if (promptPay && !wallet) {
      setErrors({ wallet: t.checkout.walletRequired });
      return;
    }
    if (promptPay && wallet && !phoneMatchesWallet(payPhone, wallet)) {
      setStep(1);
      setErrors({ payment_phone: t.checkout.walletMismatch });
      return;
    }
    setBusy(true);
    try {
      if (remember) {
        try {
          localStorage.setItem("gk-checkout-remember", "1");
          localStorage.setItem("gk-checkout-name", form.customer_name.trim());
          localStorage.setItem("gk-checkout-phone", form.phone.trim());
        } catch {
          // Ignore storage failures.
        }
      } else {
        try {
          localStorage.setItem("gk-checkout-remember", "0");
          localStorage.removeItem("gk-checkout-name");
          localStorage.removeItem("gk-checkout-phone");
        } catch {
          // Ignore storage failures.
        }
      }
      if (promptPay) trackEvent("payment_started", { method: "snippe" });
      const r = await send({
        data: {
          client_request_id: requestId,
          items: lines.map((entry) => ({
            product_id: entry.product_id,
            quantity: entry.quantity,
            material: entry.material,
            size: entry.size,
            color: entry.color,
          })),
          customer_name: form.customer_name.trim(),
          phone: customerPhone ?? form.phone.trim(),
          email: form.email.trim(),
          fulfilment_method: method,
          region: method === "delivery" ? place.region : "",
          district: method === "delivery" ? place.district.trim() : "",
          address_line: method === "delivery" ? place.address_line.trim() : "",
          save_address: Boolean(user) && method === "delivery" && !addressId && saveAddress,
          needed_by: form.needed_by,
          notes: form.notes.trim(),
          payment_choice: choice,
          payment_method: payMethod,
          ...(promptPay && wallet ? { wallet } : {}),
          payment_phone: payPhone,
          specs_agreed: true,
          policies_accepted: true,
          company_website: (document.getElementById("company_website") as HTMLInputElement | null)?.value ?? "",
          started_at: started.current,
        },
      });
      if (buy) clearBuyNow();
      else await cart.clear();
      if (r.paymentId) {
        void nav({ to: "/pay/$paymentId", params: { paymentId: r.paymentId } });
        return;
      }
      if (r.paymentError) toast.error(r.paymentError);
      if (r.trackingToken) {
        void nav({ to: "/track/$token", params: { token: r.trackingToken } });
        return;
      }
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
          delivery:
            r.deliveryFeeStatus === "pending" || r.deliveryFeeStatus === "confirmed" || r.deliveryFeeStatus === "free"
              ? r.deliveryFeeStatus
              : undefined,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(message.includes("few minutes") ? t.validation.slowDown : message || t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <p id={`err-${k}`} className="field-error">
        {errors[k]}
      </p>
    ) : null;
  const invalid = (k: string) =>
    errors[k] ? { "aria-invalid": true as const, "aria-describedby": `err-${k}` } : { "aria-invalid": false as const };

  if ((buy ? buyLine == null && catalog.length > 0 : cart.ready) && lines.length === 0) {
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
        {lines.map((entry) => (
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
      <div className="container-page py-5 pb-28 md:pt-8 md:pb-28 lg:pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="display-lg">{t.checkout.title}</h1>
        </div>

        <Honeypot />
        <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-6">
          <div className="min-w-0 space-y-4">
              <>
                <section className="panel p-4 md:p-5">
                  <h2 className="text-base font-bold">{t.checkout.contact}</h2>
                  <div className="mt-3 grid gap-4">
                    <div>
                      <label className="field-label" htmlFor="c-phone">{t.order.phone} *</label>
                      <input id="c-phone" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" className="field-input" placeholder="0692 713 993" value={form.phone} onChange={set("phone")} onBlur={() => { if (form.phone.trim() && !phoneOk(form.phone)) setErrors((current) => ({ ...current, phone: t.validation.phoneInvalid })); if (!phoneTracked.current && phoneOk(form.phone)) { phoneTracked.current = true; trackEvent("checkout_phone_entered"); } }} {...invalid("phone")} />
                      {err("phone")}
                    </div>
                    <div>
                      <label className="field-label" htmlFor="c-name">{t.order.name} *</label>
                      <input id="c-name" className="field-input" autoComplete="name" enterKeyHint="next" value={form.customer_name} onChange={set("customer_name")} {...invalid("customer_name")} />
                      {err("customer_name")}
                    </div>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-navy">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--gold-ink)]" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                      {t.checkout.rememberMe}
                    </label>
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-navy">{t.checkout.emailToggle}</summary>
                      <div className="mt-2">
                        <label className="field-label" htmlFor="c-email">{t.order.email}</label>
                        <input id="c-email" type="email" inputMode="email" autoComplete="email" enterKeyHint="done" className="field-input" value={form.email} onChange={set("email")} {...invalid("email")} />
                        {err("email")}
                      </div>
                    </details>
                  </div>
                </section>

                <section className="panel p-4 md:p-5">
                  <h2 className="text-base font-bold">{t.delivery.method}</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.delivery.method}>
                    {(
                      [
                        { id: "collection", icon: Store, title: t.delivery.collectionOption, hint: t.delivery.collectionOptionHint },
                        { id: "delivery", icon: Truck, title: t.delivery.deliveryOption, hint: t.delivery.deliveryOptionHint },
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
                      <label className="field-label" htmlFor="c-needed">{t.order.neededBy}</label>
                      <input id="c-needed" type="date" min={todayIso()} className="field-input" value={form.needed_by} onChange={set("needed_by")} {...invalid("needed_by")} />
                      <p className="mt-1.5 text-xs text-muted-foreground">{fill(t.order.completionNote, { hours: completionHours(settings) })}</p>
                      {err("needed_by")}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="field-label" htmlFor="c-notes">{t.order.notes}</label>
                      <textarea id="c-notes" rows={3} className="field-input" value={form.notes} onChange={set("notes")} />
                    </div>
                  </div>
                </section>
              </>

              <>
                <section className="panel p-4 md:p-5">
                  <div>
                    <p className="text-sm font-semibold text-navy">{t.checkout.methodTitle}</p>
                    {payChannels.length === 0 ? (
                      <p className="mt-2 rounded-lg bg-sand p-3 text-sm text-navy">{t.checkout.methodsOff}</p>
                    ) : (
                    <div className={cn("mt-2 grid gap-3", payChannels.length > 1 && "sm:grid-cols-2")} role="radiogroup" aria-label={t.checkout.methodTitle}>
                      {payChannels.map((kind) => (
                        <label
                          key={kind}
                          className={cn(
                            "cursor-pointer rounded-lg border px-4 py-3 transition-colors",
                            payMethod === kind ? "border-gold bg-gold-tint" : "border-input bg-white hover:border-navy/30",
                          )}
                        >
                          <input type="radio" name="payment_method" className="sr-only" checked={payMethod === kind} onChange={() => setPayMethod(kind)} />
                          <span className="block font-semibold text-navy">{kind === "mobile" ? t.checkout.methodMobile : t.checkout.methodBank}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {kind === "mobile" ? (snippePayNow ? t.checkout.phoneHint : t.checkout.methodMobileHint) : t.checkout.methodBankHint}
                          </span>
                        </label>
                      ))}
                    </div>
                    )}
                    {promptPay && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-semibold text-navy">{t.checkout.walletTitle}</p>
                        <WalletPicker value={wallet} onChange={setWallet} label={t.checkout.walletTitle} />
                        <label className="field-label mt-3" htmlFor="c-pay-phone">{t.checkout.phone}</label>
                        <input
                          id="c-pay-phone"
                          type="tel"
                          className="field-input"
                          autoComplete="tel"
                          value={form.payment_phone}
                          onChange={set("payment_phone")}
                          {...invalid("payment_phone")}
                        />
                        <p className="mt-1.5 text-xs text-muted-foreground">{t.checkout.phoneHint}</p>
                        {err("payment_phone")}
                        {err("wallet")}
                      </div>
                    )}
                    {payChannels.length > 0 && !promptPay && (
                      <PayInstructions accounts={config?.pay ?? DEFAULT_PAY_ACCOUNTS} methods={methods} channel={payMethod} amount={payNow} />
                    )}
                  </div>

                  <h2 className="mt-6 text-base font-bold">{t.steps.paymentPlan}</h2>
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
                          {kind === "advance"
                            ? fill(t.checkout.advanceLabel, { amount: formatAmount(advance) })
                            : fill(t.checkout.fullLabel, { amount: formatAmount(subtotal) })}
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
                <MoneyTimeline />
              </>

            {summary}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-sand p-3 text-sm text-navy">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--gold-ink)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>{t.checkout.specsAgree}</span>
            </label>
            {err("specs")}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-sand p-3 text-sm text-navy">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--gold-ink)]" checked={policiesAccepted} onChange={(e) => setPoliciesAccepted(e.target.checked)} />
              <span>
                {t.checkout.policiesAgree}{" "}
                <Link to="/policies" className="font-semibold underline-offset-2 hover:underline">{t.checkout.policiesLink}</Link>
              </span>
            </label>
            {err("policies")}
            <button
              type="button"
              className="btn-base btn-gold btn-lg w-full"
              onClick={() => void placeOrder()}
              disabled={busy || blocked || (!buy && !cart.ready) || !authReady}
            >
              {busy ? t.checkout.placing : fill(t.checkout.payAmount, { amount: formatAmount(payNow) })}
            </button>
            {!manualPay && (
              <button type="button" className="min-h-11 text-sm font-semibold text-navy underline" onClick={() => setManualPay(true)}>
                {t.checkout.manualInstead}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
