import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { categoriesQuery, productsQuery } from "@/lib/catalog";
import { highestOptionPrice, lowestOptionPrice, optionPriceRows } from "@/lib/order-options";
import { PageHeader } from "@/components/site/PageHeader";
import { PriceFilter } from "@/components/site/PriceFilter";
import { ProductGrid } from "@/components/site/ProductCard";

export const Route = createFileRoute("/products/")({
  head: () => ({ meta: [
    { title: "All Furniture — GK furnish" },
    { name: "description", content: "Browse chairs, tables, beds and lamps made in Mbeya with prices in TSh." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { property: "og:title", content: "All Furniture — GK furnish" },
    { property: "og:description", content: "Search and filter the full GK furnish catalogue." },
  ] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(productsQuery), context.queryClient.ensureQueryData(categoriesQuery)]),
  component: Products,
});

function Products() {
  const { t, lang } = useLang();
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const maxAll = Math.max(
    ...products.flatMap((p) => {
      const rows = optionPriceRows(p);
      return rows.length ? rows.map((row) => row.price) : [p.price];
    }),
    0,
  );
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [sort, setSort] = useState("new");
  const [max, setMax] = useState(maxAll); const [avail, setAvail] = useState(false);
  const list = useMemo(() => {
    const r = products.filter((p) =>
      (!q || `${p.name} ${p.name_sw ?? ""}`.toLowerCase().includes(q.toLowerCase())) &&
      (!cat || p.category_id === cat) && lowestOptionPrice(p) <= max && (!avail || p.is_available));
    if (sort === "low") r.sort((a, b) => lowestOptionPrice(a) - lowestOptionPrice(b));
    if (sort === "high") r.sort((a, b) => highestOptionPrice(b) - highestOptionPrice(a));
    if (sort === "name") r.sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [products, q, cat, sort, max, avail]);

  return (
    <>
      <PageHeader title={t.products.title} subtitle={t.products.subtitle} />
      <div className="container-page section-y">
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input aria-label={t.products.search} placeholder={t.products.searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} className="field-input lg:col-span-2" />
          <select aria-label={t.products.category} value={cat} onChange={(e) => setCat(e.target.value)} className="field-input">
            <option value="">{t.products.allCategories}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{localized(lang, c.name, c.name_sw)}</option>)}
          </select>
          <select aria-label={t.products.sort} value={sort} onChange={(e) => setSort(e.target.value)} className="field-input">
            <option value="new">{t.products.sortNewest}</option><option value="low">{t.products.sortPriceLow}</option>
            <option value="high">{t.products.sortPriceHigh}</option><option value="name">{t.products.sortName}</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={avail} onChange={(e) => setAvail(e.target.checked)} className="h-5 w-5 accent-[var(--gold)]" />{t.products.availableOnly}</label>
          <PriceFilter
            label={t.products.maxPrice}
            value={max}
            max={maxAll}
            count={list.length}
            resultsLabel={t.products.results}
            onChange={setMax}
          />
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{list.length} {t.products.results}</p>
        <ProductGrid products={list} />
      </div>
    </>
  );
}
