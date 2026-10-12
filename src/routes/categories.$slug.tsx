import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { ProductGrid } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { categoriesQuery, productsQuery } from "@/lib/catalog";

export const Route = createFileRoute("/categories/$slug")({
  loader: async ({ context, params }) => {
    const [cats] = await Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(productsQuery),
    ]);
    const c = cats.find((x) => x.slug === params.slug);
    if (!c) throw notFound();
    return { name: c.name, desc: c.description ?? "" };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.name} — GK furnish` },
            { name: "description", content: loaderData.desc },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary_large_image" },
            { property: "og:title", content: `${loaderData.name} — GK furnish` },
            { property: "og:description", content: loaderData.desc },
          ],
        }
      : { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] },
  component: Cat,
});

function Cat() {
  const { slug } = Route.useParams();
  const { t, lang } = useLang();
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: products } = useSuspenseQuery(productsQuery);
  const c = cats.find((x) => x.slug === slug)!;
  const list = products.filter((p) => p.category_id === c.id);

  return (
    <>
      <PageHeader
        title={localized(lang, c.name, c.name_sw)}
        subtitle={localized(lang, c.description ?? "", c.description_sw)}
      >
        <Link
          to="/categories"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-navy transition-colors hover:text-gold"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.categories.title}
        </Link>
      </PageHeader>
      <div className="container-page section-y">
        <Reveal>
          <p className="mb-6 text-sm text-muted-foreground">
            {list.length} {t.common.items}
          </p>
        </Reveal>
        <ProductGrid products={list} />
      </div>
    </>
  );
}
