import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Factory, Handshake, MapPin, MessageCircle, Ruler, ShoppingCart, Truck, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/brand/Breadcrumbs";
import { DiscountBadge } from "@/components/brand/DiscountBadge";
import { QtyStepper } from "@/components/brand/QtyStepper";
import { ShareButtons } from "@/components/brand/ShareButtons";
import { StarRating } from "@/components/brand/StarRating";
import { StockLabel } from "@/components/brand/StockLabel";
import { missingChoices, OrderDialog, useAddToCart } from "@/components/site/OrderDialog";
import { ProductEngagement } from "@/components/site/ProductEngagement";
import { ConditionBadge, ProductGrid } from "@/components/site/ProductCard";
import { ProductReviews } from "@/components/site/ProductReviews";
import { ColorImageChoices, TextChoices } from "@/components/site/SelectChoices";
import { ZoomGallery } from "@/components/site/ZoomGallery";
import { formatPrice, formatPriceSpan, SITE, waLink } from "@/config/site";
import { fill } from "@/i18n/fill";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { productsQuery, ratingSummaryQuery } from "@/lib/catalog";
import { absoluteUrl, breadcrumbLd, productSeoCopy, seo } from "@/lib/seo";
import { highestOptionPrice, lowestOptionPrice, optionPriceRows, optionLabel, parseCatalogColor, parseOptionList, publicFeatures, selectedOptionPrice } from "@/lib/order-options";
import { freeDeliveryPlaces, joinPlaces } from "@/lib/delivery";
import { asksForPrice, compareAtPrice, discountPercent, isPurchasable } from "@/lib/product-display";
import { productGalleryItems, productVideoSrc } from "@/lib/product-image";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ context, params }) => {
    const all = await context.queryClient.ensureQueryData(productsQuery);
    const p = all.find((x) => x.slug === params.slug);
    if (!p) throw notFound();
    const ratings = await context.queryClient.ensureQueryData(ratingSummaryQuery);
    const rating = ratings[p.id];
    const unpriced = asksForPrice(p);
    const low = unpriced ? 0 : lowestOptionPrice(p);
    const high = unpriced ? 0 : highestOptionPrice(p);
    const image = productGalleryItems(p)[0]?.src ?? null;
    return {
      name: p.name,
      desc: p.short_description ?? p.description,
      slug: p.slug,
      image,
      price: low,
      quote: unpriced,
      highPrice: high,
      sku: p.sku ?? null,
      inStock: isPurchasable(p),
      category: p.categories?.name ?? null,
      categorySlug: p.categories?.slug ?? null,
      ratingValue: rating && rating.rating_count > 0 ? rating.rating_avg : null,
      ratingCount: rating && rating.rating_count > 0 ? rating.rating_count : null,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex, nofollow" }] };
    const path = `/products/${loaderData.slug}`;
    const description = productSeoCopy({
      name: loaderData.name,
      category: loaderData.category,
      description: loaderData.desc,
      price: loaderData.price,
    });
    const base = seo({
      title: loaderData.category
        ? `${loaderData.name} — ${loaderData.category} | GK Furnish`
        : `${loaderData.name} | GK Furnish, Mbeya`,
      description,
      path,
      image: loaderData.image,
      type: "product",
    });
    const availability = loaderData.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
    const offerUrl = absoluteUrl(path);
    const offers =
      !loaderData.quote && loaderData.price > 0
        ? loaderData.highPrice > loaderData.price
          ? {
              "@type": "AggregateOffer",
              url: offerUrl,
              priceCurrency: "TZS",
              lowPrice: Math.round(loaderData.price),
              highPrice: Math.round(loaderData.highPrice),
              availability,
            }
          : {
              "@type": "Offer",
              url: offerUrl,
              priceCurrency: "TZS",
              price: Math.round(loaderData.price),
              availability,
              seller: { "@type": "Organization", name: SITE.name },
            }
        : null;
    const crumbs = [
      { name: "Home", path: "/" },
      { name: "Shop", path: "/products" },
      ...(loaderData.category && loaderData.categorySlug
        ? [{ name: loaderData.category, path: `/categories/${loaderData.categorySlug}` }]
        : []),
      { name: loaderData.name, path },
    ];
    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Product",
          name: loaderData.name,
          description,
          ...(loaderData.image ? { image: [absoluteUrl(loaderData.image)] } : {}),
          ...(loaderData.sku ? { sku: loaderData.sku } : {}),
          ...(loaderData.category ? { category: loaderData.category } : {}),
          brand: { "@type": "Brand", name: "GK Furnish" },
          ...(loaderData.ratingValue != null && loaderData.ratingCount != null
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: loaderData.ratingValue,
                  reviewCount: loaderData.ratingCount,
                },
              }
            : {}),
          ...(offers ? { offers } : {}),
        },
        breadcrumbLd(crumbs),
      ],
    };
    return { ...base, scripts: [{ type: "application/ld+json", children: JSON.stringify(graph) }] };
  },
  component: Detail,
});

type Tab = "description" | "specs" | "care" | "reviews";

function freeDeliveryText(
  product: Parameters<typeof freeDeliveryPlaces>[0],
  lang: string,
  copy: { freeDelivery: string; freeDeliveryIn: string; freeDeliveryCountry: string; deliveryNote: string },
) {
  const places = freeDeliveryPlaces(product);
  if (places.country) return copy.freeDeliveryCountry;
  if (places.regions.length) return fill(copy.freeDeliveryIn, { region: joinPlaces(places.regions, lang === "sw" ? "na" : "and") });
  return product.free_delivery ? copy.freeDelivery : copy.deliveryNote;
}

function Detail() {
  const { slug } = Route.useParams();
  const { t, lang } = useLang();
  const { data } = useSuspenseQuery(productsQuery);
  const { data: ratings = {} } = useQuery(ratingSummaryQuery);
  const p = data.find((x) => x.slug === slug);
  const [qty, setQty] = useState(1);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [material, setMaterial] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("description");
  const [shareUrl, setShareUrl] = useState("");
  const addToCart = useAddToCart();

  useEffect(() => {
    setShareUrl(window.location.href);
  }, [slug]);

  if (!p) return null;

  const name = localized(lang, p.name, p.name_sw);
  const description = localized(lang, p.description, p.description_sw);
  const materials = parseOptionList(p.material);
  const dimensions = parseOptionList(p.dimensions);
  const features = publicFeatures(p.features);
  const chosenPrice = selectedOptionPrice(p, material, size);
  const choiceRows = optionPriceRows(p);
  const pricesVary = new Set(choiceRows.map((row) => row.price)).size > 1;
  const shownPrice = chosenPrice ?? (choiceRows.length ? lowestOptionPrice(p) : p.price);
  const price = chosenPrice != null
    ? formatPrice(chosenPrice)
    : formatPriceSpan(choiceRows.map((row) => row.price)) ?? formatPrice(p.price);
  const oldPrice = choiceRows.length && chosenPrice == null ? null : compareAtPrice(p, shownPrice);
  const percent = discountPercent(p, shownPrice);
  const priceHint = materials.length && dimensions.length
    ? t.products.priceHintBoth
    : materials.length
      ? t.products.priceHintMaterial
      : dimensions.length
        ? t.products.priceHintSize
        : "";
  const gallery = productGalleryItems(p).map((item) => ({ src: item.src }));
  const videoSrc = productVideoSrc(p);
  const colors = p.available_colors.map(parseCatalogColor);
  const selectedMaterial = materials.includes(material) ? material : "";
  const selectedSize = dimensions.includes(size) ? size : "";
  const selectedColor = colors.some((item) => item.stored === color) ? color : "";
  const unpriced = asksForPrice(p);
  const msg = `${t.whatsapp.productPrefix} ${p.name}${!unpriced && price ? ` ${t.whatsapp.pricedAt} ${price}` : ""}.`;
  const related = data.filter((x) => x.category_id === p.category_id && x.id !== p.id).slice(0, 4);
  const rating = ratings[p.id];
  const canBuy = isPurchasable(p);
  const finish = localized(lang, p.finish ?? "", p.finish_sw);
  const care = localized(lang, p.care_info ?? "", p.care_info_sw) || t.pdp.careDefault;
  const catName = p.categories ? localized(lang, p.categories.name, p.categories.name_sw) : "";

  async function onAdd(buyNow: boolean) {
    if (!p) return;
    const choice = {
      material: selectedMaterial,
      size: selectedSize,
      color: colors.find((item) => item.stored === selectedColor)?.label ?? "",
    };
    if (missingChoices(p, choice).length) {
      setOpen(true);
      return;
    }
    await addToCart(p, { ...choice, quantity: qty }, buyNow);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "description", label: t.pdp.tabDescription },
    { id: "specs", label: t.pdp.tabSpecs },
    { id: "care", label: t.pdp.tabCare },
    { id: "reviews", label: `${t.pdp.tabReviews}${rating?.rating_count ? ` (${rating.rating_count})` : ""}` },
  ];

  return (
    <div className="pb-10 md:pb-16">
      <div className="container-page pt-4 md:pt-6">
        <Breadcrumbs
          items={[
            { label: t.nav.home, href: "/" },
            { label: t.shell.shop, href: "/products" },
            ...(p.categories ? [{ label: catName, href: `/categories/${p.categories.slug}` }] : []),
            { label: name },
          ]}
        />

        <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
          <ZoomGallery images={gallery} alt={name} hint={t.detail.zoomHint} video={videoSrc} videoLabel={t.pdp.video} />

          <div className="flex min-w-0 flex-col">
            {catName && <p className="eyebrow">{catName}</p>}
            <h1 className="display-lg mt-1">{name}</h1>
            {rating && rating.rating_count > 0 && (
              <button type="button" onClick={() => setTab("reviews")} className="mt-2 w-fit">
                <StarRating value={rating.rating_avg} count={rating.rating_count} />
              </button>
            )}

            {unpriced ? (
              <p className="mt-4 text-sm leading-relaxed text-navy/80">{t.pdp.askPriceNote}</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="price-text text-2xl md:text-[1.75rem]">{price ?? t.common.priceOnRequest}</span>
                  {oldPrice && <span className="text-base text-muted-foreground line-through">{formatPrice(oldPrice)}</span>}
                  <DiscountBadge percent={percent} />
                  <ConditionBadge condition={p.item_condition} />
                </div>
                {chosenPrice == null && pricesVary && priceHint && <p className="mt-1 text-xs text-muted-foreground">{priceHint}</p>}
              </>
            )}
            {unpriced && (
              <div className="mt-3">
                <ConditionBadge condition={p.item_condition} />
              </div>
            )}

            {p.short_description && lang === "en" && (
              <p className="mt-3 text-[0.95rem] leading-relaxed text-navy/80">{p.short_description}</p>
            )}

            {p.available_region && (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-navy">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {fill(t.pdp.availableIn, { region: p.available_region })}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <StockLabel product={p} />
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                {p.source_type === "partner" ? <Handshake className="h-4 w-4" /> : <Factory className="h-4 w-4" />}
                {p.source_type === "partner" ? t.pdp.partner : t.pdp.inHouse}
              </span>
            </div>

            {features.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {features.slice(0, 6).map((f, i) => (
                  <li key={`${f}-${i}`} className="flex items-start gap-2 text-sm text-navy">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            )}

            {materials.length > 0 && (
              <div className="mt-5">
                <p className="field-label">{t.detail.material}</p>
                <TextChoices
                  name="material"
                  value={selectedMaterial}
                  onChange={setMaterial}
                  options={materials.map((value) => ({ value, label: optionLabel(value, p.material, lang) }))}
                />
              </div>
            )}

            {dimensions.length > 0 && (
              <div className="mt-4">
                <p className="field-label">{t.detail.dimensions}</p>
                <TextChoices
                  name="dimensions"
                  value={selectedSize}
                  onChange={setSize}
                  options={dimensions.map((value) => ({ value, label: optionLabel(value, p.dimensions, lang) }))}
                />
              </div>
            )}

            {colors.length > 0 && (
              <div className="mt-4">
                <p className="field-label">{t.detail.colors}</p>
                <ColorImageChoices name="color" value={selectedColor} onChange={setColor} options={colors} />
              </div>
            )}

            {unpriced ? (
              <Link to="/custom-order" search={{ product: p.slug }} className="btn-base btn-gold btn-lg mt-5 w-full">
                {t.cart.askPrice}
              </Link>
            ) : (
              <>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <QtyStepper value={qty} onChange={setQty} label={t.detail.quantity} />
                  <button type="button" className="btn-base btn-gold btn-lg min-w-[9.5rem] flex-1" disabled={!canBuy} onClick={() => void onAdd(false)}>
                    <ShoppingCart className="h-4 w-4" />
                    {t.cart.add}
                  </button>
                </div>
                <button type="button" className="btn-base btn-navy btn-lg mt-3 w-full" disabled={!canBuy} onClick={() => void onAdd(true)}>
                  {t.cart.buyNow}
                </button>
              </>
            )}
            <a href={waLink(msg)} target="_blank" rel="noreferrer" className="btn-base btn-ghost mt-2 w-full">
              <MessageCircle className="h-4 w-4" />
              {t.detail.askWhatsapp}
            </a>

            <div className="mt-4 space-y-2 rounded-xl bg-sand p-3.5 text-sm text-navy/80">
              <p className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
                {freeDeliveryText(p, lang, t.pdp)}
              </p>
              {p.is_customisable && (
                <p className="flex items-start gap-2">
                  <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-navy" />
                  {t.pdp.customisable}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              {shareUrl && (
                <ShareButtons url={shareUrl} title={name} label={t.pdp.share} copyLabel={t.pdp.copyLink} copiedLabel={t.pdp.linkCopied} />
              )}
              <ProductEngagement product={p} trackView />
            </div>
          </div>
        </div>

        <section className="mt-10">
          <div role="tablist" aria-label={name} className="flex gap-1 overflow-x-auto border-b border-border no-scrollbar">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`panel-${item.id}`}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative shrink-0 whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors",
                  tab === item.id ? "text-navy" : "text-muted-foreground hover:text-navy",
                )}
              >
                {item.label}
                {tab === item.id && <span aria-hidden className="absolute inset-x-3 -bottom-px h-[3px] rounded-t-full bg-gold" />}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="max-w-3xl py-5">
            {tab === "description" && (
              <div className="space-y-4">
                <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-navy/85">{description}</p>
                {features.length > 6 && (
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {features.slice(6).map((f, i) => (
                      <li key={`${f}-${i}`} className="flex items-start gap-2 text-sm text-navy">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {tab === "specs" && (
              <dl className="divide-y divide-border rounded-xl border border-border text-sm">
                {[
                  { label: t.detail.dimensions, value: dimensions.map((d) => optionLabel(d, p.dimensions, lang)).join(", ") },
                  { label: t.detail.material, value: materials.map((m) => optionLabel(m, p.material, lang)).join(", ") },
                  { label: t.pdp.finish, value: finish },
                  { label: t.detail.colors, value: colors.map((c) => c.label).join(", ") },
                  { label: t.pdp.sku, value: p.sku ?? "" },
                ]
                  .filter((row) => row.value)
                  .map((row) => (
                    <div key={row.label} className="grid grid-cols-[9rem_1fr] gap-3 px-4 py-3 sm:grid-cols-[12rem_1fr]">
                      <dt className="flex items-center gap-1.5 font-medium text-muted-foreground">
                        {row.label === t.detail.dimensions && <Ruler className="h-3.5 w-3.5" />}
                        {row.label}
                      </dt>
                      <dd className="text-navy">{row.value}</dd>
                    </div>
                  ))}
              </dl>
            )}
            {tab === "care" && <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-navy/85">{care}</p>}
            {tab === "reviews" && <ProductReviews productId={p.id} />}
          </div>
        </section>
      </div>

      {open && (
        <OrderDialog
          product={p}
          open={open}
          onOpenChange={setOpen}
          initialQty={qty}
          initialColor={selectedColor}
          initialSize={selectedSize}
          initialMaterial={selectedMaterial}
        />
      )}

      {related.length > 0 && (
        <section className="border-t border-border bg-sand">
          <div className="container-page section-y">
            <h2 className="section-title mb-5">{t.detail.related}</h2>
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </div>
  );
}
