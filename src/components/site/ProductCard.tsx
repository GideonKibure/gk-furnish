import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MapPin, Pause, Play, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { DiscountBadge } from "@/components/brand/DiscountBadge";
import { EmptyState } from "@/components/brand/EmptyState";
import { StarRating } from "@/components/brand/StarRating";
import { StockLabel } from "@/components/brand/StockLabel";
import { formatPrice, formatPriceSpan } from "@/config/site";
import { fill } from "@/i18n/fill";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { ratingSummaryQuery, type Product, type RatingSummary } from "@/lib/catalog";
import { lowestOptionPrice, optionPriceRows, parseOptionList } from "@/lib/order-options";
import { compareAtPrice, discountPercent, isPurchasable } from "@/lib/product-display";
import { productGalleryItems, productVideoSrc } from "@/lib/product-image";
import { cn } from "@/lib/utils";
import { missingChoices, OrderDialog, useAddToCart } from "./OrderDialog";
import { LikeButton } from "./ProductEngagement";
import { ProductVideo } from "./ProductVideo";

export function ProductCard({ product, rating, priority = false }: { product: Product; rating?: RatingSummary | undefined; priority?: boolean }) {
  const { t, lang } = useLang();
  const addToCart = useAddToCart();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const name = localized(lang, product.name, product.name_sw);
  const rows = optionPriceRows(product);
  const fromPrice = lowestOptionPrice(product);
  const priceLabel = formatPriceSpan(rows.map((row) => row.price)) ?? formatPrice(product.price);
  const oldPrice = rows.length ? null : compareAtPrice(product, product.price);
  const percent = discountPercent(product, rows.length ? fromPrice : product.price);
  const cat = product.categories ? localized(lang, product.categories.name, product.categories.name_sw) : "";
  const images = productGalleryItems(product);
  const cover = images[0]?.src;
  const hover = images[1]?.src;
  const videoSrc = productVideoSrc(product);
  const canBuy = isPurchasable(product);

  function onAdd() {
    const materials = parseOptionList(product.material);
    const dimensions = parseOptionList(product.dimensions);
    const choice = {
      material: materials.length === 1 ? (materials[0] ?? "") : "",
      size: dimensions.length === 1 ? (dimensions[0] ?? "") : "",
      color: "",
    };
    if (missingChoices(product, choice).length) setOpen(true);
    else void addToCart(product, { ...choice, quantity: 1 });
  }

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-square overflow-hidden bg-sand">
        <Link to="/products/$slug" params={{ slug: product.slug }} className="absolute inset-0 block" aria-label={name}>
          {playing && videoSrc ? (
            <ProductVideo src={videoSrc} poster={cover} className="absolute inset-0" />
          ) : (
            <>
              <img
                src={cover}
                alt={name}
                width={640}
                height={640}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={priority ? "high" : "low"}
                className={cn(
                  "h-full w-full object-cover transition-[transform,opacity] duration-500",
                  hover ? "group-hover:opacity-0" : "group-hover:scale-105",
                )}
              />
              {hover && (
                <img
                  src={hover}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              )}
            </>
          )}
        </Link>
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          <DiscountBadge percent={percent} />
        </div>
        <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5">
          <LikeButton product={product} />
          {videoSrc && (
            <button
              type="button"
              onClick={() => setPlaying((v) => !v)}
              aria-label={t.pdp.video}
              aria-pressed={playing}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-navy shadow-sm transition-colors hover:bg-white"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {cat && <p className="truncate text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>}
        <h3 className="mt-0.5 line-clamp-2 text-[0.95rem] font-semibold leading-snug text-navy">
          <Link to="/products/$slug" params={{ slug: product.slug }} className="hover:text-gold-ink">
            {name}
          </Link>
        </h3>
        {product.available_region && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-navy">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {fill(t.pdp.availableIn, { region: product.available_region })}
          </p>
        )}
        {rating && rating.rating_count > 0 && (
          <StarRating value={rating.rating_avg} count={rating.rating_count} className="mt-1" />
        )}
        <div className="mt-auto pt-2">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="price-text text-[1.05rem]">{priceLabel ?? t.common.priceOnRequest}</span>
            {oldPrice && <span className="text-xs text-muted-foreground line-through">{formatPrice(oldPrice)}</span>}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <StockLabel product={product} className="min-w-0 !text-xs [&_svg]:!h-3.5 [&_svg]:!w-3.5" />
            <button
              type="button"
              onClick={onAdd}
              disabled={!canBuy}
              aria-label={`${t.cart.add}: ${name}`}
              title={t.cart.add}
              className="btn-base btn-gold btn-sm !min-h-9 shrink-0 !px-3"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="max-sm:hidden">{t.cart.add}</span>
            </button>
          </div>
        </div>
      </div>
      {open && <OrderDialog product={product} open={open} onOpenChange={setOpen} />}
    </article>
  );
}

export function ProductGrid({ products, className, eagerFirst = false }: { products: Product[]; className?: string; eagerFirst?: boolean }) {
  const { t } = useLang();
  const { data: ratings = {} } = useQuery(ratingSummaryQuery);
  if (!products.length) return <EmptyState title={t.shop.noResults} body={t.common.emptyProducts} />;
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, index) => (
        <ProductCard key={p.id} product={p} rating={ratings[p.id]} priority={eagerFirst && index < 2} />
      ))}
    </div>
  );
}
