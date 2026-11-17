import { Link } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/brand/EmptyState";
import { FilterSidebar } from "@/components/brand/FilterSidebar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatPrice } from "@/config/site";
import { fill } from "@/i18n/fill";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { trackEvent } from "@/lib/analytics";
import type { Category, Product } from "@/lib/catalog";
import { highestOptionPrice, lowestOptionPrice, optionPriceRows } from "@/lib/order-options";
import { asksForPrice, isPurchasable, popularity } from "@/lib/product-display";
import { orderBySeed, stableShopSeed } from "@/lib/shop-order";
import { bandForLimits, bandsForPrices, rankSearch, searchTier, type BudgetBand } from "@/lib/shop-search";
import { PriceFilter } from "./PriceFilter";
import { ProductGrid } from "./ProductCard";
import { WhatsAppOrderLink } from "./WhatsAppOrderLink";

export const SORTS = ["popular", "new", "low", "high", "name"] as const;
export type ShopSort = (typeof SORTS)[number];

export const shopSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  cat: z.string().trim().max(80).optional().catch(undefined),
  min: z.coerce.number().int().min(0).optional().catch(undefined),
  max: z.coerce.number().int().min(0).optional().catch(undefined),
  avail: z.coerce.boolean().optional().catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
});
export type ShopSearch = z.infer<typeof shopSearchSchema>;

function productMaxPrice(p: Product) {
  const rows = optionPriceRows(p);
  return rows.length ? Math.max(...rows.map((row) => row.price)) : p.price;
}

function searchDoc(p: Product) {
  return {
    name: `${p.name} ${p.name_sw ?? ""}`,
    category: `${p.categories?.name ?? ""} ${p.categories?.name_sw ?? ""}`,
    description: `${p.short_description ?? ""} ${p.sku ?? ""}`,
  };
}

function bandLabel(band: BudgetBand, under: string, over: string, between: string) {
  if (band.id === "under-100000") return fill(under, { amount: formatPrice(100_000) ?? "" });
  if (band.id === "over-700000") return fill(over, { amount: formatPrice(700_000) ?? "" });
  if (band.id === "100000-300000") {
    return fill(between, { min: formatPrice(100_000) ?? "", max: formatPrice(300_000) ?? "" });
  }
  return fill(between, { min: formatPrice(300_000) ?? "", max: formatPrice(700_000) ?? "" });
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
  seed: seedFromLoader,
}: {
  products: Product[];
  categories: Category[];
  search: ShopSearch;
  onSearch: (next: ShopSearch) => void;
  /** Category pages show only this category; the sidebar links to other categories. */
  lockedCategoryId?: string;
  onCategory?: (slug: string) => void;
  heading?: string;
  /** Seed from the route loader. The shop keeps the first one for this page load. */
  seed: number;
}) {
  const { t, lang } = useLang();
  const [sheetOpen, setSheetOpen] = useState(false);
  const seed = stableShopSeed(seedFromLoader);
  const maxAll = Math.max(0, ...products.filter((p) => !asksForPrice(p)).map(productMaxPrice));
  const max = search.max != null ? Math.min(search.max, maxAll) : maxAll;
  const sort: ShopSort | "mixed" = search.sort ?? "mixed";
  const catalogue = useMemo(
    () => (sort === "mixed" ? orderBySeed(products, seed) : products),
    [products, seed, sort],
  );
  const q = (search.q ?? "").trim();
  const selectedCat = lockedCategoryId
    ? (categories.find((c) => c.id === lockedCategoryId)?.slug ?? "")
    : (search.cat ?? "");
  const catId = categories.find((c) => c.slug === selectedCat)?.id;

  const base = useMemo(() => {
    if (!q) return catalogue;
    if (sort === "mixed") return rankSearch(catalogue, q, searchDoc);
    return catalogue.filter((product) => searchTier(q, searchDoc(product)) != null);
  }, [catalogue, q, sort]);

  const list = useMemo(() => {
    const r = base.filter(
      (p) =>
        (!catId || p.category_id === catId) &&
        (asksForPrice(p) || ((search.min == null || lowestOptionPrice(p) >= search.min) && lowestOptionPrice(p) <= max)) &&
        (!search.avail || (isPurchasable(p) && p.stock_quantity > 0)),
    );
    if (sort === "new") r.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === "popular") r.sort((a, b) => popularity(b) - popularity(a) || b.created_at.localeCompare(a.created_at));
    if (sort === "low") r.sort((a, b) => (asksForPrice(a) ? Number.POSITIVE_INFINITY : lowestOptionPrice(a)) - (asksForPrice(b) ? Number.POSITIVE_INFINITY : lowestOptionPrice(b)));
    if (sort === "high") r.sort((a, b) => (asksForPrice(b) ? Number.NEGATIVE_INFINITY : highestOptionPrice(b)) - (asksForPrice(a) ? Number.NEGATIVE_INFINITY : highestOptionPrice(a)));
    if (sort === "name") r.sort((a, b) => a.name.localeCompare(b.name));
    return r;
  }, [base, catId, max, search.avail, search.min, sort]);

  const inCategory = base.filter((p) => !catId || p.category_id === catId);
  const inStockCount = inCategory.filter((p) => isPurchasable(p) && p.stock_quantity > 0).length;

  const set = (patch: Partial<ShopSearch>) => onSearch({ ...search, ...patch });
  const bands = useMemo(
    () => bandsForPrices(products.filter((product) => !asksForPrice(product)).map((product) => lowestOptionPrice(product))),
    [products],
  );
  const activeBand = bandForLimits(bands, search.min, search.max)?.id ?? "";

  useEffect(() => {
    const term = q.trim();
    if (!term || list.length > 0) return;
    trackEvent("search_no_results", { search_term: term });
  }, [q, list.length]);

  function chooseBand(band: BudgetBand) {
    const on = activeBand === band.id;
    trackEvent("filter_budget_chip", { chip: band.id });
    set({
      min: on ? undefined : (band.min ?? undefined),
      max: on ? undefined : (band.max ?? undefined),
    });
  }
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
          onChange={(value) => set({ min: undefined, max: value >= maxAll ? undefined : value })}
        />
      }
      availabilityLabel={t.shop.availability}
      inStockLabel={t.shop.inStock}
      inStockCount={inStockCount}
      inStockOnly={Boolean(search.avail)}
      onInStockOnly={(value) => set({ avail: value || undefined })}
    />
  );

  const sortOptions: { value: ShopSort | "mixed"; label: string }[] = [
    { value: "mixed", label: t.shop.sortDiscover },
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
              className="btn-base btn-outline-navy min-h-11 lg:hidden"
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
                    sort: e.target.value === "mixed" ? undefined : (e.target.value as ShopSort),
                  })
                }
                className="field-input !min-h-11 !w-auto !py-1.5 !pr-8 text-sm font-medium"
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
        {bands.length > 0 && (
          <BudgetChips bands={bands} active={activeBand} onChoose={chooseBand} />
        )}
        {list.length === 0 ? (
          <EmptyState
            title={t.shop.noMatch}
            action={
              <div className="flex w-full max-w-sm flex-col gap-2">
                <button type="button" className="btn-base btn-outline-navy min-h-11 w-full" onClick={clear}>
                  {t.shop.clearFilters}
                </button>
                <WhatsAppOrderLink
                  source="search"
                  text={fill(t.shop.whatsappSearch, { q: search.q?.trim() || t.shop.title })}
                  className="btn-base btn-outline-navy min-h-11 w-full"
                >
                  {t.shop.askWhatsApp}
                </WhatsAppOrderLink>
                <Link to="/custom-order" className="btn-base btn-gold min-h-11 w-full">
                  {t.shop.requestCustom}
                </Link>
              </div>
            }
          />
        ) : (
          <ProductGrid products={list} eagerFirst className="xl:grid-cols-3 2xl:grid-cols-4" />
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="flex w-[88vw] max-w-sm flex-col gap-0 overflow-y-auto bg-sand p-4"
        >
          <SheetTitle className="sr-only">{t.shop.filters}</SheetTitle>
          <SheetDescription className="sr-only">{t.shop.title}</SheetDescription>
          {bands.length > 0 && (
            <div className="mt-6">
              <BudgetChips bands={bands} active={activeBand} onChoose={chooseBand} />
            </div>
          )}
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

function BudgetChips({
  bands,
  active,
  onChoose,
}: {
  bands: BudgetBand[];
  active: string;
  onChoose: (band: BudgetBand) => void;
}) {
  const { t } = useLang();
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t.shop.priceRange}>
      {bands.map((band) => {
        const on = band.id === active;
        return (
          <button
            key={band.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChoose(band)}
            className={
              on
                ? "btn-base min-h-11 border-2 border-gold bg-white px-3 text-sm font-semibold text-navy"
                : "btn-base min-h-11 border border-[#E5E5E5] bg-white px-3 text-sm font-semibold text-navy"
            }
          >
            {bandLabel(band, t.shop.budgetUnder, t.shop.budgetOver, t.shop.budgetBetween)}
          </button>
        );
      })}
    </div>
  );
}
