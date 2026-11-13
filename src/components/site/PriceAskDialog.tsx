import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth";
import { sessionContact } from "@/hooks/use-customer-name";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { getMyProfile } from "@/lib/account.functions";
import { submitCustomOrder } from "@/lib/orders.functions";

type Contact = { full_name: string; phone: string; email: string; delivery_location: string };

const EMPTY: Contact = { full_name: "", phone: "", email: "", delivery_location: "" };

/** Contact form for a product with no price. The request is saved with the other custom orders. */
export function PriceAskDialog({
  productName,
  open,
  onOpenChange,
}: {
  productName: string;
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
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
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
    const timer = window.setTimeout(() => firstField.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onOpenChange]);

  if (!open) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!contact.full_name.trim()) next["full_name"] = t.validation.nameRequired;
    if (!contact.phone.trim()) next["phone"] = t.validation.phoneRequired;
    else if (!/^[+\d\s()-]{7,20}$/.test(contact.phone.trim())) next["phone"] = t.validation.phoneInvalid;
    if (contact.email.trim() && !/^\S+@\S+\.\S+$/.test(contact.email.trim())) next["email"] = t.validation.emailInvalid;
    if (!contact.delivery_location.trim()) next["delivery_location"] = t.validation.locationRequired;
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const sent = await send({
        data: {
          full_name: contact.full_name.trim(),
          phone: contact.phone.trim(),
          email: contact.email.trim(),
          furniture_type: productName.slice(0, 100),
          design_description: fill(t.cart.askPriceBody, { name: productName }),
          preferred_dimensions: "",
          preferred_material: "",
          preferred_color: "",
          needed_by: "",
          quantity: 1,
          budget: "",
          finish: "",
          delivery_location: contact.delivery_location.trim(),
          additional_requirements: "",
        },
      });
      toast.success(`${t.cart.askPriceSent} ${sent.requestNumber}`);
      onOpenChange(false);
    } catch {
      toast.error(t.validation.failed);
    } finally {
      setBusy(false);
    }
  }

  const fieldErr = (name: string) => (errs[name] ? <p className="field-error">{errs[name]}</p> : null);

  return (
    <div className="fixed inset-0 z-[80] flex overflow-y-auto bg-navy/45 p-4 backdrop-blur-md" onMouseDown={() => { if (!busy) onOpenChange(false); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="m-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="h-1.5 bg-gold" />
        <form onSubmit={onSubmit} noValidate className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="font-display text-xl font-bold text-navy">{t.cart.askPriceTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{fill(t.cart.askPriceIntro, { name: productName })}</p>
            </div>
            <button type="button" className="icon-btn h-9 w-9 shrink-0" aria-label={t.nav.close} disabled={busy} onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="field-label" htmlFor="ask-name">{t.custom.fullName} *</label>
              <input
                ref={firstField}
                id="ask-name"
                className="field-input"
                autoComplete="name"
                value={contact.full_name}
                onChange={(event) => setContact((current) => ({ ...current, full_name: event.target.value }))}
              />
              {fieldErr("full_name")}
            </div>
            <div>
              <label className="field-label" htmlFor="ask-phone">{t.custom.phone} *</label>
              <input
                id="ask-phone"
                type="tel"
                className="field-input"
                autoComplete="tel"
                placeholder="+255…"
                value={contact.phone}
                onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}
              />
              {fieldErr("phone")}
            </div>
            <div>
              <label className="field-label" htmlFor="ask-email">{t.custom.email}</label>
              <input
                id="ask-email"
                type="email"
                className="field-input"
                autoComplete="email"
                value={contact.email}
                onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
              />
              {fieldErr("email")}
            </div>
            <div>
              <label className="field-label" htmlFor="ask-location">{t.custom.location} *</label>
              <input
                id="ask-location"
                className="field-input"
                placeholder="Mbeya…"
                value={contact.delivery_location}
                onChange={(event) => setContact((current) => ({ ...current, delivery_location: event.target.value }))}
              />
              {fieldErr("delivery_location")}
            </div>
          </div>
          <button type="submit" className="btn-base btn-gold btn-lg mt-5 w-full" disabled={busy}>
            {busy ? t.cart.askPriceSending : t.cart.askPriceSend}
          </button>
        </form>
      </div>
    </div>
  );
}
