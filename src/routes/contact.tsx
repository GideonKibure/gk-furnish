import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/i18n/LanguageProvider";
import { pageSectionsQuery, sectionText, settingsToSite, siteSettingsQuery } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — GK furnish" },
      { name: "description", content: "Call, WhatsApp or message GK furnish in Mbeya." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Contact — GK furnish" },
      { property: "og:description", content: "Get in touch with GK furnish." },
    ],
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
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const v = (k: string) => String(fd.get(k) ?? "").trim();
    if (!v("name")) {
      toast.error(t.validation.nameRequired);
      return;
    }
    if (!v("message")) {
      toast.error(t.validation.messageRequired);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: v("name").slice(0, 120),
      phone: v("phone") || null,
      email: v("email") || null,
      subject: v("subject") || null,
      message: v("message").slice(0, 2000),
    });
    setBusy(false);
    if (error) {
      toast.error(t.validation.failed);
      return;
    }
    form.reset();
    toast.success(c.sent);
  }

  const channels = [
    { href: `tel:${dial}`, Icon: Phone, label: c.phoneLabel, value: site.phoneDisplay },
    { href: wa, Icon: MessageCircle, label: c.whatsappLabel, value: site.phoneDisplay, external: true },
    { href: `mailto:${site.email}`, Icon: Mail, label: c.emailLabel, value: site.email },
  ] as const;

  return (
    <>
      <PageHeader title={c.title} subtitle={subtitle} />
      <div className="container-page section-y grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <Reveal variant="left" className="space-y-3">
          {channels.map(({ href, Icon, label, value, ...rest }) => (
            <a
              key={label}
              href={href}
              {...("external" in rest && rest.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[var(--shadow-lift)]"
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
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-sand/50 p-4">
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
            className="rounded-[1.75rem] border border-border bg-background p-6 shadow-[var(--shadow-card)] md:p-8"
          >
            <h2 className="font-display text-2xl text-navy md:text-3xl">{c.formTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{c.subtitle}</p>
            <div className="mt-6 grid gap-4">
              <div>
                <label className="field-label" htmlFor="c-name">
                  {c.name} *
                </label>
                <input id="c-name" name="name" className="field-input" autoComplete="name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="c-phone">
                    {c.phone}
                  </label>
                  <input id="c-phone" name="phone" type="tel" className="field-input" autoComplete="tel" />
                </div>
                <div>
                  <label className="field-label" htmlFor="c-email">
                    {c.email}
                  </label>
                  <input id="c-email" name="email" type="email" className="field-input" autoComplete="email" />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="c-sub">
                  {c.subject}
                </label>
                <input id="c-sub" name="subject" className="field-input" />
              </div>
              <div>
                <label className="field-label" htmlFor="c-msg">
                  {c.message} *
                </label>
                <textarea id="c-msg" name="message" rows={5} className="field-input" />
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
