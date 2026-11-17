import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import { WhatsAppOrderLink } from "@/components/site/WhatsAppOrderLink";
import { fill } from "@/i18n/fill";
import { useLang } from "@/i18n/LanguageProvider";
import { policyFigureMissing, policySettingsFrom } from "@/lib/policy";
import { seo } from "@/lib/seo";
import { siteSettingsQuery } from "@/lib/site-content";
import { whatsAppOrderText } from "@/lib/whatsapp";
import { SITE } from "@/config/site";

export const Route = createFileRoute("/policies")({
  head: () =>
    seo({
      title: "Policies — GK Furnish",
      description: "Draft cancellation, delivery, inspection and warranty terms for GK Furnish in Mbeya. The owner must confirm the numbers.",
      path: "/policies",
    }),
  component: PoliciesPage,
});

function Figure({ value, template, ask }: { value: number | null; template: string; ask: string }) {
  if (policyFigureMissing(value)) return <>{ask}</>;
  return <>{fill(template, { hours: value ?? 0, days: value ?? 0, months: value ?? 0 })}</>;
}

function PoliciesPage() {
  const { t } = useLang();
  const p = t.policies;
  const { data } = useQuery(siteSettingsQuery);
  const settings = policySettingsFrom(data);
  const askText = whatsAppOrderText([p.ask, `${SITE.url}/policies`]);

  return (
    <>
      <PageHeader title={p.title} subtitle={p.subtitle} crumbs={[{ label: t.nav.home, href: "/" }, { label: p.title }]} />
      <div className="container-page section-y max-w-3xl space-y-8">
        <p className="rounded-lg border border-gold/50 bg-gold-tint px-4 py-3 text-sm font-semibold text-navy">{p.draft}</p>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold">
          <a className="rounded-full border border-border px-3 py-2" href="#cancellation">{p.cancellationTitle}</a>
          <a className="rounded-full border border-border px-3 py-2" href="#delivery">{p.deliveryTitle}</a>
          <a className="rounded-full border border-border px-3 py-2" href="#inspection">{p.inspectionTitle}</a>
          <a className="rounded-full border border-border px-3 py-2" href="#warranty">{p.warrantyTitle}</a>
          <a className="rounded-full border border-border px-3 py-2" href="#custom">{p.customTitle}</a>
        </nav>

        <section id="cancellation" className="scroll-mt-24 space-y-3">
          <h2 className="font-display text-2xl text-navy">{p.cancellationTitle}</h2>
          <p className="leading-relaxed text-muted-foreground">{p.beforePayment}</p>
          <p className="leading-relaxed text-muted-foreground">{p.afterAdvance}</p>
          <p className="leading-relaxed text-muted-foreground">{p.afterProduction}</p>
          <p className="leading-relaxed text-muted-foreground">
            {settings.readyMadeReturnWindowHours === 0 ? (
              p.noReturns
            ) : (
              <Figure value={settings.readyMadeReturnWindowHours} template={p.readyMade} ask={p.ask} />
            )}
          </p>
          <p className="leading-relaxed text-muted-foreground">
            <Figure value={settings.refundProcessingDays} template={p.refundDays} ask={p.ask} />
          </p>
        </section>

        <section id="delivery" className="scroll-mt-24">
          <h2 className="font-display text-2xl text-navy">{p.deliveryTitle}</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">{p.deliveryBody}</p>
        </section>

        <section id="inspection" className="scroll-mt-24">
          <h2 className="font-display text-2xl text-navy">{p.inspectionTitle}</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            <Figure value={settings.inspectionWindowHours} template={p.inspectionBody} ask={p.ask} />
          </p>
        </section>

        <section id="warranty" className="scroll-mt-24 space-y-3">
          <h2 className="font-display text-2xl text-navy">{p.warrantyTitle}</h2>
          <p className="leading-relaxed text-muted-foreground">{p.warrantyBody}</p>
          <p className="leading-relaxed text-muted-foreground">
            <Figure value={settings.warrantyMonthsStructure} template={p.structureMonths} ask={p.ask} />
          </p>
          <p className="leading-relaxed text-muted-foreground">
            <Figure value={settings.warrantyMonthsFinish} template={p.finishMonths} ask={p.ask} />
          </p>
        </section>

        <section id="custom" className="scroll-mt-24">
          <h2 className="font-display text-2xl text-navy">{p.customTitle}</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">{p.customBody}</p>
        </section>

        <WhatsAppOrderLink source="policies" text={askText} className="btn-base btn-outline-navy min-h-11">
          {p.ask}
        </WhatsAppOrderLink>
        <p className="text-sm">
          <Link to="/contact" className="font-semibold text-navy underline-offset-2 hover:underline">{t.nav.contact}</Link>
        </p>
      </div>
    </>
  );
}
