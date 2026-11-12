import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, PenTool, Trees, Hammer, Paintbrush, ShieldCheck, Truck } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { PageHeader } from "@/components/site/PageHeader";
import { PaymentPolicy } from "@/components/site/PaymentPolicy";
import { pageSectionsQuery, sectionText } from "@/lib/site-content";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/process")({
  head: () =>
    seo({
      title: "How furniture orders work | GK Furnish",
      description: "From the first message to delivery or workshop collection: how GK Furnish in Mbeya handles a furniture order.",
      path: "/process",
    }),
  component: Process,
});

const ICONS = [MessageSquare, PenTool, Trees, Hammer, Paintbrush, ShieldCheck, Truck];

function Process() {
  const { t, lang } = useLang();
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const subtitle = sectionText(sections, "process", "subtitle", lang, t.process.subtitle);
  return (
    <>
      <PageHeader title={t.process.title} subtitle={subtitle} crumbs={[{ label: t.nav.home, href: "/" }, { label: t.nav.process }]} />
      <ol className="container-page section-y grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {t.process.steps.map((s, i) => {
          const I = ICONS[i] ?? MessageSquare;
          return (
            <li key={s.title} className="panel p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-navy text-gold">
                  <I className="h-5 w-5" />
                </span>
                <span className="font-display text-2xl font-bold text-gold-ink">0{i + 1}</span>
              </div>
              <h2 className="mt-3 text-lg font-bold">{s.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </li>
          );
        })}
      </ol>
      <div className="container-page pb-12 md:pb-16">
        <PaymentPolicy />
      </div>
    </>
  );
}
