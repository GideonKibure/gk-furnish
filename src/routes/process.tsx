import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, PenTool, Trees, Hammer, Paintbrush, ShieldCheck, Truck } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { pageSectionsQuery, sectionText } from "@/lib/site-content";

export const Route = createFileRoute("/process")({
  head: () => ({ meta: [{ title: "Our Process — GK furnish" }, { name: "description", content: "Seven steps from your inquiry to delivery." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { property: "og:title", content: "Our Process — GK furnish" }, { property: "og:description", content: "How GK furnish makes your furniture." }] }),
  component: Process,
});

const ICONS = [MessageSquare, PenTool, Trees, Hammer, Paintbrush, ShieldCheck, Truck];

function Process() {
  const { t, lang } = useLang();
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const subtitle = sectionText(sections, "process", "subtitle", lang, t.process.subtitle);
  return (
    <>
      <PageHeader title={t.process.title} subtitle={subtitle} />
      <ol className="container-page section-y grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {t.process.steps.map((s, i) => { const I = ICONS[i] ?? MessageSquare; return (
          <Reveal key={s.title} delayMs={i * 50}>
          <li className="card-surface p-6 transition-transform hover:-translate-y-1">
            <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-navy text-gold"><I className="h-5 w-5" /></span>
              <span className="font-display text-3xl text-gold">0{i + 1}</span></div>
            <h2 className="mt-4 text-xl text-navy">{s.title}</h2><p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </li>
          </Reveal>); })}
      </ol>
    </>
  );
}
