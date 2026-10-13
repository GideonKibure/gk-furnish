import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatPrice, formatPriceSpan } from "@/config/site";
import { localized, useLang } from "@/i18n/LanguageProvider";
import type { Product } from "@/lib/catalog";
import { optionPriceRows, parseOptionList, selectedOptionPrice } from "@/lib/order-options";
import { productGalleryItems } from "@/lib/product-image";
import { cn } from "@/lib/utils";
import { OrderDialog } from "./OrderDialog";
import { ProductEngagement } from "./ProductEngagement";
import { Reveal } from "./Reveal";
import { TextChoices } from "./SelectChoices";

export function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(0);
  const [material, setMaterial] = useState("");
  const [dimension, setDimension] = useState("");
  const name = localized(lang, product.name, product.name_sw);
  const materials = parseOptionList(product.material);
  const dimensions = parseOptionList(product.dimensions);
  const chosen = selectedOptionPrice(product, material, dimension);
  const choiceRows = optionPriceRows(product);
  const pricesVary = new Set(choiceRows.map((row) => row.price)).size > 1;
  const price = chosen != null ? formatPrice(chosen) : formatPriceSpan(choiceRows.map((row) => row.price)) ?? formatPrice(product.price);
  const priceHint = materials.length && dimensions.length
    ? t.products.priceHintBoth
    : materials.length
      ? t.products.priceHintMaterial
      : dimensions.length
        ? t.products.priceHintSize
        : "";
  const cat = product.categories ? localized(lang, product.categories.name, product.categories.name_sw) : "";
  const angles = productGalleryItems(product);
  const active = angles[Math.min(view, Math.max(0, angles.length - 1))] ?? angles[0];
  const angleLabels = ["Photo 1", "Photo 2"];

  return (
    <Reveal variant="scale">
      <article className="card-surface card-hover group flex flex-col overflow-hidden">
        <Link
          to="/products/$slug"
          params={{ slug: product.slug }}
          className="relative block aspect-[4/3] overflow-hidden bg-muted"
        >
          <img
            src={active?.src}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/35 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <span
            className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${product.is_available ? "glass text-navy" : "glass-dark text-primary-foreground"}`}
          >
            {product.is_available ? t.common.available : t.common.madeToOrder}
          </span>
          {angles.length > 1 && (
            <span className="absolute right-3 top-3 rounded-full bg-navy/80 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white backdrop-blur">
              {angles.length} {t.detail.viewsCount}
            </span>
          )}
        </Link>

        {angles.length > 1 && (
          <div className="flex gap-1.5 border-b border-border/60 bg-secondary/30 px-3 py-2">
            {angles.map((angle, idx) => (
              <button
                key={`${angle.src}-${idx}`}
                type="button"
                onClick={() => setView(idx)}
                aria-label={angleLabels[angle.slot] ?? angle.label}
                aria-pressed={view === idx}
                className={cn(
                  "relative h-12 flex-1 overflow-hidden rounded-lg border-2 transition-all",
                  view === idx ? "border-gold shadow-sm" : "border-transparent opacity-75 hover:opacity-100",
                )}
              >
                <img src={angle.src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-1 flex-col p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
          <h3 className="mt-1 text-xl text-navy transition-colors duration-300 group-hover:text-[color-mix(in_oklab,var(--navy)_80%,var(--gold))]">
            {name}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {product.short_description ?? product.description}
          </p>
          {(materials.length > 0 || dimensions.length > 0) && (
            <div className="mt-3 space-y-2">
              {materials.length > 0 && (
                <div>
                  <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{t.detail.material}</p>
                  <TextChoices
                    compact
                    name={`card-material-${product.id}`}
                    value={materials.includes(material) ? material : ""}
                    onChange={setMaterial}
                    options={materials.map((value) => ({ value, label: value }))}
                  />
                </div>
              )}
              {dimensions.length > 0 && (
                <div>
                  <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{t.detail.dimensions}</p>
                  <TextChoices
                    compact
                    name={`card-size-${product.id}`}
                    value={dimensions.includes(dimension) ? dimension : ""}
                    onChange={setDimension}
                    options={dimensions.map((value) => ({ value, label: value }))}
                  />
                </div>
              )}
            </div>
          )}
          <div className="mt-3 rounded-xl border border-gold/30 bg-gold-soft/70 px-3 py-2">
            <p className="font-sans text-lg font-bold tabular-nums text-navy">
              {price ?? t.common.priceOnRequest}
            </p>
            {chosen == null && pricesVary && priceHint && (
              <p className="text-[0.7rem] leading-snug text-muted-foreground">{priceHint}</p>
            )}
          </div>
          <div className="flex-1" />
          <div className="mt-3">
            <ProductEngagement product={product} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link
              to="/products/$slug"
              params={{ slug: product.slug }}
              className="btn-base btn-outline-navy !px-3 !text-sm"
            >
              {t.common.viewProduct}
            </Link>
            <button
              onClick={() => setOpen(true)}
              className="btn-base btn-gold !px-3 !text-sm transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              {t.common.orderNow}
            </button>
          </div>
        </div>
        <OrderDialog
          product={product}
          open={open}
          onOpenChange={setOpen}
          initialMaterial={materials.includes(material) ? material : ""}
          initialSize={dimensions.includes(dimension) ? dimension : ""}
        />
      </article>
    </Reveal>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  const { t } = useLang();
  if (!products.length)
    return <p className="rounded-2xl bg-sand p-8 text-center text-muted-foreground">{t.common.emptyProducts}</p>;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
