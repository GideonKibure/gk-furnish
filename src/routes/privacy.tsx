import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { useLang } from "@/i18n/LanguageProvider";
import { settingsToSite, siteSettingsQuery } from "@/lib/site-content";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () =>
    seo({
      title: "Privacy policy — GK furnish",
      description: "How GK furnish collects, uses and protects the personal information of customers ordering furniture online.",
      path: "/privacy",
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useLang();
  const p = t.privacy;
  const { data: settings } = useQuery(siteSettingsQuery);
  const site = settingsToSite(settings);
  const dial = site.phoneDial.startsWith("+") ? site.phoneDial : `+${site.phoneDial.replace(/\D/g, "")}`;

  return (
    <>
      <PageHeader title={p.title} subtitle={p.subtitle} crumbs={[{ label: t.nav.home, href: "/" }, { label: p.title }]}>
        <p className="mt-4 text-sm text-muted-foreground">{p.updated}</p>
      </PageHeader>
      <div className="container-page section-y max-w-3xl">
        <div className="space-y-8">
          {p.sections.map((s, i) => (
            <Reveal key={s.title} delayMs={Math.min(i, 4) * 40}>
              <section>
                <h2 className="font-display text-2xl tracking-tight text-navy">{s.title}</h2>
                <p className="mt-2 leading-relaxed text-muted-foreground">{s.body}</p>
              </section>
            </Reveal>
          ))}
          <Reveal>
            <section className="rounded-xl border border-gold/40 bg-gold-tint p-5">
              <h2 className="font-display text-2xl tracking-tight text-navy">{p.contactTitle}</h2>
              <p className="mt-2 text-muted-foreground">{p.contactBody}</p>
              <ul className="mt-4 space-y-2 text-sm font-semibold text-navy">
                <li>
                  <a href={`mailto:${site.email}`} className="inline-flex items-center gap-2 hover:text-gold-ink">
                    <Mail className="h-4 w-4 text-gold-ink" />
                    {site.email}
                  </a>
                </li>
                <li>
                  <a href={`tel:${dial}`} className="inline-flex items-center gap-2 hover:text-gold-ink">
                    <Phone className="h-4 w-4 text-gold-ink" />
                    {site.phoneDisplay}
                  </a>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${site.whatsappNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 hover:text-gold-ink"
                  >
                    <MessageCircle className="h-4 w-4 text-gold-ink" />
                    WhatsApp
                  </a>
                </li>
                <li className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gold-ink" />
                  {site.location}
                </li>
              </ul>
            </section>
          </Reveal>
        </div>
      </div>
    </>
  );
}
