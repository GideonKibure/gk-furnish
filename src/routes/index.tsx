import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { loadSession } from "@/lib/session";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  Hammer,
  Handshake,
  Layers,
  MessageCircle,
  Paintbrush,
  Phone,
  Ruler,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import { CategoryTile } from "@/components/brand/CategoryTile";
import { FeatureBadges } from "@/components/brand/FeatureBadges";
import { StarRating } from "@/components/brand/StarRating";
import { SectionTitle } from "@/components/site/PageHeader";
import { ServiceMedia } from "@/components/site/ServiceMedia";
import { formatAmount } from "@/config/site";
import { ProductGrid } from "@/components/site/ProductCard";
import { IMAGES, imageFor } from "@/data/images";
import { DEFAULT_PAY_ACCOUNTS } from "@/lib/pay-accounts";
import { useSiteImages } from "@/hooks/use-site-images";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { approvedReviewsQuery, categoriesQuery, productsQuery, ratingSummaryQuery, servicesQuery } from "@/lib/catalog";
import { pageSectionsQuery, sectionText, settingsToSite, siteSettingsQuery } from "@/lib/site-content";
import { categoryImageSlot } from "@/lib/site-images";
import { seo } from "@/lib/seo";
import { CatalogueError, ShopPending } from "@/components/site/CatalogueState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      title: "Furniture shop in Mbeya | GK Furnish",
      description:
        "GK Furnish makes affordable furniture in Mbeya for students, homes and offices, and builds custom pieces to order. Prices in TZS, with delivery arranged across Tanzania.",
      path: "/",
      image: IMAGES.hero,
    }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { session } = await loadSession();
    if (session) throw redirect({ to: "/products", replace: true });
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(pageSectionsQuery).catch(() => []),
      context.queryClient.prefetchQuery(ratingSummaryQuery),
    ]),
  component: Home,
  pendingComponent: ShopPending,
  errorComponent: CatalogueError,
});

const PROCESS_ICONS = [MessageCircle, Handshake, Layers, Hammer, Paintbrush, BadgeCheck, Truck] as const;

function Home() {
  const { t, lang } = useLang();
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const { data: reviews = [] } = useQuery(approvedReviewsQuery());
  const { data: services = [] } = useQuery(servicesQuery);
  const { data: settings } = useQuery(siteSettingsQuery);
  const site = settingsToSite(settings);

  const customTitle = sectionText(sections, "home", "custom_title", lang, t.home.customTitle);
  const customBody = sectionText(sections, "home", "custom_body", lang, t.home.customBody);
  const { image, gallery } = useSiteImages();
  const customImage = image("home.custom", IMAGES.custom);
  const heroSrc = image("home.hero", IMAGES.hero);

  const featured = products.filter((p) => p.is_featured).slice(0, 8);
  const latest = products.slice(0, 4);
  const productName = new Map(products.map((p) => [p.id, localized(lang, p.name, p.name_sw)]));
  const whyIcons = [BadgeCheck, Ruler, Tag, Truck, ShieldCheck];
  const wa = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(t.whatsapp.general)}`;
  const dial = site.phoneDial.startsWith("+") ? site.phoneDial : `+${site.phoneDial.replace(/\D/g, "")}`;

  return (
    <>
      <section className="bg-sand">
        <div className="container-page py-4">
          <div className="grid overflow-hidden rounded-2xl border border-border bg-navy md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="flex flex-col justify-center px-4 py-5 text-white sm:px-8 md:px-10 md:py-12">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">{t.home.heroEyebrow}</p>
              <h1 className="mt-2 max-w-xl text-[1.65rem] font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
                {t.home2.promiseTitle}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">{t.home2.promiseSupport}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Link to="/products" className="btn-base btn-gold min-h-11 w-full sm:w-auto">
                  {t.home2.browseFurniture}
                </Link>
                <Link
                  to="/custom-order"
                  className="btn-base min-h-11 w-full border border-white/40 bg-transparent text-white hover:bg-white/10 sm:w-auto"
                >
                  {t.home2.customQuote}
                </Link>
              </div>
            </div>
            {heroSrc && (
              <div className="relative h-36 sm:h-48 md:h-auto md:min-h-72">
                <img
                  src={heroSrc}
                  alt={t.home2.heroAlt}
                  width={1600}
                  height={1000}
                  decoding="async"
                  fetchPriority="high"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
            )}
          </div>
          <FeatureBadges className="mt-4" />
        </div>
      </section>

      <section className="container-page section-y">
        <SectionTitle title={t.home2.forTitle} />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              { label: t.home2.forStudents, to: "/categories/$slug" as const, params: { slug: "chairs" } },
              { label: t.home2.forHomes, to: "/products" as const },
              { label: t.home2.forOffices, to: "/categories/$slug" as const, params: { slug: "tables" } },
              { label: t.home2.forSchools, to: "/custom-order" as const },
              { label: t.home2.forGuests, to: "/custom-order" as const },
            ] as const
          ).map((item) => (
            <li key={item.label}>
              {"params" in item ? (
                <Link
                  to={item.to}
                  params={item.params}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-3 py-3 text-center text-sm font-semibold text-navy"
                >
                  {item.label}
                </Link>
              ) : (
                <Link
                  to={item.to}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-3 py-3 text-center text-sm font-semibold text-navy"
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Categories */}
      <section className="container-page section-y">
        <SectionTitle
          title={t.home2.categoriesTitle}
          action={
            <Link to="/categories" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-ink hover:underline">
              {t.home2.viewAll}
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {cats.map((c) => (
            <CategoryTile
              key={c.id}
              slug={c.slug}
              label={localized(lang, c.name, c.name_sw)}
              image={image(categoryImageSlot(c.slug), imageFor(c.image_key))}
            />
          ))}
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="bg-sand">
          <div className="container-page section-y">
            <SectionTitle
              title={t.home2.featuredTitle}
              action={
                <Link to="/products" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-ink hover:underline">
                  {t.home2.viewAll}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            <ProductGrid products={featured} />
          </div>
        </section>
      )}

      {/* Why choose us */}
      <section className="container-page section-y">
        <SectionTitle eyebrow={t.home.whyEyebrow} title={t.home2.whyTitle} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {t.home2.whyItems.map((item, i) => {
            const Icon = whyIcons[i] ?? Hammer;
            return (
              <div key={item.title} className="panel p-5">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-gold-tint text-navy">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h3 className="mt-3 text-base font-bold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-navy text-white">
        <div className="container-page section-y">
          <h2 className="section-title !text-white">{t.process.title}</h2>
          <ol className="mt-6 flex gap-3 overflow-x-auto pb-2">
            {t.process.steps.map((step, i) => {
              const Icon = PROCESS_ICONS[i] ?? Hammer;
              return (
                <li key={step.title} className="w-56 shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-sm font-bold text-navy">{i + 1}</span>
                    <Icon className="h-5 w-5 text-gold" strokeWidth={1.8} aria-hidden />
                  </div>
                  <h3 className="mt-3 text-base font-bold !text-white">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {services.length > 0 && (
        <section className="container-page section-y">
          <SectionTitle title={t.home2.servicesTitle} />
          <p className="-mt-3 mb-5 max-w-2xl text-sm text-muted-foreground">{t.home2.servicesSubtitle}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const name = localized(lang, service.name, service.name_sw);
              return (
                <Link key={service.id} to="/services" hash={service.id} className="panel overflow-hidden transition-shadow hover:shadow-md">
                  {service.media_url && (
                    <ServiceMedia url={service.media_url} kind={service.media_kind} alt={name} className="aspect-[4/3] w-full object-cover" />
                  )}
                  <div className="p-5">
                    <h3 className="text-base font-bold text-navy">{name}</h3>
                    {service.price_tzs != null && service.price_tzs > 0 && (
                      <p className="mt-1 font-bold tabular-nums text-gold-ink">{formatAmount(service.price_tzs)}</p>
                    )}
                    {(service.description || service.description_sw) && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {localized(lang, service.description ?? "", service.description_sw)}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Testimonials: only approved, verified-buyer reviews */}
      {reviews.length > 0 && (
        <section className="container-page section-y">
          <SectionTitle title={t.home2.testimonialsTitle} />
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.slice(0, 3).map((r) => (
              <figure key={r.id} className="panel flex flex-col p-5">
                <StarRating value={r.rating} />
                {r.title && <p className="mt-2 font-semibold text-navy">{r.title}</p>}
                {r.body && <blockquote className="mt-1 line-clamp-5 text-sm leading-relaxed text-navy/80">“{r.body}”</blockquote>}
                <figcaption className="mt-auto pt-4 text-xs text-muted-foreground">
                  <span className="font-semibold text-navy">{r.author_name}</span>
                  {productName.get(r.product_id) ? ` · ${productName.get(r.product_id)}` : ""} · {t.reviews.verified}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Custom order banner */}
      <section className={cn("container-page", reviews.length ? "pb-10 md:pb-16" : "section-y")}>
        <div className={cn("grid overflow-hidden rounded-2xl bg-gold", customImage && "md:grid-cols-2")}>
          <div className="flex flex-col justify-center p-6 sm:p-8 md:p-12">
            <h2 className="display-lg text-navy">{customTitle}</h2>
            <p className="mt-3 max-w-md text-base text-navy/85">{customBody}</p>
            <Link to="/custom-order" className="btn-base btn-navy mt-6 w-fit">
              {t.home.customCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {customImage && (
            <div className="relative min-h-[14rem] md:min-h-full">
              <img src={customImage} alt={customTitle} width={1200} height={800} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          )}
        </div>
      </section>

      {/* New arrivals */}
      {latest.length > 0 && (
        <section className="bg-sand">
          <div className="container-page section-y">
            <SectionTitle
              title={t.home2.latestTitle}
              action={
                <Link
                  to="/products"
                  search={{ sort: "new" }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-gold-ink hover:underline"
                >
                  {t.home2.viewAll}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              }
            />
            <ProductGrid products={latest} />
          </div>
        </section>
      )}

      <section className="container-page section-y">
        <SectionTitle title={t.home2.proofTitle} />
        <p className="text-base font-semibold text-navy">{site.location}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.home2.proofOwner}: {DEFAULT_PAY_ACCOUNTS.mpesaName}
        </p>
        <a href={wa} target="_blank" rel="noreferrer" className="btn-base btn-outline-navy mt-4 min-h-11 w-fit">
          <MessageCircle className="h-4 w-4" />
          {t.common.whatsapp}
        </a>
        {gallery.length > 0 && (
          <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
            {gallery.slice(0, 8).map((g) => (
              <Link key={g.id} to="/gallery" className="block w-36 shrink-0 overflow-hidden rounded-xl border border-border">
                <img
                  src={g.url}
                  alt={localized(lang, g.caption, g.caption_sw)}
                  width={320}
                  height={320}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full object-cover"
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Contact strip */}
      <section className="border-t border-border bg-sand">
        <div className="container-page flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="section-title">{t.home2.contactTitle}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t.home2.contactBody}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={wa} target="_blank" rel="noreferrer" className="btn-base btn-outline-navy min-h-11">
              <MessageCircle className="h-4 w-4" />
              {t.common.whatsapp}
            </a>
            <a href={`tel:${dial}`} className="btn-base btn-outline-navy">
              <Phone className="h-4 w-4" />
              {site.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
