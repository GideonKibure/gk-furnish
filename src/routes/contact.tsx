import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { useState, useRef, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { PhoneField } from "@/components/site/PhoneField";
import { Reveal } from "@/components/site/Reveal";
import { Honeypot } from "@/components/site/Honeypot";
import { submitContactMessage } from "@/lib/contact.functions";
import { normaliseTzMobile } from "@/lib/phone-tz";
import { useLang } from "@/i18n/LanguageProvider";
import { pageSectionsQuery, sectionText, settingsToSite, siteSettingsQuery } from "@/lib/site-content";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contact")({
  head: () =>
    seo({
      title: "Contact GK Furnish | Furniture shop in Mbeya",
      description: "Call, WhatsApp or message GK Furnish in Mbeya, Tanzania about ready-made furniture, custom orders and delivery.",
      path: "/contact",
    }),
  component: Contact,
});

function Contact() {
  const { t, lang } = useLang();
  const c = t.contact;
  const { data: settings } = useQuery(siteSettingsQuery);
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const site = settingsToSite(settings);
  const subtitle = sectionText(sections, "contact", "subtitle", lang, c.subtitle);
  const dial = site.phoneDial.startsWith("+") ? site.phoneDial : `+${site.phoneDial.replace(/\D/g, "")}`;
  const wa = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(t.whatsapp.general)}`;
  const send = useServerFn(submitContactMessage);
  const started = useRef(Date.now());
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({ name: "", phone: "", email: "", subject: "", message: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!fields.name.trim()) next["name"] = t.validation.nameRequired;
    if (fields.phone.trim() && !normaliseTzMobile(fields.phone)) next["phone"] = t.validation.phoneInvalid;
    if (fields.email.trim() && !/^\S+@\S+\.\S+$/.test(fields.email.trim())) next["email"] = t.validation.emailInvalid;
    if (!fields.message.trim()) next["message"] = t.validation.messageRequired;
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await send({
        data: {
          name: fields.name.trim().slice(0, 120),
          phone: fields.phone.trim() ? normaliseTzMobile(fields.phone) ?? "" : "",
          email: fields.email.trim(),
          subject: fields.subject.trim(),
          message: fields.message.trim().slice(0, 2000),
          company_website: (e.currentTarget.elements.namedItem("company_website") as HTMLInputElement | null)?.value ?? "",
          started_at: started.current,
        },
      });
    } catch (err) {
      setBusy(false);
      const message = err instanceof Error ? err.message : "";
      toast.error(message.includes("few minutes") ? t.validation.slowDown : t.validation.failed);
      return;
    }
    setBusy(false);
    setFields({ name: "", phone: "", email: "", subject: "", message: "" });
    toast.success(c.sent);
  }

  const channels = [
    { href: `tel:${dial}`, Icon: Phone, label: c.phoneLabel, value: site.phoneDisplay },
    { href: wa, Icon: MessageCircle, label: c.whatsappLabel, value: site.phoneDisplay, external: true },
    { href: `mailto:${site.email}`, Icon: Mail, label: c.emailLabel, value: site.email },
  ] as const;

  return (
    <>
      <PageHeader title={c.title} subtitle={subtitle} crumbs={[{ label: t.nav.home, href: "/" }, { label: t.nav.contact }]} />
      <div className="container-page section-y grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <Reveal variant="left" className="space-y-3">
          {channels.map(({ href, Icon, label, value, ...rest }) => (
            <a
              key={label}
              href={href}
              {...("external" in rest && rest.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="group flex items-center gap-4 rounded-xl border border-border bg-background p-4 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-gold text-navy transition-transform duration-300 group-hover:scale-105">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-navy">{label}</span>
                <span className="mt-0.5 block break-all text-sm text-muted-foreground">{value}</span>
              </span>
            </a>
          ))}
          <div className="flex items-center gap-4 rounded-xl border border-border bg-sand/50 p-4">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-navy text-gold">
              <MapPin className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy">{c.locationLabel}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{site.location}</span>
            </span>
          </div>
        </Reveal>

        <Reveal variant="right">
          <form
            onSubmit={onSubmit}
            className="rounded-xl border border-border bg-background p-6 shadow-[var(--shadow-card)] md:p-8"
          >
            <h2 className="font-display text-2xl text-navy md:text-3xl">{c.formTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{c.subtitle}</p>
            <div className="relative mt-6 grid gap-4">
              <Honeypot />
              <div>
                <label className="field-label" htmlFor="c-name">
                  {c.name} *
                </label>
                <input id="c-name" name="name" autoComplete="name" enterKeyHint="next" className="field-input" value={fields.name} onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))} />
                {errs["name"] ? <p className="field-error">{errs["name"]}</p> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <PhoneField
                    id="c-phone"
                    label={c.phone}
                    value={fields.phone}
                    {...(errs["phone"] ? { error: errs["phone"] } : {})}
                    onChange={(value) => setFields((current) => ({ ...current, phone: value }))}
                    onBlur={() => {
                      if (fields.phone.trim() && !normaliseTzMobile(fields.phone)) setErrs((current) => ({ ...current, phone: t.validation.phoneInvalid }));
                    }}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="c-email">
                    {c.email}
                  </label>
                  <input id="c-email" name="email" type="email" inputMode="email" autoComplete="email" enterKeyHint="next" className="field-input" value={fields.email} onChange={(event) => setFields((current) => ({ ...current, email: event.target.value }))} />
                  {errs["email"] ? <p className="field-error">{errs["email"]}</p> : null}
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="c-sub">
                  {c.subject}
                </label>
                <input id="c-sub" name="subject" autoComplete="organization-title" enterKeyHint="next" className="field-input" value={fields.subject} onChange={(event) => setFields((current) => ({ ...current, subject: event.target.value }))} />
              </div>
              <div>
                <label className="field-label" htmlFor="c-msg">
                  {c.message} *
                </label>
                <textarea id="c-msg" name="message" rows={5} enterKeyHint="done" className="field-input" value={fields.message} onChange={(event) => setFields((current) => ({ ...current, message: event.target.value }))} />
                {errs["message"] ? <p className="field-error">{errs["message"]}</p> : null}
              </div>
              <button
                type="submit"
                disabled={busy}
                className={cn("btn-base btn-gold w-full sm:w-auto", busy && "opacity-70")}
              >
                <Send className="h-4 w-4" />
                {busy ? c.submitting : c.submit}
              </button>
            </div>
          </form>
        </Reveal>
      </div>
    </>
  );
}
