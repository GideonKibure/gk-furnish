import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { imageFor } from "@/data/images";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { categoriesQuery } from "@/lib/catalog";

export const Route = createFileRoute("/categories/")({
  head: () => ({
    meta: [
      { title: "Categories — GK furnish" },
      { name: "description", content: "Chairs, tables, beds, table lamps and custom furniture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Categories — GK furnish" },
      { property: "og:description", content: "Browse GK furnish by category." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQuery),
  component: Cats,
});

function Cats() {
  const { t, lang } = useLang();
  const { data } = useSuspenseQuery(categoriesQuery);

  return (
    <>
      <PageHeader title={t.categories.title} subtitle={t.categories.subtitle} />
      <div className="container-page section-y">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c, i) => (
            <Reveal key={c.id} delayMs={i * 70} variant="scale">
              <Link
                to="/categories/$slug"
                params={{ slug: c.slug }}
                className="group relative block overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-card)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="aspect-[4/5] overflow-hidden sm:aspect-[4/3]">
                  <img
                    src={imageFor(c.image_key)}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                  <h2 className="font-display text-2xl text-white md:text-3xl">
                    {localized(lang, c.name, c.name_sw)}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-white/75">
                    {localized(lang, c.description ?? "", c.description_sw)}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold">
                    {t.common.viewCollection}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </>
  );
}
