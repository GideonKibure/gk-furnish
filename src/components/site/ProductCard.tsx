import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useState } from "react";
import { formatPrice, formatPriceSpan } from "@/config/site";
import { localized, useLang } from "@/i18n/LanguageProvider";
import type { Product } from "@/lib/catalog";
import { optionLabel, optionPriceRows, parseOptionList, selectedOptionPrice } from "@/lib/order-options";
import { productGalleryItems, productVideoSrc } from "@/lib/product-image";
import { cn } from "@/lib/utils";
import { OrderDialog } from "./OrderDialog";
import { ProductVideo } from "./ProductVideo";
import { ProductEngagement } from "./ProductEngagement";
import { Reveal } from "./Reveal";
import { TextChoices } from "./SelectChoices";

function PhotoThumb({
  src,
  label,
  selected,
  onClick,
}: {
  src: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl border-2 transition-all",
        selected ? "border-gold shadow-[0_0_0_2px_color-mix(in_oklab,var(--gold)_35%,transparent)]" : "border-white/25 hover:border-white/70",
      )}
    >
      <img src={src} alt="" className="h-full w-full object-cover" />
    </button>
  );
}

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
  const videoSrc = productVideoSrc(product);
  const [showVideo, setShowVideo] = useState(Boolean(videoSrc));
  const active = angles[Math.min(view, Math.max(0, angles.length - 1))] ?? angles[0];
  const angleLabels = ["Photo 1", "Photo 2"];
  const playingVideo = Boolean(videoSrc && showVideo);

  const summary = product.short_description ?? product.description ?? "";

  return (
    <Reveal variant="scale" className="h-full">
      <article className="card-surface card-hover group flex h-full flex-col overflow-hidden">
        <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
          <Link
            to="/products/$slug"
            params={{ slug: product.slug }}
            className="absolute inset-0 block"
          >
            {playingVideo && videoSrc ? (
              <ProductVideo src={videoSrc} className="absolute inset-0" />
            ) : (
              <img
                src={active?.src}
                alt={name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/35 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          </Link>
          <span
            className={`pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${product.is_available ? "glass text-navy" : "glass-dark text-primary-foreground"}`}
          >
            {product.is_available ? t.common.available : t.common.madeToOrder}
          </span>
          {angles.length > 1 && (
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-navy/80 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white backdrop-blur">
              {angles.length} {t.detail.viewsCount}
            </span>
          )}
          {(angles.length > 1 || videoSrc) && (
            <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-navy/75 via-navy/25 to-transparent px-3 pb-3 pt-10">
              <div className="flex items-center gap-2 rounded-2xl bg-navy/45 p-1.5 shadow-[0_10px_28px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/20 backdrop-blur-md">
                {angles.slice(0, Math.ceil(angles.length / 2)).map((angle, idx) => (
                  <PhotoThumb
                    key={`${angle.src}-${idx}`}
                    src={angle.src}
                    label={angleLabels[angle.slot] ?? angle.label}
                    selected={!playingVideo && view === idx}
                    onClick={() => {
                      setShowVideo(false);
                      setView(idx);
                    }}
                  />
                ))}
                {videoSrc && (
                  <button
                    type="button"
                    onClick={() => setShowVideo(true)}
                    aria-label="Video"
                    aria-pressed={playingVideo}
                    className={cn(
                      "relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-xl border backdrop-blur-[1px] transition-all",
                      playingVideo
                        ? "border-white/55 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                        : "border-white/40 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] hover:border-white/70",
                    )}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,rgba(255,255,255,0.14),transparent_58%)]" />
                    <span
                      className={cn(
                        "relative mb-3 grid h-8 w-8 place-items-center rounded-full border border-white/45 text-navy shadow-sm backdrop-blur-[1px]",
                        playingVideo ? "bg-white/35" : "bg-white/40",
                      )}
                    >
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                    </span>
                    <span
                      className={cn(
                        "absolute inset-x-0 bottom-0 border-t border-white/25 bg-black/15 py-1 text-center text-[0.58rem] font-bold uppercase leading-none tracking-[0.14em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]",
                      )}
                    >
                      Video
                    </span>
                  </button>
                )}
                {angles.slice(Math.ceil(angles.length / 2)).map((angle, offset) => {
                  const idx = Math.ceil(angles.length / 2) + offset;
                  return (
                    <PhotoThumb
                      key={`${angle.src}-${idx}`}
                      src={angle.src}
                      label={angleLabels[angle.slot] ?? angle.label}
                      selected={!playingVideo && view === idx}
                      onClick={() => {
                        setShowVideo(false);
                        setView(idx);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <p className="h-4 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat || "\u00a0"}</p>
          <h3 className="mt-1 line-clamp-2 h-[2.75em] text-lg leading-snug text-navy transition-colors duration-300 group-hover:text-[color-mix(in_oklab,var(--navy)_80%,var(--gold))]">
            {name}
          </h3>
          <p className="mt-2 line-clamp-2 h-10 text-sm leading-5 text-muted-foreground">
            {summary || "\u00a0"}
          </p>
          <div className="mt-3 space-y-1.5">
            <div>
              <p className="mb-1 h-4 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{t.detail.material}</p>
              {materials.length > 0 ? (
                <div className="h-8">
                  <TextChoices
                    compact
                    scroll
                    name={`card-material-${product.id}`}
                    value={materials.includes(material) ? material : ""}
                    onChange={setMaterial}
                    options={materials.map((value) => ({ value, label: optionLabel(value, product.material, lang) }))}
                  />
                </div>
              ) : (
                <p className="flex h-8 items-center text-xs text-muted-foreground">—</p>
              )}
            </div>
            <div>
              <p className="mb-1 h-4 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{t.detail.dimensions}</p>
              {dimensions.length > 0 ? (
                <div className="h-8">
                  <TextChoices
                    compact
                    scroll
                    name={`card-size-${product.id}`}
                    value={dimensions.includes(dimension) ? dimension : ""}
                    onChange={setDimension}
                    options={dimensions.map((value) => ({ value, label: optionLabel(value, product.dimensions, lang) }))}
                  />
                </div>
              ) : (
                <p className="flex h-8 items-center text-xs text-muted-foreground">—</p>
              )}
            </div>
          </div>
          <div className="mt-3 flex h-16 flex-col justify-center rounded-xl border border-gold/30 bg-gold-soft/70 px-3">
            <p className="truncate font-sans text-lg font-bold tabular-nums leading-tight text-navy">
              {price ?? t.common.priceOnRequest}
            </p>
            <p className="mt-0.5 h-4 truncate text-[0.7rem] leading-4 text-muted-foreground">
              {chosen == null && pricesVary && priceHint ? priceHint : "\u00a0"}
            </p>
          </div>
          <div className="mt-auto pt-3">
            <ProductEngagement product={product} compact />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to="/products/$slug"
              params={{ slug: product.slug }}
              className="btn-base btn-outline-navy !h-11 !min-h-0 !px-2 !text-xs whitespace-nowrap sm:!text-sm"
            >
              {t.common.viewProduct}
            </Link>
            <button
              onClick={() => setOpen(true)}
              className="btn-base btn-gold !h-11 !min-h-0 !px-2 !text-xs whitespace-nowrap transition-transform hover:scale-[1.03] active:scale-[0.97] sm:!text-sm"
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
    <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
