import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { Lightbox } from "@/components/site/ZoomGallery";
import { GALLERY, IMAGES } from "@/data/images";
import { useLang } from "@/i18n/LanguageProvider";
import { pageSectionsQuery, sectionText } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — GK furnish" },
      { name: "description", content: "Finished furniture, rooms and workshop photos from GK furnish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Gallery — GK furnish" },
      { property: "og:description", content: "See GK furnish work." },
    ],
  }),
  component: Gallery,
});

const GROUPS = ["all", "chairs", "tables", "beds", "lamps", "custom", "workshop"] as const;

function Gallery() {
  const { t, lang } = useLang();
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const subtitle = sectionText(sections, "gallery", "subtitle", lang, t.gallery.subtitle);
  const [g, setG] = useState<(typeof GROUPS)[number]>("all");
  const [i, setI] = useState<number | null>(null);

  const items = useMemo(
    () => GALLERY.filter((x) => g === "all" || x.group === g),
    [g],
  );

  return (
    <>
      <PageHeader title={t.gallery.title} subtitle={subtitle} />
      <div className="container-page section-y">
        <Reveal>
          <div className="mb-8 flex flex-wrap gap-2">
            {GROUPS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setG(k);
                  setI(null);
                }}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
                  g === k
                    ? "bg-navy text-primary-foreground shadow-[var(--shadow-card)]"
                    : "bg-secondary text-navy hover:bg-secondary/80",
                )}
              >
                {t.gallery[k]}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="columns-2 gap-3 md:columns-3 md:gap-4">
          {items.map((x, k) => (
            <Reveal key={`${x.key}-${x.caption}`} delayMs={(k % 6) * 40} variant="scale" className="mb-3 break-inside-avoid md:mb-4">
              <button
                type="button"
                onClick={() => setI(k)}
                className="group relative block w-full overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <img
                  src={IMAGES[x.key]}
                  alt={x.caption}
                  loading="lazy"
                  className={cn(
                    "w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105",
                    k % 3 === 0 ? "aspect-[3/4]" : "aspect-square",
                  )}
                />
                <span className="absolute inset-0 bg-navy/0 transition-colors duration-300 group-hover:bg-navy/35" />
                <span className="absolute inset-x-3 bottom-3 translate-y-2 text-left text-xs font-semibold text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:text-sm">
                  {x.caption}
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {i !== null && (
        <Lightbox
          images={items.map((x) => IMAGES[x.key])}
          captions={items.map((x) => x.caption)}
          index={i}
          onIndex={setI}
          onClose={() => setI(null)}
          alt=""
        />
      )}
    </>
  );
}
