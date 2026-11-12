import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { loadSession } from "@/lib/session";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  Hammer,
  HandCoins,
  MessageCircle,
  PackageCheck,
  Phone,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryTile } from "@/components/brand/CategoryTile";
import { FeatureBadges } from "@/components/brand/FeatureBadges";
import { StarRating } from "@/components/brand/StarRating";
import { SectionTitle } from "@/components/site/PageHeader";
import { ServiceMedia } from "@/components/site/ServiceMedia";
import { formatAmount } from "@/config/site";
import { ProductGrid } from "@/components/site/ProductCard";
import { HERO_VIDEO_SRC, IMAGES, imageFor } from "@/data/images";
import { useSiteImages } from "@/hooks/use-site-images";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { approvedReviewsQuery, categoriesQuery, productsQuery, ratingSummaryQuery, servicesQuery } from "@/lib/catalog";
import { pageSectionsQuery, sectionText, settingsToSite, siteSettingsQuery } from "@/lib/site-content";
import { categoryImageSlot } from "@/lib/site-images";
import { seo } from "@/lib/seo";
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
});

function HeroLetters({ text }: { text: string }) {
  const words = text.split(" ");
  let count = 0;
  return (
    <>
      {words.map((word, wi) => (
        <span key={`${word}-${wi}`} className="inline-block whitespace-nowrap">
          {[...word].map((letter) => {
            const delay = count * 38;
            count += 1;
            return (
              <span key={delay} className="hero-letter" style={{ animationDelay: `${delay}ms` }}>
                {letter}
              </span>
            );
          })}
          {wi < words.length - 1 ? "\u00a0" : null}
        </span>
      ))}
    </>
  );
}

function useHeroVideo() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 768px)").matches;
    setOn(!slow && !reduced && wide);
  }, []);
  return on;
}

const HERO_ALT = [
  "Furniture made by GK Furnish in Mbeya",
  "Furniture for a home",
  "Study tables from GK Furnish",
  "Study chairs from GK Furnish",
  "Beds from GK Furnish",
];

function HeroSlides({ slides, index }: { slides: string[]; index: number }) {
  const videoOn = useHeroVideo();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (index === 0) video.play().catch(() => undefined);
    else video.pause();
  }, [index, videoOn]);

  return (
    <>
      {slides.map((src, i) => (
        <div
          key={src + i}
          aria-hidden={i !== index}
          className={cn("hero-slide absolute inset-0", i === index ? "opacity-100" : "opacity-0")}
        >
          {i === 0 && videoOn ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              src={HERO_VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={src}
              aria-label={HERO_ALT[0]}
            />
          ) : (
            <img
              src={src}
              alt={i === index ? (HERO_ALT[i] ?? "GK Furnish furniture") : ""}
              width={1600}
              height={1000}
              decoding="async"
              fetchPriority={i === 0 ? "high" : "low"}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      ))}
    </>
  );
}

function Home() {
  const { t, lang } = useLang();
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const { data: reviews = [] } = useQuery(approvedReviewsQuery());
  const { data: services = [] } = useQuery(servicesQuery);
  const { data: settings } = useQuery(siteSettingsQuery);
  const site = settingsToSite(settings);
  const fixes = t.home2.heroFixes;
  const [fixIndex, setFixIndex] = useState(0);
  const fix = fixes[fixIndex] ?? fixes[0];
  const slideForFix = [3, 4, 2];

  useEffect(() => {
    if (fixes.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setFixIndex((i) => (i + 1) % fixes.length), 4200);
    return () => window.clearInterval(timer);
  }, [fixes.length]);

  const customTitle = sectionText(sections, "home", "custom_title", lang, t.home.customTitle);
  const customBody = sectionText(sections, "home", "custom_body", lang, t.home.customBody);
  const { image, gallery } = useSiteImages();
  const customImage = image("home.custom", IMAGES.custom);
  const slides = useMemo(
    () =>
      [
        image("home.hero", IMAGES.hero),
        image("home.feature.homes", IMAGES.room),
        image("home.feature.desks", IMAGES.tables),
        image("home.feature.chairs", IMAGES.chairs),
        image("home.feature.beds", IMAGES.beds),
      ].filter((src): src is string => Boolean(src)),
    [image],
  );

  const featured = products.filter((p) => p.is_featured).slice(0, 8);
  const latest = products.slice(0, 4);
  const productName = new Map(products.map((p) => [p.id, localized(lang, p.name, p.name_sw)]));
  const whyIcons = [BadgeCheck, Ruler, Tag, Truck, ShieldCheck];
  const howIcons = [ShoppingBag, ClipboardList, Wallet, PackageCheck];
  const wa = `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(t.whatsapp.general)}`;
  const dial = site.phoneDial.startsWith("+") ? site.phoneDial : `+${site.phoneDial.replace(/\D/g, "")}`;

  return (
    <>
      {/* Hero */}
      <section className="bg-sand pb-24 md:pb-28 lg:pb-12">
        <div className="container-page pt-4 md:pt-6">
          <div className="grid overflow-hidden rounded-2xl border border-border bg-navy md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="order-2 flex flex-col justify-center px-5 py-8 text-white sm:px-8 md:order-1 md:px-10 md:py-12 lg:px-12">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">{t.home.heroEyebrow}</p>
              <h1 className="mt-3 max-w-xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-5xl">
                <span className="sr-only">
                  {t.home2.heroAsk} {fix?.word}
                </span>
                <span aria-hidden className="block text-white">
                  <HeroLetters text={t.home2.heroAsk} />
                </span>
                {fix && (
                  <span key={fix.word} aria-hidden className="mt-1 block text-gold">
                    <HeroLetters text={fix.word} />
                  </span>
                )}
              </h1>
              <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-white/80 md:text-base">{t.home.heroSubtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {fix && (
                  <Link to="/categories/$slug" params={{ slug: fix.slug }} className="btn-base btn-gold btn-lg group">
                    {fix.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )}
                <Link to="/custom-order" className="btn-base btn-lg border border-white/30 bg-transparent text-white hover:bg-white/10">
                  {t.home2.describeRoom}
                </Link>
              </div>
            </div>
            <div className="relative order-1 min-h-56 sm:min-h-72 md:order-2 md:min-h-[32rem]">
              <HeroSlides slides={slides} index={slides.length ? (slideForFix[fixIndex] ?? 0) % slides.length : 0} />
            </div>
          </div>
          <FeatureBadges className="mt-4" />
        </div>
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

      {/* How ordering works */}
      <section className="bg-navy text-white">
        <div className="container-page section-y">
          <div className="mb-6">
            <h2 className="section-title !text-white">{t.home2.howTitle}</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.home2.howSteps.map((step, i) => {
              const Icon = howIcons[i] ?? HandCoins;
              return (
                <li key={step.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-gold text-sm font-bold text-navy">{i + 1}</span>
                    <Icon className="h-5 w-5 text-gold" strokeWidth={1.8} />
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

      {/* Gallery */}
      <section className="container-page section-y">
        <SectionTitle
          title={t.home.galleryTitle}
          action={
            <Link to="/gallery" className="inline-flex items-center gap-1 text-sm font-semibold text-gold-ink hover:underline">
              {t.home.galleryCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {gallery.slice(0, 8).map((g) => (
            <Link key={g.id} to="/gallery" className="group relative block overflow-hidden rounded-xl border border-border">
              <img
                src={g.url}
                alt={localized(lang, g.caption, g.caption_sw)}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Contact strip */}
      <section className="border-t border-border bg-sand">
        <div className="container-page flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="section-title">{t.home2.contactTitle}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t.home2.contactBody}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={wa} target="_blank" rel="noreferrer" className="btn-base btn-gold">
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
