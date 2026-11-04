import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { Reveal } from "@/components/site/Reveal";
import { Lightbox } from "@/components/site/ZoomGallery";
import { useSiteImages } from "@/hooks/use-site-images";
import { localized, useLang } from "@/i18n/LanguageProvider";
import { pageSectionsQuery, sectionText } from "@/lib/site-content";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gallery")({
  head: () =>
    seo({ title: "Gallery — GK furnish", description: "Finished furniture, rooms and workshop photos from GK furnish.", path: "/gallery" }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pageSectionsQuery).catch(() => []),
  component: Gallery,
});

const GROUPS = ["all", "chairs", "tables", "beds", "lamps", "custom", "workshop"] as const;

function Gallery() {
  const { t, lang } = useLang();
  const { data: sections = [] } = useQuery(pageSectionsQuery);
  const { image, gallery } = useSiteImages();
  const subtitle = sectionText(sections, "gallery", "subtitle", lang, t.gallery.subtitle);
  const [g, setG] = useState<(typeof GROUPS)[number]>("all");
  const [i, setI] = useState<number | null>(null);

  const items = useMemo(
    () => gallery.filter((x) => g === "all" || x.group === g),
    [g, gallery],
  );
  const captions = items.map((x) => localized(lang, x.caption, x.caption_sw));

  return (
    <>
      <PageHeader
        title={t.gallery.title}
        subtitle={subtitle}
        image={image("header.gallery", null)}
        crumbs={[{ label: t.nav.home, href: "/" }, { label: t.gallery.title }]}
      />
      <div className="container-page section-y">
        <Reveal>
          <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar">
            {GROUPS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setG(k);
                  setI(null);
                }}
                aria-pressed={g === k}
                data-active={g === k}
                className="chip shrink-0"
              >
                {t.gallery[k]}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="columns-2 gap-3 md:columns-3 md:gap-4">
          {items.map((x, k) => (
            <Reveal key={x.id} delayMs={(k % 6) * 40} variant="scale" className="mb-3 break-inside-avoid md:mb-4">
              <button
                type="button"
                onClick={() => setI(k)}
                className="group relative block w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <img
                  src={x.url}
                  alt={captions[k]}
                  loading="lazy"
                  className={cn(
                    "w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105",
                    k % 3 === 0 ? "aspect-[3/4]" : "aspect-square",
                  )}
                />
                <span className="absolute inset-0 bg-navy/0 transition-colors duration-300 group-hover:bg-navy/35" />
                <span className="absolute inset-x-3 bottom-3 translate-y-2 text-left text-xs font-semibold text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:text-sm">
                  {captions[k]}
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {i !== null && items.length > 0 && (
        <Lightbox
          images={items.map((x) => x.url)}
          captions={captions}
          index={i}
          onIndex={setI}
          onClose={() => setI(null)}
          alt=""
        />
      )}
    </>
  );
}
