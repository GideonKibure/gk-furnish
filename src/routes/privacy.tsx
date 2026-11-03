import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { useLang } from "@/i18n/LanguageProvider";
import { settingsToSite, siteSettingsQuery } from "@/lib/site-content";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — GK furnish" },
      {
        name: "description",
        content: "How GK furnish collects, uses and protects the personal information of customers ordering furniture online.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Privacy policy — GK furnish" },
      { property: "og:description", content: "How GK furnish handles your personal information." },
    ],
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
      <PageHeader title={p.title} subtitle={p.subtitle}>
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
            <section className="rounded-2xl border border-gold/30 bg-gold-soft/40 p-5">
              <h2 className="font-display text-2xl tracking-tight text-navy">{p.contactTitle}</h2>
              <p className="mt-2 text-muted-foreground">{p.contactBody}</p>
              <ul className="mt-4 space-y-2 text-sm font-semibold text-navy">
                <li>
                  <a href={`mailto:${site.email}`} className="inline-flex items-center gap-2 hover:text-gold">
                    <Mail className="h-4 w-4 text-gold" />
                    {site.email}
                  </a>
                </li>
                <li>
                  <a href={`tel:${dial}`} className="inline-flex items-center gap-2 hover:text-gold">
                    <Phone className="h-4 w-4 text-gold" />
                    {site.phoneDisplay}
                  </a>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${site.whatsappNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 hover:text-gold"
                  >
                    <MessageCircle className="h-4 w-4 text-gold" />
                    WhatsApp
                  </a>
                </li>
                <li className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gold" />
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
