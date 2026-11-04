import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CategoryTile } from "@/components/brand/CategoryTile";
import { PageHeader } from "@/components/site/PageHeader";
import { imageFor } from "@/data/images";
import { useSiteImages } from "@/hooks/use-site-images";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { categoriesQuery, productsQuery } from "@/lib/catalog";
import { pageSectionsQuery } from "@/lib/site-content";
import { categoryImageSlot } from "@/lib/site-images";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/categories/")({
  head: () =>
    seo({
      title: "Categories — GK furnish",
      description: "Study chairs, tables, beds, table lamps and custom furniture from GK furnish.",
      path: "/categories",
    }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(pageSectionsQuery).catch(() => []),
    ]),
  component: Cats,
});

function Cats() {
  const { t, lang } = useLang();
  const { data } = useSuspenseQuery(categoriesQuery);
  const { data: products } = useSuspenseQuery(productsQuery);
  const { image } = useSiteImages();

  return (
    <>
      <PageHeader
        title={t.categories.title}
        subtitle={t.categories.subtitle}
        image={image("header.categories", null)}
        crumbs={[{ label: t.nav.home, href: "/" }, { label: t.categories.title }]}
      />
      <div className="container-page section-y">
        <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {data.map((c) => (
            <CategoryTile
              key={c.id}
              slug={c.slug}
              label={localized(lang, c.name, c.name_sw)}
              image={image(categoryImageSlot(c.slug), imageFor(c.image_key))}
              count={products.filter((p) => p.category_id === c.id).length}
            />
          ))}
        </div>
      </div>
    </>
  );
}
