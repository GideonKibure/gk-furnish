import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useLang } from "@/i18n/LanguageProvider";
import { PageHeader } from "@/components/site/PageHeader";
import { PaymentPolicy } from "@/components/site/PaymentPolicy";
import { en } from "@/i18n/en";
import { pageSectionsQuery, sectionText } from "@/lib/site-content";
import { seo } from "@/lib/seo";

const FAQ_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: en.faq.items.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

export const Route = createFileRoute("/faq")({
  head: () => ({
    ...seo({
      title: "FAQ — GK furnish",
      description: "Answers about ordering, custom furniture, payment, delivery, returns and warranty.",
      path: "/faq",
    }),
    scripts: [{ type: "application/ld+json", children: FAQ_LD }],
  }),
  component: Faq,
});

function Faq() {
  const { t, lang } = useLang();
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const subtitle = sectionText(sections, "faq", "subtitle", lang, t.faq.subtitle);
  return (
    <>
      <PageHeader title={t.faq.title} subtitle={subtitle} crumbs={[{ label: t.nav.home, href: "/" }, { label: t.nav.faq }]} />
      <div className="container-page section-y grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Accordion type="single" collapsible className="panel divide-y divide-border px-4 md:px-5">
          {t.faq.items.map((f, i) => (
            <AccordionItem key={i} value={String(i)} className="border-0">
              <AccordionTrigger className="text-left text-[0.95rem] font-semibold text-navy hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-xl bg-navy p-5 text-white">
            <p className="font-semibold">{t.home2.contactTitle}</p>
            <p className="mt-1 text-sm text-white/75">{t.home2.contactBody}</p>
            <Link to="/contact" className="btn-base btn-gold btn-sm mt-4">
              <MessageCircle className="h-4 w-4" />
              {t.nav.contact}
            </Link>
          </div>
          <PaymentPolicy compact />
        </aside>
      </div>
    </>
  );
}
