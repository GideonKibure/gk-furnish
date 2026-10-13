import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HeartHandshake, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { IMAGES } from "@/data/images";
import { useLang } from "@/i18n/LanguageProvider";
import { pageSectionsQuery, sectionText } from "@/lib/site-content";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — GK furnish" },
      {
        name: "description",
        content: "A furniture workshop in Mbeya making durable, affordable furniture by hand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "About — GK furnish" },
      { property: "og:description", content: "Our story, mission and values." },
    ],
  }),
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

  return (
    <>
      <PageHeader title={a.title} subtitle={lead} />

      <div className="container-page section-y grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal variant="left">
          <h2 className="display-lg text-navy">{a.storyTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">{story}</p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
            {a.story2}
          </p>
        </Reveal>
        <Reveal variant="right" delayMs={80}>
          <div className="overflow-hidden rounded-[1.75rem] shadow-[var(--shadow-lift)]">
            <img
              src={IMAGES.workshop}
              alt=""
              className="aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>
        </Reveal>
      </div>

      <section className="bg-navy text-primary-foreground">
        <div className="container-page section-y grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-7 backdrop-blur transition-transform duration-300 hover:-translate-y-1">
              <p className="eyebrow !text-gold">{a.missionTitle}</p>
              <p className="mt-3 text-base leading-relaxed text-white/80 md:text-lg">{mission}</p>
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-7 backdrop-blur transition-transform duration-300 hover:-translate-y-1">
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
                  <div className="group h-full rounded-[1.5rem] border border-border bg-background p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-gold/35 hover:shadow-[var(--shadow-lift)]">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-gold text-navy transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
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
