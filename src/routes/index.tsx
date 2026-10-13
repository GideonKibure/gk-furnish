import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeDollarSign, GraduationCap, Hammer, Ruler } from "lucide-react";
import { useEffect, useRef } from "react";
import { HERO_VIDEO_SRC, IMAGES, GALLERY, imageFor } from "@/data/images";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { categoriesQuery, productsQuery } from "@/lib/catalog";
import { ProductGrid } from "@/components/site/ProductCard";
import { SectionTitle } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { pageSectionsQuery, sectionText } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GK furnish — Student furniture made in Mbeya" },
      { name: "description", content: "Chairs, study tables, beds and lamps handmade in Mbeya. Order online or on WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "GK furnish — Student furniture made in Mbeya" },
      { property: "og:description", content: "Durable, affordable furniture for students and homes in Tanzania." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
    ]),
  component: Home,
});

function Home() {
  const { t, lang } = useLang();
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: cats } = useSuspenseQuery(categoriesQuery);
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const heroTitle = sectionText(sections, "home", "hero_title", lang, t.home.heroTitle);
  const heroSubtitle = sectionText(sections, "home", "hero_subtitle", lang, t.home.heroSubtitle);
  const customTitle = sectionText(sections, "home", "custom_title", lang, t.home.customTitle);
  const customBody = sectionText(sections, "home", "custom_body", lang, t.home.customBody);

  const feats = [
    { k: "students", img: IMAGES.room, slug: "" },
    { k: "desks", img: IMAGES.tables, slug: "tables" },
    { k: "chairs", img: IMAGES.chairs, slug: "chairs" },
    { k: "beds", img: IMAGES.beds, slug: "beds" },
  ] as const;

  const why = [
    { k: "affordable", I: BadgeDollarSign },
    { k: "durable", I: Hammer },
    { k: "custom", I: Ruler },
    { k: "student", I: GraduationCap },
  ] as const;
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().catch(() => undefined);
  }, []);

  return (
    <>
      <section className="home-hero relative isolate flex min-h-svh items-end overflow-hidden bg-navy">
        <video
          ref={heroVideoRef}
          className="absolute inset-0 -z-10 h-full w-full scale-105 object-cover home-hero-video"
          src={HERO_VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={IMAGES.hero}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy via-navy/55 to-navy/15" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--gold)_18%,transparent),transparent_55%)]" />

        <div className="container-page relative w-full pb-20 pt-28 md:pb-28 md:pt-36">
          <p className="home-hero-line eyebrow !text-gold" style={{ animationDelay: "80ms" }}>
            {t.home.heroEyebrow}
          </p>
          <h1
            className="home-hero-line display-xl mt-3 max-w-4xl text-primary-foreground"
            style={{ animationDelay: "180ms" }}
          >
            {heroTitle}
          </h1>
          <p
            className="home-hero-line mt-5 max-w-xl text-lg text-primary-foreground/85 md:text-xl"
            style={{ animationDelay: "300ms" }}
          >
            {heroSubtitle}
          </p>
          <div className="home-hero-line mt-8 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "420ms" }}>
            <Link to="/products" className="btn-base btn-gold group">
              {t.home.heroCta1}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link to="/custom-order" className="btn-base btn-outline-light group">
              {t.home.heroCta2}
              <ArrowRight className="h-4 w-4 opacity-70 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

      </section>

      <section id="start-here" className="container-page section-y">
        <Reveal>
          <SectionTitle eyebrow={t.home.featureEyebrow} title={t.home.featureTitle} />
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {feats.map((f, i) => (
            <Reveal key={f.k} delayMs={i * 90} variant="scale">
              <Link
                {...(f.slug
                  ? { to: "/categories/$slug" as const, params: { slug: f.slug } }
                  : { to: "/products" as const })}
                className="home-feature group relative block overflow-hidden rounded-3xl"
              >
                <div className="aspect-[4/5] overflow-hidden sm:aspect-[4/3]">
                  <img
                    src={f.img}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/35 to-transparent opacity-90 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-2xl text-white transition-transform duration-500 group-hover:-translate-y-1">
                    {t.features[f.k].title}
                  </h3>
                  <p className="mt-1 max-h-0 overflow-hidden text-sm text-white/80 opacity-0 transition-all duration-500 group-hover:max-h-20 group-hover:opacity-100">
                    {t.features[f.k].body}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold">
                    {t.common.explore}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-sand">
        <div className="container-page section-y">
          <Reveal>
            <SectionTitle eyebrow={t.home.categoriesEyebrow} title={t.home.categoriesTitle} />
          </Reveal>
          <div className="grid gap-5 md:grid-cols-2">
            {cats
              .filter((c) => c.slug !== "custom-furniture")
              .map((c, i) => (
                <Reveal key={c.id} delayMs={i * 100} variant={i % 2 === 0 ? "left" : "right"}>
                  <Link
                    to="/categories/$slug"
                    params={{ slug: c.slug }}
                    className="home-category group relative block aspect-[16/10] overflow-hidden rounded-3xl"
                  >
                    <img
                      src={imageFor(c.image_key)}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy/95 via-navy/40 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                      <h3 className="font-display text-3xl text-white sm:text-4xl">
                        {localized(lang, c.name, c.name_sw)}
                      </h3>
                      <p className="mt-1 text-sm text-white/75">
                        {products.filter((p) => p.category_id === c.id).length} {t.common.items}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold/95 px-4 py-2 text-sm font-bold text-navy shadow-[var(--shadow-gold)] transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-[1.03]">
                        {t.common.viewCollection}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
          </div>
        </div>
      </section>

      <section className="container-page section-y">
        <Reveal>
          <SectionTitle
            eyebrow={t.home.featuredEyebrow}
            title={t.home.featuredTitle}
            action={
              <Link to="/products" className="btn-base btn-outline-navy group">
                {t.home.viewAll}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            }
          />
        </Reveal>
        <ProductGrid products={products.filter((p) => p.is_featured).slice(0, 8)} />
      </section>

      <section className="home-why relative overflow-hidden bg-navy text-primary-foreground">
        <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
        <div className="container-page section-y relative">
          <Reveal>
            <p className="eyebrow !text-gold">{t.home.whyEyebrow}</p>
            <h2 className="display-lg mt-2">{t.home.whyTitle}</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {why.map(({ k, I }, i) => (
              <Reveal key={k} delayMs={i * 90} variant="up">
                <div className="home-why-card group">
                  <span className="home-why-icon">
                    <I className="h-7 w-7" />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold">{t.why[k].title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{t.why[k].body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page section-y">
        <Reveal>
          <SectionTitle eyebrow={t.home.latestEyebrow} title={t.home.latestTitle} />
        </Reveal>
        <ProductGrid products={products.slice(0, 4)} />
      </section>

      <section className="container-page pb-16 md:pb-24">
        <Reveal variant="scale">
          <div className="home-custom group grid overflow-hidden rounded-[2rem] bg-gold md:grid-cols-2">
            <div className="relative z-10 flex flex-col justify-center p-8 md:p-12 lg:p-14">
              <h2 className="display-lg text-navy">{customTitle}</h2>
              <p className="mt-4 max-w-md text-base text-navy/80 md:text-lg">{customBody}</p>
              <Link to="/custom-order" className="btn-base btn-navy mt-7 w-fit group/btn">
                {t.home.customCta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </Link>
            </div>
            <div className="relative min-h-[16rem] overflow-hidden md:min-h-full">
              <img
                src={IMAGES.custom}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-gold/30 md:bg-gradient-to-r md:from-transparent md:to-gold/20" />
            </div>
          </div>
        </Reveal>
      </section>

      <section className="bg-sand">
        <div className="container-page section-y">
          <Reveal>
            <SectionTitle
              eyebrow={t.home.galleryEyebrow}
              title={t.home.galleryTitle}
              action={
                <Link to="/gallery" className="btn-base btn-outline-navy group">
                  {t.home.galleryCta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              }
            />
          </Reveal>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {GALLERY.slice(0, 8).map((g, i) => (
              <Reveal key={i} delayMs={i * 50} variant="scale">
                <Link
                  to="/gallery"
                  className={cn(
                    "home-gallery-tile group relative block overflow-hidden rounded-2xl",
                    i === 0 || i === 5 ? "md:row-span-1" : "",
                  )}
                >
                  <img
                    src={IMAGES[g.key]}
                    alt={g.caption}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-navy/0 transition-colors duration-500 group-hover:bg-navy/45" />
                  <span className="absolute inset-x-3 bottom-3 translate-y-2 truncate text-xs font-semibold text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 sm:text-sm">
                    {g.caption}
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
