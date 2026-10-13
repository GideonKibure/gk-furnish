import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLang } from "@/i18n/LanguageProvider";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { pageSectionsQuery, sectionText } from "@/lib/site-content";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — GK furnish" },
      {
        name: "description",
        content: "Answers about ordering, custom furniture, delivery and payment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "FAQ — GK furnish" },
      { property: "og:description", content: "Common questions answered." },
    ],
  }),
  component: Faq,
});

function Faq() {
  const { t, lang } = useLang();
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const subtitle = sectionText(sections, "faq", "subtitle", lang, t.faq.subtitle);
  return (
    <>
      <PageHeader title={t.faq.title} subtitle={subtitle} />
      <div className="container-page section-y max-w-3xl">
        <Reveal>
          <Accordion type="single" collapsible>
            {t.faq.items.map((f, i) => (
              <AccordionItem key={i} value={String(i)}>
                <AccordionTrigger className="text-left text-base font-semibold text-navy">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </>
  );
}
