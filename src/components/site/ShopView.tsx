import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { FilterSidebar } from "@/components/brand/FilterSidebar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { fill } from "@/i18n/fill";
import { localized, useLang } from "@/i18n/LanguageProvider";
import type { Category, Product } from "@/lib/catalog";
import { highestOptionPrice, lowestOptionPrice, optionPriceRows } from "@/lib/order-options";
import { asksForPrice, isPurchasable, popularity } from "@/lib/product-display";
import { PriceFilter } from "./PriceFilter";
import { ProductGrid } from "./ProductCard";

export const SORTS = ["popular", "new", "low", "high", "name"] as const;
export type ShopSort = (typeof SORTS)[number];

export const shopSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  cat: z.string().trim().max(80).optional().catch(undefined),
  max: z.coerce.number().int().min(0).optional().catch(undefined),
  avail: z.coerce.boolean().optional().catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
});
export type ShopSearch = z.infer<typeof shopSearchSchema>;

function productMaxPrice(p: Product) {
  const rows = optionPriceRows(p);
  return rows.length ? Math.max(...rows.map((row) => row.price)) : p.price;
}

/**
 * Shop layout: filter sidebar (sheet on mobile), sort and product grid.
 * Filters live in the URL so search links and the back button work.
 */
export function ShopView({
  products,
  categories,
  search,
  onSearch,
  lockedCategoryId,
  onCategory,
  heading,
}: {
  products: Product[];
  categories: Category[];
  search: ShopSearch;
  onSearch: (next: ShopSearch) => void;
  /** Category pages show only this category; the sidebar links to other categories. */
  lockedCategoryId?: string;
  onCategory?: (slug: string) => void;
  heading?: string;
}) {
  const { t, lang } = useLang();
  const [sheetOpen, setSheetOpen] = useState(false);
  const maxAll = Math.max(0, ...products.filter((p) => !asksForPrice(p)).map(productMaxPrice));
  const max = search.max != null ? Math.min(search.max, maxAll) : maxAll;
  const sort: ShopSort = search.sort ?? "popular";
  const q = (search.q ?? "").toLowerCase();
  const selectedCat = lockedCategoryId
    ? (categories.find((c) => c.id === lockedCategoryId)?.slug ?? "")
    : (search.cat ?? "");
  const catId = categories.find((c) => c.slug === selectedCat)?.id;

  const matchesText = (p: Product) =>
    !q ||
    `${p.name} ${p.name_sw ?? ""} ${p.short_description ?? ""} ${p.categories?.name ?? ""} ${p.sku ?? ""}`
      .toLowerCase()
      .includes(q);

  const base = useMemo(() => products.filter(matchesText), [products, q]);

  const list = useMemo(() => {
    const r = base.filter(
      (p) =>
        (!catId || p.category_id === catId) &&
        (asksForPrice(p) || lowestOptionPrice(p) <= max) &&
        (!search.avail || (isPurchasable(p) && p.stock_quantity > 0)),
    );
    if (sort === "popular") r.sort((a, b) => popularity(b) - popularity(a));
    if (sort === "low") r.sort((a, b) => (asksForPrice(a) ? Number.POSITIVE_INFINITY : lowestOptionPrice(a)) - (asksForPrice(b) ? Number.POSITIVE_INFINITY : lowestOptionPrice(b)));
    if (sort === "high") r.sort((a, b) => (asksForPrice(b) ? Number.NEGATIVE_INFINITY : highestOptionPrice(b)) - (asksForPrice(a) ? Number.NEGATIVE_INFINITY : highestOptionPrice(a)));
    if (sort === "name") r.sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [base, catId, max, search.avail, sort]);

  const inCategory = base.filter((p) => !catId || p.category_id === catId);
  const inStockCount = inCategory.filter((p) => isPurchasable(p) && p.stock_quantity > 0).length;

  const set = (patch: Partial<ShopSearch>) => onSearch({ ...search, ...patch });
  const selectCategory = (slug: string) => {
    if (onCategory) onCategory(slug);
    else set({ cat: slug || undefined });
    setSheetOpen(false);
  };
  const clear = () => onSearch(lockedCategoryId ? {} : { q: search.q });

  const sidebar = (
    <FilterSidebar
      title={t.shop.filters}
      clearLabel={t.shop.clearAll}
      onClear={clear}
      categoriesLabel={t.shop.categories}
      allLabel={t.shop.allProducts}
      allCount={base.length}
      categories={categories.map((c) => ({
        key: c.slug,
        label: localized(lang, c.name, c.name_sw),
        count: base.filter((p) => p.category_id === c.id).length,
      }))}
      selected={selectedCat}
      onSelect={selectCategory}
      priceLabel={t.shop.priceRange}
      price={
        <PriceFilter
          label={t.products.maxPrice}
          value={max}
          max={maxAll}
          count={list.length}
          resultsLabel={t.products.results}
          onChange={(value) => set({ max: value >= maxAll ? undefined : value })}
        />
      }
      availabilityLabel={t.shop.availability}
      inStockLabel={t.shop.inStock}
      inStockCount={inStockCount}
      inStockOnly={Boolean(search.avail)}
      onInStockOnly={(value) => set({ avail: value || undefined })}
    />
  );

  const sortOptions: { value: ShopSort; label: string }[] = [
    { value: "popular", label: t.shop.sortPopular },
    { value: "new", label: t.products.sortNewest },
    { value: "low", label: t.products.sortPriceLow },
    { value: "high", label: t.products.sortPriceHigh },
    { value: "name", label: t.products.sortName },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-8">
      <aside className="hidden lg:block">
        <div className="sticky top-24">{sidebar}</div>
      </aside>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {heading && <h2 className="section-title">{heading}</h2>}
            <p className="text-sm text-muted-foreground">
              {search.q ? `${fill(t.shop.resultsFor, { q: search.q })} · ` : ""}
              {fill(t.shop.results, { count: list.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="btn-base btn-outline-navy btn-sm lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t.shop.filters}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground max-sm:sr-only">{t.products.sort}:</span>
              <select
                value={sort}
                onChange={(e) =>
                  set({
                    sort: e.target.value === "popular" ? undefined : (e.target.value as ShopSort),
                  })
                }
                className="field-input !min-h-9 !w-auto !py-1.5 !pr-8 text-sm font-medium"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <ProductGrid products={list} eagerFirst className="xl:grid-cols-3 2xl:grid-cols-4" />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="flex w-[88vw] max-w-sm flex-col gap-0 overflow-y-auto bg-sand p-4"
        >
          <SheetTitle className="sr-only">{t.shop.filters}</SheetTitle>
          <SheetDescription className="sr-only">{t.shop.title}</SheetDescription>
          <div className="mt-6 flex-1">{sidebar}</div>
          <button
            type="button"
            className="btn-base btn-gold mt-4 w-full"
            onClick={() => setSheetOpen(false)}
          >
            {fill(t.shop.showResults, { count: list.length })}
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
