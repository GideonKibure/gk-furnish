import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { loadSession } from "@/lib/session";
import { ArrowRight, HeartHandshake, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { IMAGES } from "@/data/images";
import { useSiteImages } from "@/hooks/use-site-images";
import { useLang } from "@/i18n/LanguageProvider";
import { pageSectionsQuery, sectionText } from "@/lib/site-content";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/about")({
  head: () =>
    seo({
      title: "About GK Furnish | Furniture makers in Mbeya",
      description: "GK Furnish is a furniture workshop in Mbeya, Tanzania. We make ready-made pieces and custom furniture for homes, students and offices.",
      path: "/about",
      image: IMAGES.workshop,
    }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { session } = await loadSession();
    if (session) throw redirect({ to: "/products", replace: true });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(pageSectionsQuery).catch(() => []),
  component: About,
});

const VALUE_ICONS = [ShieldCheck, Wrench, Sparkles, HeartHandshake] as const;

function About() {
  const { t, lang } = useLang();
  const a = t.about;
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const lead = sectionText(sections, "about", "lead", lang, a.lead);
  const story = sectionText(sections, "about", "story", lang, a.story);
  const mission = sectionText(sections, "about", "mission", lang, a.mission);
  const vision = sectionText(sections, "about", "vision", lang, a.vision);
  const { image } = useSiteImages();
  const storyImage = image("about.story", IMAGES.workshop);

  return (
    <>
      <PageHeader
        title={a.title}
        subtitle={lead}
        image={image("header.about", null)}
        crumbs={[{ label: t.nav.home, href: "/" }, { label: t.nav.about }]}
      />

      <div className={cn("container-page section-y grid items-center gap-10 lg:gap-14", storyImage && "lg:grid-cols-2")}>
        <Reveal variant="left">
          <h2 className="display-lg text-navy">{a.storyTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{story}</p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{a.story2}</p>
        </Reveal>
        {storyImage && (
          <Reveal variant="right" delayMs={80}>
            <div className="overflow-hidden rounded-xl shadow-[var(--shadow-lift)]">
              <img
                src={storyImage}
                alt={a.storyTitle}
                width={1200}
                height={900}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-105"
              />
            </div>
          </Reveal>
        )}
      </div>

      <section className="bg-navy text-primary-foreground">
        <div className="container-page section-y grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="rounded-xl border border-white/10 bg-white/5 p-7 backdrop-blur transition-transform duration-300 hover:-translate-y-1">
              <p className="eyebrow !text-gold">{a.missionTitle}</p>
              <p className="mt-3 text-base leading-relaxed text-white/80 md:text-lg">{mission}</p>
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <div className="rounded-xl border border-white/10 bg-white/5 p-7 backdrop-blur transition-transform duration-300 hover:-translate-y-1">
              <p className="eyebrow !text-gold">{a.visionTitle}</p>
              <p className="mt-3 text-base leading-relaxed text-white/80 md:text-lg">{vision}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-sand">
        <div className="container-page section-y">
          <Reveal>
            <h2 className="display-lg text-navy">{a.valuesTitle}</h2>
          </Reveal>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {a.values.map((v, i) => {
              const Icon = VALUE_ICONS[i % VALUE_ICONS.length] ?? ShieldCheck;
              return (
                <Reveal key={v.title} delayMs={i * 70} variant="up">
                  <div className="panel h-full p-5">
                    <span className="grid h-11 w-11 place-items-center rounded-lg bg-gold-tint text-navy">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-xl text-navy">{v.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-16 max-w-3xl">
            <h2 className="display-lg text-navy">{a.forTitle}</h2>
            <p className="mt-4 text-muted-foreground md:text-lg">{a.forBody}</p>
            <Link to="/custom-order" className="btn-base btn-gold mt-7 w-fit">
              {t.nav.custom}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
