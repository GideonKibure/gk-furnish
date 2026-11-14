import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/brand/Breadcrumbs";
import { shopSearchSchema, ShopView } from "@/components/site/ShopView";
import { useAuthUser } from "@/hooks/use-auth";
import { useLang } from "@/i18n/LanguageProvider";
import { categoriesQuery, productsQuery, ratingSummaryQuery } from "@/lib/catalog";
import { pageSectionsQuery } from "@/lib/site-content";
import { freshShopSeed } from "@/lib/shop-order";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/products/")({
  validateSearch: (s) => shopSearchSchema.parse(s),
  head: () =>
    seo({
      title: "Furniture for sale in Tanzania | GK Furnish",
      description: "Browse chairs, tables, beds and lamps from GK Furnish in Mbeya. Prices in TZS, with delivery arranged or free collection from the workshop.",
      path: "/products",
    }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(pageSectionsQuery).catch(() => []),
      context.queryClient.prefetchQuery(ratingSummaryQuery),
    ]);
    return { shopSeed: freshShopSeed() };
  },
  component: Products,
});

function Products() {
  const { t } = useLang();
  const { user } = useAuthUser();
  const signedIn = Boolean(user);
  const { shopSeed } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/products/" });
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: cats } = useSuspenseQuery(categoriesQuery);

  return (
    <div className="bg-sand">
      <div className="container-page py-5 md:py-8">
        <Breadcrumbs
          items={
            signedIn
              ? [{ label: t.shell.shop }]
              : [{ label: t.nav.home, href: "/" }, { label: t.shell.shop }]
          }
        />
        <h1 className="display-lg mt-2">{t.shop.title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground md:text-base">{t.products.subtitle}</p>
        <div className="mt-5 md:mt-6">
          <ShopView
            products={products}
            categories={cats}
            search={search}
            seed={shopSeed}
            onSearch={(next) => void navigate({ search: next, replace: true, resetScroll: false })}
          />
        </div>
      </div>
    </div>
  );
}
