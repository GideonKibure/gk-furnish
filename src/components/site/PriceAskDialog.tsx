import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { cycleTab, tabbable } from "@/lib/dialog-focus";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth";
import { sessionContact } from "@/hooks/use-customer-name";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { getMyProfile } from "@/lib/account.functions";
import { submitCustomOrder } from "@/lib/orders.functions";
import { Honeypot } from "@/components/site/Honeypot";
import { PhoneField } from "@/components/site/PhoneField";
import { WhatsAppOrderLink } from "@/components/site/WhatsAppOrderLink";
import { siteSettingsQuery } from "@/lib/site-content";
import { normaliseTzMobile } from "@/lib/phone-tz";
import { whatsAppOrderText } from "@/lib/whatsapp";

type Contact = { full_name: string; phone: string; email: string; delivery_location: string };

const EMPTY: Contact = { full_name: "", phone: "", email: "", delivery_location: "" };

/** Contact form for a product with no price. The request is saved with the other custom orders. */
export function PriceAskDialog({
  productName,
  productImage,
  productUrl,
  open,
  onOpenChange,
}: {
  productName: string;
  productImage: string;
  productUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLang();
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const filled = useRef(EMPTY);
  const { user } = useAuthUser();
  const loadProfile = useServerFn(getMyProfile);
  const send = useServerFn(submitCustomOrder);
  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: () => loadProfile(),
    enabled: open && Boolean(user),
    staleTime: 5 * 60_000,
  });
  const [contact, setContact] = useState<Contact>(EMPTY);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentNumber, setSentNumber] = useState<string | null>(null);
  const started = useRef(Date.now());
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const { data: settings } = useQuery({ ...siteSettingsQuery, enabled: open });

  useEffect(() => {
    if (!open) {
      setSentNumber(null);
      return;
    }
    const session = sessionContact(user);
    const next = {
      full_name: profile?.full_name?.trim() || session.name,
      phone: profile?.phone?.trim() || session.phone,
      email: profile?.email?.trim() || session.email,
      delivery_location: profile?.default_location?.trim() || "",
    };
    setContact((current) => ({
      full_name: current.full_name && current.full_name !== filled.current.full_name ? current.full_name : next.full_name,
      phone: current.phone && current.phone !== filled.current.phone ? current.phone : next.phone,
      email: current.email && current.email !== filled.current.email ? current.email : next.email,
      delivery_location:
        current.delivery_location && current.delivery_location !== filled.current.delivery_location
          ? current.delivery_location
          : next.delivery_location,
    }));
    filled.current = next;
  }, [open, user, profile]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => firstField.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (busyRef.current) return;
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const next = cycleTab(
        tabbable(dialogRef.current),
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
        event.shiftKey,
      );
      if (!next) return;
      event.preventDefault();
      next.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!contact.full_name.trim()) next["full_name"] = t.validation.nameRequired;
    if (!contact.phone.trim()) next["phone"] = t.validation.phoneRequired;
    else if (!normaliseTzMobile(contact.phone)) next["phone"] = t.validation.phoneInvalid;
    if (contact.email.trim() && !/^\S+@\S+\.\S+$/.test(contact.email.trim())) next["email"] = t.validation.emailInvalid;
    if (!contact.delivery_location.trim()) next["delivery_location"] = t.validation.locationRequired;
    const qty = Number(quantity);
    if (quantity.trim() && (!Number.isInteger(qty) || qty < 1)) next["quantity"] = t.validation.quantityInvalid;
    setErrs(next);
    if (Object.keys(next).length) return;
    const phone = normaliseTzMobile(contact.phone);
    if (!phone) return;
    setBusy(true);
    try {
      const sent = await send({
        data: {
          full_name: contact.full_name.trim(),
          phone,
          email: contact.email.trim(),
          furniture_type: productName.slice(0, 100),
          design_description: fill(t.cart.askPriceBody, { name: productName }),
          preferred_dimensions: notes.trim(),
          preferred_material: "",
          preferred_color: "",
          needed_by: "",
          quantity: quantity.trim() ? qty : 1,
          budget: "",
          finish: "",
          delivery_location: contact.delivery_location.trim(),
          additional_requirements: notes.trim(),
          product_image_url: productImage,
          company_website: (event.currentTarget.elements.namedItem("company_website") as HTMLInputElement | null)?.value ?? "",
          started_at: started.current,
        },
      });
      toast.success(`${t.cart.askPriceSent} ${sent.requestNumber}`);
      setSentNumber(sent.requestNumber);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(message.includes("few minutes") ? t.validation.slowDown : t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const fieldErr = (name: string) =>
    errs[name] ? (
      <p id={`ask-${name}-error`} className="field-error">
        {errs[name]}
      </p>
    ) : null;
  const invalid = (name: string) =>
    errs[name] ? { "aria-invalid": true as const, "aria-describedby": `ask-${name}-error` } : {};

  return (
    <div className="fixed inset-0 z-[80] flex overflow-y-auto bg-navy/45 p-4 backdrop-blur-md" onMouseDown={() => { if (!busy) onOpenChange(false); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="m-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="h-1.5 bg-gold" />
        <form onSubmit={onSubmit} noValidate className="relative p-5 sm:p-6">
          <Honeypot />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="font-display text-xl font-bold text-navy">{t.cart.askPriceTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{fill(t.cart.askPriceIntro, { name: productName })}</p>
            </div>
            <button type="button" className="icon-btn shrink-0" aria-label={t.nav.close} disabled={busy} onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          {sentNumber ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-navy">{fill(t.whatsapp.askSent, { number: sentNumber })}</p>
              {Number.isFinite(Number(settings?.order_completion_hours)) && Number(settings?.order_completion_hours) >= 1 ? (
                <p className="text-sm text-navy">{fill(t.cart.askReply, { hours: String(Number(settings?.order_completion_hours)) })}</p>
              ) : null}
              <WhatsAppOrderLink
                source="ask_price_success"
                text={whatsAppOrderText([t.whatsapp.askIntro, productName, sentNumber, productUrl])}
                className="btn-base btn-outline-navy min-h-11 w-full"
              >
                {t.whatsapp.orderButton}
              </WhatsAppOrderLink>
              <button type="button" className="btn-base btn-gold min-h-11 w-full" onClick={() => onOpenChange(false)}>
                {t.cart.askKeep}
              </button>
            </div>
          ) : (
          <>
          {productImage ? <img src={productImage} alt="" width={72} height={72} className="mt-3 h-16 w-16 rounded-lg object-cover" /> : null}
          <div className="mt-4 space-y-3">
            <div>
              <label className="field-label" htmlFor="ask-name">{t.custom.fullName} *</label>
              <input
                ref={firstField}
                id="ask-name"
                className="field-input"
                autoComplete="name"
                enterKeyHint="next"
                value={contact.full_name}
                {...invalid("full_name")}
                onChange={(event) => setContact((current) => ({ ...current, full_name: event.target.value }))}
              />
              {fieldErr("full_name")}
            </div>
            <PhoneField
              id="ask-phone"
              label={t.custom.phone}
              required
              value={contact.phone}
              {...(errs["phone"] ? { error: errs["phone"] } : {})}
              onChange={(value) => setContact((current) => ({ ...current, phone: value }))}
              onBlur={() => {
                if (contact.phone.trim() && !normaliseTzMobile(contact.phone)) setErrs((current) => ({ ...current, phone: t.validation.phoneInvalid }));
              }}
            />
            <div>
              <label className="field-label" htmlFor="ask-email">{t.custom.email}</label>
              <input
                id="ask-email"
                type="email"
                inputMode="email"
                className="field-input"
                autoComplete="email"
                enterKeyHint="next"
                value={contact.email}
                {...invalid("email")}
                onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
              />
              {fieldErr("email")}
            </div>
            <div>
              <label className="field-label" htmlFor="ask-location">{t.custom.location} *</label>
              <input
                id="ask-location"
                className="field-input"
                autoComplete="street-address"
                enterKeyHint="next"
                placeholder="Mbeya…"
                value={contact.delivery_location}
                {...invalid("delivery_location")}
                onChange={(event) => setContact((current) => ({ ...current, delivery_location: event.target.value }))}
              />
              {fieldErr("delivery_location")}
            </div>
            <div>
              <label className="field-label" htmlFor="ask-qty">{t.cart.askQuantity}</label>
              <input id="ask-qty" inputMode="numeric" enterKeyHint="next" className="field-input" value={quantity} {...invalid("quantity")} onChange={(event) => setQuantity(event.target.value)} />
              {fieldErr("quantity")}
            </div>
            <div>
              <label className="field-label" htmlFor="ask-notes">{t.cart.askNotes}</label>
              <textarea id="ask-notes" rows={3} enterKeyHint="done" className="field-input" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn-base btn-gold btn-lg mt-5 w-full" disabled={busy}>
            {busy ? t.cart.askPriceSending : t.cart.askPriceSend}
          </button>
          </>
          )}
        </form>
      </div>
    </div>
  );
}
