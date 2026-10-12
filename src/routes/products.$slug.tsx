import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Check, MessageCircle, Ruler, Sparkles, Trees } from "lucide-react";
import { useState } from "react";
import { OrderDialog } from "@/components/site/OrderDialog";
import { ProductEngagement } from "@/components/site/ProductEngagement";
import { ProductGrid } from "@/components/site/ProductCard";
import { Reveal } from "@/components/site/Reveal";
import { ColorImageChoices, TextChoices } from "@/components/site/SelectChoices";
import { ZoomGallery } from "@/components/site/ZoomGallery";
import { formatPrice, waLink } from "@/config/site";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { productsQuery } from "@/lib/catalog";
import { parseCatalogColor, parseOptionList } from "@/lib/order-options";
import { productGalleryItems } from "@/lib/product-image";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ context, params }) => {
    const all = await context.queryClient.ensureQueryData(productsQuery);
    const p = all.find((x) => x.slug === params.slug);
    if (!p) throw notFound();
    return { name: p.name, desc: p.short_description ?? p.description };
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
  component: Detail,
});

function Detail() {
  const { slug } = Route.useParams();
  const { t, lang } = useLang();
  const { data } = useSuspenseQuery(productsQuery);
  const p = data.find((x) => x.slug === slug);
  const [qty, setQty] = useState(1);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [material, setMaterial] = useState("");
  const [open, setOpen] = useState(false);

  if (!p) return null;

  const name = localized(lang, p.name, p.name_sw);
  const price = formatPrice(p.price);
  const gallery = productGalleryItems(p).map((item) => ({ src: item.src }));
  const materials = parseOptionList(p.material);
  const dimensions = parseOptionList(p.dimensions);
  const colors = p.available_colors.map(parseCatalogColor);
  const selectedMaterial = materials.includes(material) ? material : "";
  const selectedSize = dimensions.includes(size) ? size : "";
  const selectedColor = colors.some((item) => item.stored === color) ? color : "";
  const msg = `${t.whatsapp.productPrefix} ${p.name}${price ? ` ${t.whatsapp.pricedAt} ${price}` : ""}.`;
  const related = data.filter((x) => x.category_id === p.category_id && x.id !== p.id).slice(0, 4);

  return (
    <div className="pb-16 md:pb-24">
      <div className="page-hero-glass relative overflow-hidden lg:-mt-[5rem]">
        <div aria-hidden className="page-hero-glass-orbs pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/35 to-transparent backdrop-blur-[2px]"
        />
      <div className="container-page relative pb-10 pt-6 md:pt-8 lg:pt-[calc(5rem+1.5rem)]">
        <Reveal>
          <nav className="mb-6 text-sm text-muted-foreground">
            <Link to="/products" className="transition-colors hover:text-navy">
              {t.nav.products}
            </Link>
            {p.categories && (
              <>
                <span className="mx-2 opacity-40">/</span>
                <Link
                  to="/categories/$slug"
                  params={{ slug: p.categories.slug }}
                  className="transition-colors hover:text-navy"
                >
                  {localized(lang, p.categories.name, p.categories.name_sw)}
                </Link>
              </>
            )}
            <span className="mx-2 opacity-40">/</span>
            <span className="text-navy">{name}</span>
          </nav>
        </Reveal>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal variant="left">
            <ZoomGallery
              images={gallery}
              alt={name}
              hint={t.detail.zoomHint}
              viewsTitle={t.detail.views}
              viewsHint={t.detail.viewsHint}
            />
          </Reveal>

          <Reveal variant="right" className="flex flex-col">
            <p className="eyebrow">
              {p.categories && localized(lang, p.categories.name, p.categories.name_sw)}
            </p>
            <h1 className="display-lg mt-2 text-navy">{name}</h1>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <p className="font-sans text-3xl font-bold tracking-tight text-navy">
                {price ?? t.common.priceOnRequest}
              </p>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  p.is_available ? "bg-gold-soft text-navy" : "bg-secondary text-muted-foreground",
                )}
              >
                {p.is_available ? t.common.available : t.common.madeToOrder}
              </span>
            </div>

            <div className="mt-4">
              <ProductEngagement product={p} trackView />
            </div>

            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              {localized(lang, p.description, p.description_sw)}
            </p>

            {materials.length > 0 && (
              <div className="mt-6">
                <p className="field-label flex items-center gap-1.5">
                  <Trees className="h-3.5 w-3.5 text-gold" />
                  {t.detail.material}
                </p>
                <TextChoices
                  name="material"
                  value={selectedMaterial}
                  onChange={setMaterial}
                  options={materials.map((value) => ({ value, label: value }))}
                />
              </div>
            )}

            {dimensions.length > 0 && (
              <div className="mt-5">
                <p className="field-label flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5 text-gold" />
                  {t.detail.dimensions}
                </p>
                <TextChoices
                  name="dimensions"
                  value={selectedSize}
                  onChange={setSize}
                  options={dimensions.map((value) => ({ value, label: value }))}
                />
              </div>
            )}

            {p.features.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <h2 className="text-lg font-semibold text-navy">{t.detail.features}</h2>
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {p.features.map((f, i) => (
                    <li
                      key={`${f}-${i}`}
                      className="group flex gap-3 rounded-2xl border border-border bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[var(--shadow-card)]"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-gold transition-transform group-hover:scale-105">
                        <Check className="h-4 w-4" strokeWidth={2.6} />
                      </span>
                      <span className="pt-1 text-sm font-medium leading-snug text-navy">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {colors.length > 0 && (
              <div className="mt-8">
                <p className="field-label">{t.detail.colors}</p>
                <ColorImageChoices name="color" value={selectedColor} onChange={setColor} options={colors} />
              </div>
            )}

            <div className="mt-8 flex items-center gap-3">
              <span className="field-label !mb-0">{t.detail.quantity}</span>
              <div className="inline-flex items-center rounded-full border border-border bg-background p-1">
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-secondary"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-10 text-center font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-secondary"
                  onClick={() => setQty(qty + 1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button type="button" className="btn-base btn-gold" onClick={() => setOpen(true)}>
                {t.detail.orderThis}
              </button>
              <a href={waLink(msg)} target="_blank" rel="noreferrer" className="btn-base btn-outline-navy">
                <MessageCircle className="h-4 w-4" />
                {t.detail.askWhatsapp}
              </a>
            </div>
          </Reveal>
        </div>
      </div>
      </div>

      <OrderDialog
        key={`${qty}-${selectedColor}-${selectedSize}-${selectedMaterial}-${open}`}
        product={p}
        open={open}
        onOpenChange={setOpen}
        initialQty={qty}
        initialColor={selectedColor}
        initialSize={selectedSize}
        initialMaterial={selectedMaterial}
      />

      {related.length > 0 && (
        <section className="border-t border-border bg-sand/50">
          <div className="container-page section-y">
            <Reveal>
              <h2 className="display-lg text-navy">{t.detail.related}</h2>
            </Reveal>
            <div className="mt-8">
              <ProductGrid products={related} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
