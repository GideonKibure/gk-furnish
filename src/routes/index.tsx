import { createFileRoute, Link } from "@tanstack/react-router";
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
import { ProductGrid } from "@/components/site/ProductCard";
import { HERO_VIDEO_SRC, IMAGES, imageFor } from "@/data/images";
import { useSiteImages } from "@/hooks/use-site-images";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { approvedReviewsQuery, categoriesQuery, productsQuery, ratingSummaryQuery } from "@/lib/catalog";
import { pageSectionsQuery, sectionText, settingsToSite, siteSettingsQuery } from "@/lib/site-content";
import { categoryImageSlot } from "@/lib/site-images";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      title: "GK furnish — Stylish & affordable furniture, Mbeya",
      description:
        "Study chairs, tables, beds and more for homes, students, offices and schools. Prices in TZS, delivery arranged across Tanzania.",
      path: "/",
      image: IMAGES.hero,
    }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(pageSectionsQuery).catch(() => []),
      context.queryClient.prefetchQuery(ratingSummaryQuery),
    ]),
  component: Home,
});

/** Split "Main | accent" (or "main, accent") so the accent line can be gold. */
function splitTitle(title: string) {
  const bar = title.indexOf("|");
  if (bar > 0) return [title.slice(0, bar).trim(), title.slice(bar + 1).trim()] as const;
  const comma = title.lastIndexOf(",");
  if (comma > 0 && comma < title.length - 3) return [title.slice(0, comma + 1).trim(), title.slice(comma + 1).trim()] as const;
  return [title, ""] as const;
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

function HeroSlides({ slides }: { slides: string[] }) {
  const [index, setIndex] = useState(0);
  const videoOn = useHeroVideo();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

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
          aria-hidden
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
            />
          ) : (
            <img
              src={src}
              alt=""
              decoding="async"
              fetchPriority={i === 0 ? "high" : "low"}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
          )}
        </div>
      ))}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:bottom-6">
          {slides.map((src, i) => (
            <button
              key={src + i}
              type="button"
              aria-label={`${i + 1} / ${slides.length}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-gold" : "w-2 bg-navy/25 hover:bg-navy/45",
              )}
            />
          ))}
        </div>
      )}
    </>
  );
}

function Home() {
  const { t, lang } = useLang();
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const { data: reviews = [] } = useQuery(approvedReviewsQuery());
  const { data: settings } = useQuery(siteSettingsQuery);
  const site = settingsToSite(settings);
  const heroTitle = sectionText(sections, "home", "hero_title", lang, t.home.heroTitle);
  const heroSubtitle = sectionText(sections, "home", "hero_subtitle", lang, t.home.heroSubtitle);
  const customTitle = sectionText(sections, "home", "custom_title", lang, t.home.customTitle);
  const customBody = sectionText(sections, "home", "custom_body", lang, t.home.customBody);
  const [titleMain, titleAccent] = splitTitle(heroTitle);

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
      <section className="bg-sand pb-8 md:pb-12">
        <div className="container-page pt-4 md:pt-6">
          <div className="relative isolate overflow-hidden rounded-2xl border border-border bg-white">
            <div className="absolute inset-0 -z-10">
              <HeroSlides slides={slides} />
              <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white/5 md:bg-gradient-to-r md:from-white md:via-white/85 md:to-white/0" />
            </div>
            <div className="flex min-h-[26rem] flex-col justify-start px-5 pb-16 pt-8 sm:px-8 md:min-h-[30rem] md:justify-center md:px-12 md:py-16 lg:min-h-[32rem] lg:px-16">
              <p className="eyebrow">{t.home.heroEyebrow}</p>
              <h1 className="display-xl mt-2 max-w-xl text-navy">
                {titleMain}
                {titleAccent && (
                  <>
                    {" "}
                    <span className="block text-gold-ink">{titleAccent}</span>
                  </>
                )}
              </h1>
              <p className="mt-3 text-base font-semibold text-navy md:text-lg">{t.home2.heroTagline}</p>
              <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-navy/75 md:text-base">{heroSubtitle}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/products" className="btn-base btn-gold btn-lg group">
                  {t.home2.shopNow}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link to="/custom-order" className="btn-base btn-outline-navy btn-lg">
                  {t.home2.customOrder}
                </Link>
              </div>
            </div>
          </div>
          <FeatureBadges className="relative z-10 -mt-6 mx-2 sm:mx-6 md:mx-10" />
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
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 className="section-title !text-white">{t.home2.howTitle}</h2>
            <Link to="/process" className="inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline">
              {t.home2.howCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
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
              <img src={customImage} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
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
