import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Phone } from "lucide-react";
import { CustomOrderForm } from "@/components/site/CustomOrderForm";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { WhatsAppOrderLink } from "@/components/site/WhatsAppOrderLink";
import { telLink } from "@/config/site";
import { useSiteImages } from "@/hooks/use-site-images";
import { useLang } from "@/i18n/LanguageProvider";
import { pageSectionsQuery } from "@/lib/site-content";
import { absoluteUrl, seo } from "@/lib/seo";
import { whatsAppOrderText } from "@/lib/whatsapp";

export const Route = createFileRoute("/custom-order")({
  validateSearch: (search: Record<string, unknown>) => {
    const product = typeof search["product"] === "string" ? search["product"].trim().slice(0, 80) : "";
    return product ? { product } : {};
  },
  head: () =>
    seo({
      title: "Custom furniture in Mbeya | GK Furnish",
      description: "Order custom furniture from GK Furnish in Mbeya. Share the size, material and budget, and we quote before any work starts.",
      path: "/custom-order",
    }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageSectionsQuery).catch(() => []),
  component: Custom,
});

function Custom() {
  const { t } = useLang();
  const { product } = Route.useSearch();
  const { image } = useSiteImages();

  return (
    <>
      <PageHeader
        title={t.custom.title}
        subtitle={t.custom.subtitle}
        image={image("header.custom-order", null)}
        crumbs={[{ label: t.nav.home, href: "/" }, { label: t.nav.custom }]}
      />

      <section className="container-page section-y">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-10">
          <Reveal variant="left" className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-xl bg-navy p-6 text-white md:p-7">
              <p className="eyebrow !text-gold">{t.custom.howEyebrow}</p>
              <h2 className="mt-1 font-display text-2xl font-bold leading-tight !text-white">{t.custom.howTitle}</h2>
              <ol className="mt-6 space-y-4">
                {[t.custom.step1, t.custom.step2, t.custom.step3].map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm text-white/80">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-xs font-bold text-navy">
                      {i + 1}
                    </span>
                    <span className="pt-1">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="panel p-5 md:p-6">
              <p className="text-sm font-semibold text-navy">{t.custom.preferContact}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <WhatsAppOrderLink
                  source="custom"
                  text={whatsAppOrderText([t.whatsapp.customIntro, absoluteUrl("/custom-order")])}
                  className="btn-base btn-outline-navy min-h-11 flex-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t.whatsapp.orderButton}
                </WhatsAppOrderLink>
                <a href={telLink()} className="btn-base btn-outline-navy flex-1">
                  <Phone className="h-4 w-4" />
                  {t.common.call}
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {t.custom.orBrowse}{" "}
                <Link to="/products" className="font-semibold text-navy underline-offset-2 hover:underline">
                  {t.nav.products}
                </Link>
              </p>
            </div>
          </Reveal>

          <Reveal variant="right">
            <CustomOrderForm {...(product ? { productSlug: product } : {})} />
          </Reveal>
        </div>
      </section>
    </>
  );
}
