import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/brand/Breadcrumbs";
import { shopSearchSchema, ShopView } from "@/components/site/ShopView";
import { imageFor } from "@/data/images";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { categoriesQuery, productsQuery, ratingSummaryQuery } from "@/lib/catalog";
import { breadcrumbLd, metaText, seo } from "@/lib/seo";

export const Route = createFileRoute("/categories/$slug")({
  validateSearch: (s) => shopSearchSchema.omit({ cat: true }).parse(s),
  loader: async ({ context, params }) => {
    const [cats] = await Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.prefetchQuery(ratingSummaryQuery),
    ]);
    const c = cats.find((x) => x.slug === params.slug);
    if (!c) throw notFound();
    return { name: c.name, desc: c.description ?? "", slug: c.slug, image: imageFor(c.image_key) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex, nofollow" }] };
    const description =
      metaText(loaderData.desc, 500) ||
      `Shop ${loaderData.name} from GK Furnish in Mbeya, Tanzania. Prices are shown in TZS, with delivery arranged or collection from the workshop.`;
    const base = seo({
      title: `${loaderData.name} | GK Furnish, Mbeya`,
      description,
      path: `/categories/${loaderData.slug}`,
      image: loaderData.image,
    });
    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/categories" },
          { name: loaderData.name, path: `/categories/${loaderData.slug}` },
        ]),
      ],
    };
    return { ...base, scripts: [{ type: "application/ld+json", children: JSON.stringify(graph) }] };
  },
  component: Cat,
});

function Cat() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: products } = useSuspenseQuery(productsQuery);
  const c = cats.find((x) => x.slug === slug);
  if (!c) return null;
  const name = localized(lang, c.name, c.name_sw);
  const description = localized(lang, c.description ?? "", c.description_sw);

  return (
    <div className="bg-sand">
      <div className="container-page py-5 md:py-8">
        <Breadcrumbs
          items={[
            { label: t.nav.home, href: "/" },
            { label: t.shell.shop, href: "/products" },
            { label: name },
          ]}
        />
        <h1 className="display-lg mt-2">{name}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>}
        <div className="mt-5 md:mt-6">
          <ShopView
            products={products}
            categories={cats}
            search={search}
            lockedCategoryId={c.id}
            onSearch={(next) =>
              void navigate({
                to: "/categories/$slug",
                params: { slug },
                search: { q: next.q, max: next.max, avail: next.avail, sort: next.sort },
                replace: true,
                resetScroll: false,
              })
            }
            onCategory={(next) =>
              next
                ? void navigate({ to: "/categories/$slug", params: { slug: next } })
                : void navigate({ to: "/products" })
            }
          />
        </div>
      </div>
    </div>
  );
}
